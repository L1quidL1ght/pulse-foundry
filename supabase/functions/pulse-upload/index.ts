import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

type DataRow = Array<unknown>;

const normalizeHeader = (header: unknown): string =>
  String(header ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseCSV = (text: string): DataRow[] => {
  const rows: DataRow[] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (insideQuotes && text[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }
      currentRow.push(currentField.trim());
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => String(cell ?? "").trim().length > 0));
};

const normalizeDate = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split("T")[0];
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const timestamp = Date.parse(raw);
  if (!Number.isNaN(timestamp)) {
    return new Date(timestamp).toISOString().split("T")[0];
  }

  return raw;
};

const findColumnIndex = (headers: string[], keywords: string[]): number => {
  for (const keyword of keywords) {
    const exactIndex = headers.findIndex((header) => header === keyword);
    if (exactIndex !== -1) return exactIndex;
  }

  for (const keyword of keywords) {
    const partialIndex = headers.findIndex((header) => header.includes(keyword));
    if (partialIndex !== -1) return partialIndex;
  }

  return -1;
};

const parseFileRows = async (fileName: string, fileBuffer: ArrayBuffer): Promise<DataRow[]> => {
  if (fileName.endsWith(".csv")) {
    const text = new TextDecoder().decode(new Uint8Array(fileBuffer));
    return parseCSV(text);
  }

  const XLSX = await import("https://esm.sh/xlsx@0.18.5?no-check");
  const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const worksheet = workbook.Sheets[sheetName];
  const rows: DataRow[] = XLSX.utils
    .sheet_to_json(worksheet, { header: 1 })
    .filter((row: DataRow) => row.some((cell) => String(cell ?? "").trim().length > 0));

  return rows;
};

