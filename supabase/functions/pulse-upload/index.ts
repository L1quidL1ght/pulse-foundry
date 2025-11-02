import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting pulse-upload function');
    
    const formData = await req.formData();
    const restaurantName = formData.get('restaurant_name') as string;
    const reportType = formData.get('report_type') as string;
    const period = formData.get('period') as string;
    const file = formData.get('file') as File;
    const userId = formData.get('user_id') as string | null;

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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Parse file and compute KPIs (simplified mock data for now)
    const fileText = await file.text();
    const lines = fileText.split('\n').filter(l => l.trim());
    
    // Mock KPI computation (in production, parse CSV/Excel properly)
    const mockKPIs = {
      netSales: 125430.50,
      guests: 1247,
      ppa: 100.58,
      tipPercent: 18.5,
      laborPercent: 28.3,
      categorySales: {
        'Food': 75000,
        'Beverage': 35000,
        'Desserts': 15430.50
      },
      dailySales: Array.from({ length: 7 }, (_, i) => ({
        date: `2024-11-${String(i + 1).padStart(2, '0')}`,
        sales: 15000 + Math.random() * 5000
      })),
      ppaTrend: Array.from({ length: 7 }, (_, i) => ({
        date: `2024-11-${String(i + 1).padStart(2, '0')}`,
        ppa: 95 + Math.random() * 15
      }))
    };

    console.log('Computed KPIs:', mockKPIs);

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
            content: `Analyze these restaurant metrics for ${restaurantName} (${period}):\n\nNet Sales: $${mockKPIs.netSales}\nGuests: ${mockKPIs.guests}\nPPA: $${mockKPIs.ppa}\nTip %: ${mockKPIs.tipPercent}%\nLabor %: ${mockKPIs.laborPercent}%\n\nCategory Mix:\n${Object.entries(mockKPIs.categorySales).map(([cat, sales]) => `- ${cat}: $${sales}`).join('\n')}`
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
      kpis: mockKPIs,
      agent: analysis,
      chart_data: {
        dailySales: mockKPIs.dailySales,
        ppaTrend: mockKPIs.ppaTrend,
        categoryMix: mockKPIs.categorySales
      }
    };
    
    // Add user_id if provided (for authenticated uploads)
    if (userId) {
      reportData.user_id = userId;
    }

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
    console.error('Error in pulse-upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Upload processing failed';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
