import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

type CanonicalKey =
  | 'net_sales'
  | 'guests'
  | 'tips'
  | 'labor_cost'
  | 'labor_hours'
  | 'labor_percent'
  | 'date'
  | 'category'
  | 'item';

type DatasetType =
  | 'item_sales'
  | 'category_rollup'
  | 'daily_sales'
  | 'labor'
  | 'tips'
  | 'general_sales'
  | 'unknown';

type ColumnMeta = {
  original: string;
  normalized: string;
  index: number;
  isGross: boolean;
  canonical: CanonicalKey | null;
};

type DailyTotals = {
  netSales: number;
  guests: number;
  tips: number;
};

type NormalizedRow = {
  date: string | null;
  category: string | null;
  item: string | null;
  net_sales: number | null;
  guests: number | null;
  tips: number | null;
  labor_cost: number | null;
  labor_hours: number | null;
  labor_percent: number | null;
};

type ParsedFileData = {
  fileName: string;
  datasetType: DatasetType;
  headerMeta: ColumnMeta[];
  rowCount: number;
  presentKeys: Set<CanonicalKey>;
  normalizedSample: NormalizedRow[];
  metrics: {
    netSales: number;
    guests: number;
    tips: number;
    laborCost: number;
    laborHours: number;
    laborPercentSamples: number[];
    categories: Map<string, number>;
    daily: Map<string, DailyTotals>;
  };
};

type DatasetWithStorage = ParsedFileData & {
  storageFileName: string;
  publicUrl: string;
  contentType: string;
};

type CombinedDataset = {
  datasetType: DatasetType;
  metrics: {
    netSales: number;
    guests: number;
    tips: number;
    laborCost: number;
    laborHours: number;
    laborPercentSamples: number[];
    categories: Map<string, number>;
    daily: Map<string, DailyTotals>;
  };
  keys: Set<CanonicalKey>;
  files: DatasetWithStorage[];
  sampleRows: NormalizedRow[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HEADER_RULES: { key: CanonicalKey; patterns: RegExp[]; allowGross?: boolean }[] = [
  {
    key: 'net_sales',
    patterns: [
      /net\s*sales/,
      /sales\s*\(net\)/,
      /sales\s*net/,
      /net\s*revenue/,
      /\bnet\b.*sales/,
      /sales.*\bnet\b/,
    ],
    allowGross: false,
  },
  {
    key: 'tips',
    patterns: [
      /tips?/,
      /gratuity/,
      /service\s*charge/,
      /auto\s*grat/,
      /suggested\s*gratuity/,
    ],
  },
  {
    key: 'guests',
    patterns: [
      /guests?/,
      /covers?/,
      /pax/,
      /diners?/,
      /heads/,
    ],
  },
  {
    key: 'labor_cost',
    patterns: [
      /labor.*(cost|expense)/,
      /labor\s*total/,
      /payroll/,
      /wages/,
      /salary/,
      /compensation/,
    ],
  },
  {
    key: 'labor_hours',
    patterns: [
      /labor.*hours/,
      /hours\s*worked/,
      /staff\s*hours/,
      /hours\s*labor/,
      /scheduled\s*hours/,
    ],
  },
  {
    key: 'labor_percent',
    patterns: [
      /labor.*%/,
      /labor\s*(percent|percentage)/,
      /labor\s*cost\s*%/,
      /labor\s*%\s*of\s*sales/,
    ],
  },
  {
    key: 'date',
    patterns: [
      /business\s*date/,
      /service\s*date/,
      /date/,
      /\bday\b/,
      /trans\s*date/,
      /posted\s*date/,
    ],
  },
  {
    key: 'category',
    patterns: [
      /category/,
      /dept/,
      /department/,
      /segment/,
      /family/,
      /class/,
    ],
  },
  {
    key: 'item',
    patterns: [
      /item/,
      /menu\s*item/,
      /product/,
      /description/,
      /plu/,
      /sku/,
    ],
  },
];

const HEADER_HINTS = [
  'sales',
  'net',
  'guest',
  'cover',
  'tip',
  'labor',
  'category',
  'item',
  'date',
  'revenue',
  'hours',
];

const MAX_SAMPLE_ROWS = 50;

const normalizeHeader = (header: any): string =>
  String(header ?? '')
    .toLowerCase()
    .replace(/[\s_]+/g, ' ')
    .trim();

const normalizeTextCell = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length === 0 ? null : str;
};

const normalizeDateCell = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date && !isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }

  const str = String(value).trim();
  if (!str) return null;

  const parsed = new Date(str);
  if (!isNaN(parsed.valueOf())) {
    return parsed.toISOString().slice(0, 10);
  }

  return str;
};