const computeMetrics = (rows: DataRow[]) => {
  if (!rows.length) {
    return {
      kpis: {
        netSales: null,
        guests: null,
        ppa: null,
        tipPercent: null,
        laborPercent: null,
      },
      chartData: {
        dailySales: [] as Array<{ date: string; sales: number }>,
        ppaTrend: [] as Array<{ date: string; ppa: number }>,
      },
    };
  }

  const headerRow = rows[0];
  const dataRows = rows.slice(1);
  const normalizedHeaders = headerRow.map((cell) => normalizeHeader(cell));

  const netSalesIndex = findColumnIndex(normalizedHeaders, ["netsales", "totalsales", "sales"]);
  const guestsIndex = findColumnIndex(normalizedHeaders, ["guests", "guestcount", "covers"]);
  const tipsIndex = findColumnIndex(normalizedHeaders, ["tips", "gratuity", "tipamount"]);
  const laborIndex = findColumnIndex(normalizedHeaders, ["labor", "laborcost", "payroll"]);
  const dateIndex = findColumnIndex(normalizedHeaders, ["date", "businessdate", "day"]);

  let netSalesSum: number | null = netSalesIndex !== -1 ? 0 : null;
  let netSalesCount = 0;
  let guestsSum: number | null = guestsIndex !== -1 ? 0 : null;
  let guestsCount = 0;
  let tipsSum: number | null = tipsIndex !== -1 ? 0 : null;
  let tipsCount = 0;
  let laborSum: number | null = laborIndex !== -1 ? 0 : null;
  let laborCount = 0;

  const dailySalesMap = new Map<string, { sales: number; guests: number }>();

  for (const row of dataRows) {
    const netSalesValue = netSalesIndex !== -1 ? parseNumeric(row[netSalesIndex]) : null;
    const guestsValue = guestsIndex !== -1 ? parseNumeric(row[guestsIndex]) : null;
    const tipsValue = tipsIndex !== -1 ? parseNumeric(row[tipsIndex]) : null;
    const laborValue = laborIndex !== -1 ? parseNumeric(row[laborIndex]) : null;

    if (netSalesSum !== null && netSalesValue !== null) {
      netSalesSum += netSalesValue;
      netSalesCount++;
    }
    if (guestsSum !== null && guestsValue !== null) {
      guestsSum += guestsValue;
      guestsCount++;
    }
    if (tipsSum !== null && tipsValue !== null) {
      tipsSum += tipsValue;
      tipsCount++;
    }
    if (laborSum !== null && laborValue !== null) {
      laborSum += laborValue;
      laborCount++;
    }

    if (dateIndex !== -1) {
      const rawDate = normalizeDate(row[dateIndex]);
      if (!rawDate) continue;

      const current = dailySalesMap.get(rawDate) ?? { sales: 0, guests: 0 };
      if (netSalesValue !== null) {
        current.sales += netSalesValue;
      }
      if (guestsValue !== null) {
        current.guests += guestsValue;
      }
      dailySalesMap.set(rawDate, current);
    }
  }

  const roundCurrency = (value: number | null) =>
    value === null ? null : Number(value.toFixed(2));

  const netSalesTotal = netSalesSum !== null && netSalesCount > 0 ? roundCurrency(netSalesSum) : null;
  const guestsTotal = guestsSum !== null && guestsCount > 0 ? Math.round(guestsSum) : null;
  const tipsTotal = tipsSum !== null && tipsCount > 0 ? roundCurrency(tipsSum) : null;
  const laborTotal = laborSum !== null && laborCount > 0 ? roundCurrency(laborSum) : null;

  const ppa =
    netSalesTotal !== null && guestsTotal !== null && guestsTotal !== 0
      ? roundCurrency(netSalesTotal / guestsTotal)
      : null;
  const tipPercent =
    netSalesTotal !== null && netSalesTotal !== 0 && tipsTotal !== null
      ? roundCurrency((tipsTotal / netSalesTotal) * 100)
      : null;
  const laborPercent =
    netSalesTotal !== null && netSalesTotal !== 0 && laborTotal !== null
      ? roundCurrency((laborTotal / netSalesTotal) * 100)
      : null;

  const dailySales = Array.from(dailySalesMap.entries())
    .map(([date, values]) => ({
      date,
      sales: Number(values.sales.toFixed(2)),
      guests: values.guests,
    }))
    .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

  const ppaTrend = dailySales
    .filter((entry) => typeof entry.guests === "number" && entry.guests > 0)
    .map((entry) => ({
      date: entry.date,
      ppa: Number((entry.sales / entry.guests).toFixed(2)),
    }));

  return {
    kpis: {
      netSales: netSalesTotal,
      guests: guestsTotal,
      ppa,
      tipPercent,
      laborPercent,
    },
    chartData: {
      dailySales: dailySales.map(({ date, sales }) => ({ date, sales })),
      ppaTrend,
    },
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting pulse-upload function');
    
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const restaurantName = formData.get('restaurant_name') as string;
    const reportType = formData.get('report_type') as string;
    const period = formData.get('period') as string;
    const file = formData.get('file') as File;
    // Use authenticated user ID instead of trusting client-provided value
    const userId = user.id;

    console.log('Received upload:', { restaurantName, reportType, period, fileName: file?.name, userId });

    // Validate inputs
    if (!restaurantName || restaurantName.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Invalid restaurant name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['sales', 'labor', 'performance'].includes(reportType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid report type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!period || period.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Invalid period' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!file || file.size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'File required and must be under 10MB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return new Response(
        JSON.stringify({ error: 'Only CSV and Excel files allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store file in Supabase Storage
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageFileName = `${Date.now()}_${sanitizedFileName}`;
    const fileBuffer = await file.arrayBuffer();

    console.log('Uploading file to storage:', storageFileName);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('pulse-data')
      .upload(storageFileName, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('pulse-data')
      .getPublicUrl(storageFileName);

    console.log('File uploaded successfully:', publicUrl);

    const rows = await parseFileRows(fileName, fileBuffer);
    const metrics = computeMetrics(rows);

    console.log('Computed KPIs:', metrics.kpis);

    // Call OpenAI for analysis
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    const systemPrompt = Deno.env.get('PULSE_SYSTEM_PROMPT') || `You are a restaurant analytics expert. Analyze the provided KPIs and provide:
- A brief 2-3 sentence summary
- 3 key insights (bullet points)
- 3 actionable recommendations (bullet points)

Keep your response concise, data-driven, and actionable.`;

    console.log('Calling OpenAI for analysis');

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Analyze these restaurant metrics for ${restaurantName} (${period}):\n\nNet Sales: ${
              metrics.kpis.netSales !== null ? `$${metrics.kpis.netSales.toFixed(2)}` : 'unknown'
            }\nGuests: ${metrics.kpis.guests ?? 'unknown'}\nPPA: ${
              metrics.kpis.ppa !== null ? `$${metrics.kpis.ppa.toFixed(2)}` : 'unknown'
            }\nTip %: ${
              metrics.kpis.tipPercent !== null ? `${metrics.kpis.tipPercent.toFixed(2)}%` : 'unknown'
            }\nLabor %: ${
              metrics.kpis.laborPercent !== null ? `${metrics.kpis.laborPercent.toFixed(2)}%` : 'unknown'
            }`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiAnalysis = aiData.choices[0].message.content;

    console.log('AI analysis complete');

    // Parse AI response into structured format
    const analysisParts = aiAnalysis.split('\n').filter((l: string) => l.trim());
    const analysis = {
      summary: analysisParts.slice(0, 3).join(' '),
      insights: analysisParts.filter((l: string) => l.includes('•') || l.includes('-')).slice(0, 3),
      actions: analysisParts.filter((l: string) => l.includes('•') || l.includes('-')).slice(3, 6)
    };

    // Store in database
    const reportData: any = {
      restaurant_name: restaurantName,
      report_type: reportType,
      period: period,
      file_url: publicUrl,
      kpis: metrics.kpis,
      agent: analysis,
      chart_data: metrics.chartData,
      user_id: userId  // Always set from authenticated user
    };

    console.log('Inserting report into database');

    const { data: insertData, error: insertError } = await supabase
      .from('pulse_reports')
      .insert(reportData)
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    console.log('Report saved successfully:', insertData.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        report: insertData 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    // Log full details server-side only
    console.error('[pulse-upload] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    // Return generic message to client
    return new Response(
      JSON.stringify({ 
        error: 'Upload processing failed. Please try again or contact support if this persists.',
        requestId: crypto.randomUUID()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
