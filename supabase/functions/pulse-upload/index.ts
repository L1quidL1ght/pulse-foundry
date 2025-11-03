import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

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
    const period = formData.get('period') as string;
    const files = formData.getAll('files') as File[];
    // Use authenticated user ID instead of trusting client-provided value
    const userId = user.id;

    console.log('Received upload:', { restaurantName, period, fileCount: files.length, userId });

    // Validate inputs
    if (!restaurantName || restaurantName.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Invalid restaurant name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!period || period.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Invalid period' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one file is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate each file
    for (const file of files) {
      if (!file || file.size > 10 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ error: 'Each file must be under 10MB' }),
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
    }

    // Process each file and collect parsed data
    const individualReports: any[] = [];
    const allDailyData = new Map<string, { sales: number; guests: number }>();
    let totalNetSales = 0;
    let totalGuests = 0;
    const allCategories = new Map<string, number>();

    for (const file of files) {
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

      // Parse file and compute KPIs
      const parsedBuffer = new Uint8Array(fileBuffer);
      const fileName = file.name.toLowerCase();
      let headers: string[] = [];
      let dataRows: any[] = [];
    
    // Helper function to find net sales column index (excludes gross)
    const findNetSalesColumnIndex = (headers: string[]): number => {
      const netPatterns = ['net sales', 'net', 'sales (net)', 'sales(net)'];
      
      // First, filter out any headers containing "gross"
      const filteredHeaders = headers.map((h, idx) => ({
        header: String(h || '').toLowerCase().trim(),
        index: idx,
        isGross: String(h || '').toLowerCase().includes('gross')
      }));
      
      // Find best match for net sales, excluding gross
      for (const pattern of netPatterns) {
        const match = filteredHeaders.find(h => 
          !h.isGross && h.header.includes(pattern)
        );
        if (match) return match.index;
      }
      
      // Fallback: find any "sales" column that isn't gross
      const salesMatch = filteredHeaders.find(h => 
        !h.isGross && h.header.includes('sales')
      );
      return salesMatch?.index ?? -1;
    };
    
    // Helper function to parse numeric value
    const parseNumeric = (val: any): number => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      const cleaned = String(val).replace(/[$,\s]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };
    
    // Helper to detect if a row is likely a header row
    const isHeaderRow = (row: any[]): boolean => {
      const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
      return rowStr.includes('sales') || rowStr.includes('guest') || 
             rowStr.includes('date') || rowStr.includes('day') ||
             rowStr.includes('category') || rowStr.includes('item');
    };
    
    // Parse based on file type
    if (fileName.endsWith('.csv')) {
      // Parse CSV
      const fileText = new TextDecoder().decode(parsedBuffer);
      const lines = fileText.split('\n').filter(l => l.trim());
      
      // Find header row
      let headerLineIdx = 0;
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const values = lines[i].split(',').map(h => h.trim());
        if (isHeaderRow(values)) {
          headerLineIdx = i;
          break;
        }
      }
      
      headers = lines[headerLineIdx].split(',').map(h => h.trim());
      dataRows = lines.slice(headerLineIdx + 1).map(line => {
        const values = line.split(',').map(v => v.trim());
        return values;
      });
    } else {
      // Parse Excel
      const workbook = XLSX.read(parsedBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
      if (jsonData.length === 0) {
        throw new Error('Excel file is empty');
      }
      
      // Find header row (skip metadata rows like restaurant name)
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i] as any[];
        if (row && row.length > 1 && isHeaderRow(row)) {
          headerRowIdx = i;
          break;
        }
      }
      
      headers = (jsonData[headerRowIdx] as any[]).map(h => String(h || ''));
      dataRows = jsonData.slice(headerRowIdx + 1).filter(row => 
        Array.isArray(row) && row.length > 0
      ) as any[][];
    }
      
      const netSalesIdx = findNetSalesColumnIndex(headers);
      
      console.log(`File: ${file.name}, Headers:`, headers);
      console.log('Using net sales column index:', netSalesIdx);
      
      if (netSalesIdx === -1) {
        console.warn(`Could not find net sales column in ${file.name}, skipping...`);
        continue;
      }
      
      // Parse data rows
      const parsedRows = dataRows.map(values => ({
        date: String(values[0] || ''),
        netSales: parseNumeric(values[netSalesIdx]),
        guests: values.length > netSalesIdx + 1 ? parseNumeric(values[netSalesIdx + 1]) : 0,
        category: values.length > 1 ? String(values[1] || '') : ''
      })).filter(row => row.netSales > 0 || row.guests > 0);
      
      console.log(`Parsed ${parsedRows.length} data rows from ${file.name}`);
      
      // Compute KPIs from this file
      const fileNetSales = parsedRows.reduce((sum, row) => sum + row.netSales, 0);
      const fileGuests = parsedRows.reduce((sum, row) => sum + row.guests, 0);
      const filePPA = fileGuests > 0 ? fileNetSales / fileGuests : 0;
      
      // Accumulate totals
      totalNetSales += fileNetSales;
      totalGuests += fileGuests;
      
      // Group by category
      const categoryMap = new Map<string, number>();
      parsedRows.forEach(row => {
        if (row.category && row.netSales > 0) {
          const current = categoryMap.get(row.category) || 0;
          categoryMap.set(row.category, current + row.netSales);
          
          const globalCurrent = allCategories.get(row.category) || 0;
          allCategories.set(row.category, globalCurrent + row.netSales);
        }
      });
      
      // Daily aggregation
      const dailyMap = new Map<string, { sales: number; guests: number }>();
      parsedRows.forEach(row => {
        if (row.date) {
          const current = dailyMap.get(row.date) || { sales: 0, guests: 0 };
          dailyMap.set(row.date, {
            sales: current.sales + row.netSales,
            guests: current.guests + row.guests
          });
          
          const globalCurrent = allDailyData.get(row.date) || { sales: 0, guests: 0 };
          allDailyData.set(row.date, {
            sales: globalCurrent.sales + row.netSales,
            guests: globalCurrent.guests + row.guests
          });
        }
      });
      
      // Store individual report data
      individualReports.push({
        fileName: file.name,
        fileUrl: publicUrl,
        kpis: {
          netSales: fileNetSales,
          guests: fileGuests,
          ppa: filePPA,
          categorySales: Object.fromEntries(categoryMap),
          dailySales: Array.from(dailyMap.entries()).map(([date, data]) => ({ date, sales: data.sales }))
        }
      });
    }

    // Compute unified KPIs across all files
    const avgPPA = totalGuests > 0 ? totalNetSales / totalGuests : 0;
    
    const unifiedKPIs = {
      netSales: totalNetSales,
      guests: totalGuests,
      ppa: avgPPA,
      tipPercent: 18.5, // Would need tip column in files
      laborPercent: 28.3, // Would need labor data in files
      categorySales: Object.fromEntries(allCategories),
      dailySales: Array.from(allDailyData.entries()).map(([date, data]) => ({ date, sales: data.sales })),
      ppaTrend: Array.from(allDailyData.entries()).map(([date, data]) => ({ 
        date, 
        ppa: data.guests > 0 ? data.sales / data.guests : 0 
      }))
    };

    console.log('Computed unified KPIs across all files:', unifiedKPIs);

    // Call OpenAI for analysis
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    const systemPrompt = Deno.env.get('PULSE_SYSTEM_PROMPT') || `You are a restaurant analytics expert. Analyze the provided KPIs and provide:
- A brief 2-3 sentence summary
- 3 key insights (bullet points)
- 3 actionable recommendations (bullet points)

Keep your response concise, data-driven, and actionable.`;

    console.log('Calling OpenAI for analysis');

    const filesContext = individualReports.map(r => `- ${r.fileName}: $${r.kpis.netSales.toFixed(2)} net sales, ${r.kpis.guests} guests`).join('\n');

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
            content: `Analyze these restaurant metrics for ${restaurantName} (${period}):\n\nTotal Net Sales: $${unifiedKPIs.netSales}\nTotal Guests: ${unifiedKPIs.guests}\nAverage PPA: $${unifiedKPIs.ppa}\nTip %: ${unifiedKPIs.tipPercent}%\nLabor %: ${unifiedKPIs.laborPercent}%\n\nFiles Analyzed:\n${filesContext}\n\nCategory Mix:\n${Object.entries(unifiedKPIs.categorySales).map(([cat, sales]) => `- ${cat}: $${sales}`).join('\n')}`
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

    // Store unified report in database
    const reportData: any = {
      restaurant_name: restaurantName,
      report_type: 'multi-file',
      period: period,
      file_url: individualReports.map(r => r.fileUrl).join(','),
      kpis: unifiedKPIs,
      agent: analysis,
      chart_data: {
        dailySales: unifiedKPIs.dailySales,
        ppaTrend: unifiedKPIs.ppaTrend,
        categoryMix: unifiedKPIs.categorySales,
        individualReports: individualReports
      },
      user_id: userId  // Always set from authenticated user
    };

    console.log('Inserting unified report into database');

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