const parseNumeric = (val: any): number | null => {
  if (val === null || val === undefined) return null;

  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }

  const str = String(val).trim();
  if (!str) return null;

  let cleaned = str.replace(/[$,%\s]/g, '');
  let multiplier = 1;

  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = cleaned.slice(1, -1);
    multiplier = -1;
  }

  cleaned = cleaned.replace(/,/g, '');

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num * multiplier;
};

const isMeaningfulRow = (row: any[]): boolean =>
  Array.isArray(row) && row.some((cell) => {
    if (cell === null || cell === undefined) return false;
    if (typeof cell === 'number') return !isNaN(cell);
    if (typeof cell === 'string') return cell.trim().length > 0;
    if (cell instanceof Date) return !isNaN(cell.valueOf());
    return true;
  });

const detectHeaderRow = (rows: any[][]): number => {
  let bestIndex = 0;
  let bestScore = -1;

  const limit = Math.min(rows.length, 25);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const normalizedCells = row.map((cell) => normalizeHeader(cell));
    const score = normalizedCells.reduce((total, cell) => {
      if (!cell) return total;
      const hits = HEADER_HINTS.filter((hint) => cell.includes(hint)).length;
      return total + hits;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
};

const buildColumnMeta = (headers: any[]): ColumnMeta[] =>
  headers.map((header, index) => {
    const normalized = normalizeHeader(header);
    return {
      original: String(header ?? ''),
      normalized,
      index,
      isGross: normalized.includes('gross'),
      canonical: null,
    };
  });

const assignCanonicalKeys = (meta: ColumnMeta[]): void => {
  for (const rule of HEADER_RULES) {
    for (const column of meta) {
      if (column.canonical) continue;
      if (!rule.allowGross && column.isGross) continue;

      if (rule.patterns.some((pattern) => pattern.test(column.normalized))) {
        column.canonical = rule.key;
      }
    }
  }

  const hasNetSales = meta.some((column) => column.canonical === 'net_sales');
  if (!hasNetSales) {
    const fallback = meta.find((column) => {
      if (column.isGross || column.canonical) return false;
      if (!column.normalized.includes('sales')) return false;
      if (/tax|discount|void|refund|credit/.test(column.normalized)) return false;
      return true;
    });

    if (fallback) {
      fallback.canonical = 'net_sales';
    }
  }
};

const detectDatasetType = (presentKeys: Set<CanonicalKey>): DatasetType => {
  const hasNet = presentKeys.has('net_sales');
  const hasCategory = presentKeys.has('category');
  const hasItem = presentKeys.has('item');
  const hasDate = presentKeys.has('date');
  const hasLabor =
    presentKeys.has('labor_cost') ||
    presentKeys.has('labor_hours') ||
    presentKeys.has('labor_percent');
  const hasTips = presentKeys.has('tips');

  if (hasLabor && !hasNet) return 'labor';
  if (hasLabor && hasNet) return 'labor';
  if (hasNet && hasItem) return 'item_sales';
  if (hasNet && hasCategory) return 'category_rollup';
  if (hasNet && hasDate) return 'daily_sales';
  if (hasTips && !hasNet) return 'tips';
  if (hasNet) return 'general_sales';
  if (hasTips) return 'tips';
  return 'unknown';
};

const parseDataset = (
  fileName: string,
  headers: any[],
  dataRows: any[][],
): ParsedFileData => {
  const headerMeta = buildColumnMeta(headers);
  assignCanonicalKeys(headerMeta);

  const indexByKey: Partial<Record<CanonicalKey, number>> = {};
  const presentKeys = new Set<CanonicalKey>();

  for (const column of headerMeta) {
    if (!column.canonical) continue;
    if (indexByKey[column.canonical] !== undefined) continue;
    indexByKey[column.canonical] = column.index;
    presentKeys.add(column.canonical);
  }

  const datasetType = detectDatasetType(presentKeys);

  const metrics = {
    netSales: 0,
    guests: 0,
    tips: 0,
    laborCost: 0,
    laborHours: 0,
    laborPercentSamples: [] as number[],
    categories: new Map<string, number>(),
    daily: new Map<string, DailyTotals>(),
  };

  const normalizedSample: NormalizedRow[] = [];

  for (const row of dataRows) {
    if (!isMeaningfulRow(row)) continue;

    const getNumeric = (key: CanonicalKey): number | null => {
      const idx = indexByKey[key];
      if (idx === undefined) return null;
      return parseNumeric(row[idx]);
    };

    const getText = (key: CanonicalKey): string | null => {
      const idx = indexByKey[key];
      if (idx === undefined) return null;
      return normalizeTextCell(row[idx]);
    };

    const getDate = (key: CanonicalKey): string | null => {
      const idx = indexByKey[key];
      if (idx === undefined) return null;
      return normalizeDateCell(row[idx]);
    };

    const netSales = getNumeric('net_sales');
    const guests = getNumeric('guests');
    const tips = getNumeric('tips');
    const laborCost = getNumeric('labor_cost');
    const laborHours = getNumeric('labor_hours');
    const laborPercent = getNumeric('labor_percent');
    const category = getText('category');
    const item = getText('item');
    const date = getDate('date');

    if (netSales !== null) {
      metrics.netSales += netSales;
    }
    if (guests !== null) {
      metrics.guests += guests;
    }
    if (tips !== null) {
      metrics.tips += tips;
    }
    if (laborCost !== null) {
      metrics.laborCost += laborCost;
    }
    if (laborHours !== null) {
      metrics.laborHours += laborHours;
    }
    if (laborPercent !== null) {
      metrics.laborPercentSamples.push(laborPercent);
    }

    if (category && netSales !== null) {
      const current = metrics.categories.get(category) ?? 0;
      metrics.categories.set(category, current + netSales);
    }

    if (date) {
      const current = metrics.daily.get(date) ?? { netSales: 0, guests: 0, tips: 0 };
      if (netSales !== null) current.netSales += netSales;
      if (guests !== null) current.guests += guests;
      if (tips !== null) current.tips += tips;
      metrics.daily.set(date, current);
    }

    const normalizedRow: NormalizedRow = {
      date,
      category,
      item,
      net_sales: netSales,
      guests,
      tips,
      labor_cost: laborCost,
      labor_hours: laborHours,
      labor_percent: laborPercent,
    };

    const hasAnyValue = Object.values(normalizedRow).some((value) => value !== null);
    if (hasAnyValue && normalizedSample.length < MAX_SAMPLE_ROWS) {
      normalizedSample.push(normalizedRow);
    }
  }

  return {
    fileName,
    datasetType,
    headerMeta,
    rowCount: dataRows.length,
    presentKeys,
    normalizedSample,
    metrics,
  };
};

const readRowsFromBuffer = (buffer: Uint8Array, fileName: string): any[][] => {
  try {
    if (fileName.toLowerCase().endsWith('.csv')) {
      const text = new TextDecoder().decode(buffer);
      const workbook = XLSX.read(text, { type: 'string' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as any[][];
    }

    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as any[][];
  } catch (error) {
    console.error('Failed to parse workbook:', error);
    throw new Error('Unable to parse uploaded file. Please ensure it is a valid CSV or Excel file.');
  }
};

const formatNumber = (value: number | null, decimals = 2): number | string => {
  if (value === null || !isFinite(value)) return 'N/A';
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

const formatCount = (value: number | null): number | string => {
  if (value === null || !isFinite(value)) return 'N/A';
  return Math.round(value);
};

const average = (values: number[]): number | null => {
  if (!values.length) return null;
  const sum = values.reduce((total, val) => total + val, 0);
  return sum / values.length;
};

const combineDatasets = (datasets: DatasetWithStorage[]): CombinedDataset => {
  const combinedKeys = new Set<CanonicalKey>();
  const categories = new Map<string, number>();
  const daily = new Map<string, DailyTotals>();
  const laborPercentSamples: number[] = [];
  const sampleRows: NormalizedRow[] = [];

  let netSales = 0;
  let guests = 0;
  let tips = 0;
  let laborCost = 0;
  let laborHours = 0;

  for (const dataset of datasets) {
    dataset.presentKeys.forEach((key) => combinedKeys.add(key));
    netSales += dataset.metrics.netSales;
    guests += dataset.metrics.guests;
    tips += dataset.metrics.tips;
    laborCost += dataset.metrics.laborCost;
    laborHours += dataset.metrics.laborHours;
    laborPercentSamples.push(...dataset.metrics.laborPercentSamples);

    dataset.metrics.categories.forEach((value, key) => {
      const current = categories.get(key) ?? 0;
      categories.set(key, current + value);
    });

    dataset.metrics.daily.forEach((value, key) => {
      const current = daily.get(key) ?? { netSales: 0, guests: 0, tips: 0 };
      current.netSales += value.netSales;
      current.guests += value.guests;
      current.tips += value.tips;
      daily.set(key, current);
    });

    for (const row of dataset.normalizedSample) {
      if (sampleRows.length >= MAX_SAMPLE_ROWS) break;
      sampleRows.push(row);
    }
  }

  return {
    datasetType: datasets[0].datasetType,
    metrics: {
      netSales,
      guests,
      tips,
      laborCost,
      laborHours,
      laborPercentSamples,
      categories,
      daily,
    },
    keys: combinedKeys,
    files: datasets,
    sampleRows,
  };
};

const pickDatasetWithKey = (
  combined: Map<DatasetType, CombinedDataset>,
  priorities: DatasetType[],
  key: CanonicalKey,
): CombinedDataset | undefined => {
  for (const type of priorities) {
    const dataset = combined.get(type);
    if (dataset && dataset.keys.has(key)) {
      return dataset;
    }
  }
  return undefined;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting pulse-upload function');

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: corsHeaders },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: corsHeaders },
      );
    }

    const formData = await req.formData();
    const restaurantName = (formData.get('restaurant_name') as string)?.trim();
    const reportTypeRaw = (formData.get('report_type') as string)?.trim().toLowerCase();
    const period = (formData.get('period') as string)?.trim();

    const incomingFiles: File[] = [];

    const directFile = formData.get('file');
    if (directFile instanceof File) {
      incomingFiles.push(directFile);
    }

    for (const key of ['files', 'file[]', 'reports']) {
      const files = formData.getAll(key);
      for (const value of files) {
        if (value instanceof File) {
          incomingFiles.push(value);
        }
      }
    }

    if (!restaurantName || restaurantName.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Invalid restaurant name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (period && period.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Invalid period' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!incomingFiles.length) {
      return new Response(
        JSON.stringify({ error: 'At least one file is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const invalidFile = incomingFiles.find((file) => file.size > 10 * 1024 * 1024);
    if (invalidFile) {
      return new Response(
        JSON.stringify({ error: `${invalidFile.name} exceeds the 10MB size limit` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const unsupported = incomingFiles.find((file) => {
      const lower = file.name.toLowerCase();
      return !allowedTypes.some((ext) => lower.endsWith(ext));
    });

    if (unsupported) {
      return new Response(
        JSON.stringify({ error: `${unsupported.name} is not a supported format (CSV, XLSX, XLS only)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const parsedDatasets: DatasetWithStorage[] = [];

    for (const file of incomingFiles) {
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageFileName = `${Date.now()}_${crypto.randomUUID()}_${sanitizedFileName}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      const rows = readRowsFromBuffer(buffer, file.name);
      if (!rows.length) {
        throw new Error(`${file.name} appears to be empty`);
      }

      const headerRowIndex = detectHeaderRow(rows);
      const headers = rows[headerRowIndex] ?? [];
      const dataRows = rows.slice(headerRowIndex + 1).filter((row) => isMeaningfulRow(row));

      if (!headers.length) {
        throw new Error(`Unable to determine headers for ${file.name}`);
      }

      const parsed = parseDataset(file.name, headers, dataRows);

      const { error: uploadError } = await supabase.storage
        .from('pulse-data')
        .upload(storageFileName, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Storage upload failed for ${file.name}: ${uploadError.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('pulse-data').getPublicUrl(storageFileName);

      parsedDatasets.push({
        ...parsed,
        storageFileName,
        publicUrl,
        contentType: file.type || 'application/octet-stream',
      });
    }

    if (!parsedDatasets.length) {
      throw new Error('No data could be parsed from the uploaded files');
    }

    const groupedByType = new Map<DatasetType, DatasetWithStorage[]>();
    for (const dataset of parsedDatasets) {
      const group = groupedByType.get(dataset.datasetType) ?? [];
      group.push(dataset);
      groupedByType.set(dataset.datasetType, group);
    }

    const combinedByType = new Map<DatasetType, CombinedDataset>();
    groupedByType.forEach((datasets, type) => {
      combinedByType.set(type, combineDatasets(datasets));
    });

    const netDataset = pickDatasetWithKey(
      combinedByType,
      ['item_sales', 'daily_sales', 'category_rollup', 'general_sales'],
      'net_sales',
    );
    const guestDataset = pickDatasetWithKey(
      combinedByType,
      ['item_sales', 'daily_sales', 'general_sales'],
      'guests',
    );
    const tipsDataset = pickDatasetWithKey(
      combinedByType,
      ['tips', 'item_sales', 'daily_sales', 'general_sales'],
      'tips',
    );
    const laborDataset = combinedByType.get('labor');
    const categoryDataset = pickDatasetWithKey(
      combinedByType,
      ['item_sales', 'category_rollup'],
      'category',
    );
    const dailyDataset = pickDatasetWithKey(
      combinedByType,
      ['daily_sales', 'item_sales', 'general_sales'],
      'date',
    );

    const totalNetSales = netDataset ? netDataset.metrics.netSales : null;
    const totalGuests = netDataset && netDataset.keys.has('guests')
      ? netDataset.metrics.guests
      : guestDataset && guestDataset.keys.has('guests')
      ? guestDataset.metrics.guests
      : null;
    const averagePPA = netDataset && netDataset.keys.has('guests') && netDataset.metrics.guests > 0
      ? netDataset.metrics.netSales / netDataset.metrics.guests
      : null;

    const totalTips = tipsDataset ? tipsDataset.metrics.tips : null;
    const tipPercentNumber = totalTips !== null && totalNetSales !== null && totalNetSales !== 0
      ? (totalTips / totalNetSales) * 100
      : null;

    const laborPercentFromSamples = laborDataset && laborDataset.metrics.laborPercentSamples.length
      ? average(laborDataset.metrics.laborPercentSamples)
      : null;
    const laborPercentFromCost = laborDataset && laborDataset.keys.has('labor_cost') && totalNetSales !== null && totalNetSales !== 0
      ? (laborDataset.metrics.laborCost / totalNetSales) * 100
      : null;
    const laborPercentNumber = laborPercentFromSamples ?? laborPercentFromCost;

    const categoryEntries = categoryDataset
      ? Array.from(categoryDataset.metrics.categories.entries()).filter(([, value]) => value !== 0)
      : [];
    categoryEntries.sort((a, b) => b[1] - a[1]);

    const dailyEntries = dailyDataset
      ? Array.from(dailyDataset.metrics.daily.entries()).sort(([dateA], [dateB]) => {
          if (dateA < dateB) return -1;
          if (dateA > dateB) return 1;
          return 0;
        })
      : [];

    const dailySalesData = dailyEntries.map(([date, totals]) => ({
      date,
      sales: Number(formatNumber(totals.netSales)),
    }));

    const ppaTrendData = dailyEntries
      .map(([date, totals]) => {
        if (totals.guests <= 0) return null;
        const ppa = totals.netSales / totals.guests;
        return { date, ppa: Number(formatNumber(ppa)) };
      })
      .filter((entry): entry is { date: string; ppa: number } => entry !== null);

    const categoryMixData = categoryEntries.map(([name, sales]) => ({
      category: name,
      sales: Number(formatNumber(sales)),
    }));

    const availableKpis = {
      netSales: totalNetSales !== null,
      guests: totalGuests !== null,
      ppa: averagePPA !== null,
      tipPercent: tipPercentNumber !== null,
      laborPercent: laborPercentNumber !== null,
      tips: totalTips !== null,
      laborCost: laborDataset ? laborDataset.keys.has('labor_cost') : false,
      laborHours: laborDataset ? laborDataset.keys.has('labor_hours') : false,
    };

    const availableCharts = {
      dailySales: dailySalesData.length > 0,
      ppaTrend: ppaTrendData.length > 0,
      categoryMix: categoryMixData.length > 0,
    };

    const numericTotals = {
      netSales: totalNetSales,
      guests: totalGuests,
      tips: totalTips,
      laborCost: laborDataset ? laborDataset.metrics.laborCost : null,
      laborHours: laborDataset ? laborDataset.metrics.laborHours : null,
    };

    const kpis = {
      netSales: formatNumber(totalNetSales),
      guests: formatCount(totalGuests),
      ppa: formatNumber(averagePPA),
      tipPercent: formatNumber(tipPercentNumber),
      laborPercent: formatNumber(laborPercentNumber),
      available: availableKpis,
      totals: numericTotals,
    };

    const datasetSummariesForStorage = parsedDatasets.map((dataset) => {
      const laborAverage = average(dataset.metrics.laborPercentSamples);
      return {
        fileName: dataset.fileName,
        storageFileName: dataset.storageFileName,
        publicUrl: dataset.publicUrl,
        contentType: dataset.contentType,
        datasetType: dataset.datasetType,
        rowCount: dataset.rowCount,
        presentColumns: Array.from(dataset.presentKeys),
        metrics: {
          netSales: formatNumber(dataset.metrics.netSales),
          guests: formatNumber(dataset.metrics.guests),
          tips: formatNumber(dataset.metrics.tips),
          laborCost: formatNumber(dataset.metrics.laborCost),
          laborHours: formatNumber(dataset.metrics.laborHours),
          laborPercentAverage: formatNumber(laborAverage),
        },
        categoryTotals: Array.from(dataset.metrics.categories.entries()).map(([name, value]) => ({
          category: name,
          sales: Number(formatNumber(value)),
        })),
        sampleRows: dataset.normalizedSample.map((row) => ({
          date: row.date,
          category: row.category,
          item: row.item,
          net_sales: formatNumber(row.net_sales),
          guests: formatNumber(row.guests, 3),
          tips: formatNumber(row.tips),
          labor_cost: formatNumber(row.labor_cost),
          labor_hours: formatNumber(row.labor_hours, 3),
          labor_percent: formatNumber(row.labor_percent),
        })),
      };
    });

    const sourceFiles = datasetSummariesForStorage.map((summary) => ({
      fileName: summary.fileName,
      publicUrl: summary.publicUrl,
      storageFileName: summary.storageFileName,
      contentType: summary.contentType,
      datasetType: summary.datasetType,
      rowCount: summary.rowCount,
    }));

    const numericNet = typeof kpis.netSales === 'number' ? kpis.netSales : null;
    const numericGuests = typeof kpis.guests === 'number' ? kpis.guests : null;
    const numericPpa = typeof kpis.ppa === 'number' ? kpis.ppa : null;
    const numericTipPercent = typeof kpis.tipPercent === 'number' ? kpis.tipPercent : null;
    const numericLaborPercent = typeof kpis.laborPercent === 'number' ? kpis.laborPercent : null;

    const metricLines: string[] = [];
    if (numericNet !== null) metricLines.push(`Net Sales: $${numericNet}`);
    if (numericGuests !== null) metricLines.push(`Guests: ${numericGuests}`);
    if (numericPpa !== null) metricLines.push(`PPA: $${numericPpa}`);
    if (numericTipPercent !== null) metricLines.push(`Tip %: ${numericTipPercent}%`);
    if (numericLaborPercent !== null) metricLines.push(`Labor %: ${numericLaborPercent}%`);

    const categoryLines = categoryMixData.length
      ? categoryMixData.map((entry) => `- ${entry.category}: $${entry.sales}`).join('\n')
      : 'Category mix unavailable';

    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    const systemPrompt = Deno.env.get('PULSE_SYSTEM_PROMPT')
      || `You are a restaurant analytics expert. Analyze the provided metrics and provide:
- A brief 2-3 sentence summary
- 3 key insights (bullet points)
- 3 actionable recommendations (bullet points)

Only use the supplied data. If a metric is missing, note it as unavailable.`;

    let analysis = {
      summary: 'AI analysis unavailable.',
      insights: [] as string[],
      actions: [] as string[],
    };

    if (openAIKey) {
      try {
        const aiPayload = {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Analyze these restaurant metrics for ${restaurantName} (${period || 'unspecified period'}). Use only the data provided and mark missing metrics as unavailable.\n\n${metricLines.length ? metricLines.join('\n') : 'No metrics available.'}\n\nCategory Mix:\n${categoryLines}`,
            },
          ],
        };

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(aiPayload),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('OpenAI API error:', errorText);
          throw new Error(`OpenAI API failed: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const aiText: string = aiData.choices?.[0]?.message?.content ?? '';
        const lines = aiText.split('\n').map((line: string) => line.trim()).filter((line: string) => line);

        analysis = {
          summary: lines.slice(0, 3).join(' '),
          insights: lines.filter((line) => line.startsWith('-') || line.startsWith('•')).slice(0, 3),
          actions: lines.filter((line) => line.startsWith('-') || line.startsWith('•')).slice(3, 6),
        };
      } catch (error) {
        console.error('AI analysis error:', error);
        analysis = {
          summary: 'AI analysis unavailable due to an upstream error.',
          insights: [],
          actions: [],
        };
      }
    }

    const chartData = {
      dailySales: dailySalesData,
      ppaTrend: ppaTrendData,
      categoryMix: categoryMixData,
      availableCharts,
      availableKpis,
      sourceFiles,
      datasets: datasetSummariesForStorage,
    };

    const combinedTypes = Array.from(combinedByType.keys()).filter((type) => type !== 'unknown');
    const autoReportType = combinedTypes.length === 1 ? combinedTypes[0] : 'multi';
    const finalReportType = reportTypeRaw && ['sales', 'labor', 'performance', 'multi'].includes(reportTypeRaw)
      ? reportTypeRaw
      : autoReportType;

    const primaryFileUrl = sourceFiles[0]?.publicUrl ?? null;

    const reportData: Record<string, unknown> = {
      restaurant_name: restaurantName,
      report_type: finalReportType,
      period: period || 'Unspecified',
      file_url: primaryFileUrl,
      kpis,
      agent: analysis,
      chart_data: chartData,
      user_id: user.id,
    };

    console.log('Inserting combined report for user', user.id);

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
        report: insertData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[pulse-upload] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        error: 'Upload processing failed. Please try again or contact support if this persists.',
        requestId: crypto.randomUUID(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

