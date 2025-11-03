import {
  DollarSign,
  Users,
  TrendingUp,
  Percent,
  Clock,
  Tag,
  BarChart3,
  ShoppingCart,
  Receipt,
  TrendingDown,
  LucideIcon,
} from "lucide-react";

// Extract all numeric KPIs from the kpis object
export const extractNumericKPIs = (kpis: any): Array<{ key: string; value: number }> => {
  if (!kpis) return [];
  
  const numericKPIs: Array<{ key: string; value: number }> = [];
  
  Object.entries(kpis).forEach(([key, value]) => {
    // Only include numeric values, exclude objects and arrays
    if (typeof value === "number" && !isNaN(value)) {
      numericKPIs.push({ key, value });
    }
  });
  
  return numericKPIs;
};

// Map KPI field names to Lucide icons
export const mapKPIToIcon = (key: string): LucideIcon => {
  const lowerKey = key.toLowerCase();
  
  if (lowerKey.includes("sales") || lowerKey.includes("revenue") || lowerKey.includes("income")) {
    return DollarSign;
  }
  if (lowerKey.includes("guest") || lowerKey.includes("cover") || lowerKey.includes("customer")) {
    return Users;
  }
  if (lowerKey.includes("ppa") || lowerKey.includes("average") || lowerKey.includes("avg")) {
    return TrendingUp;
  }
  if (lowerKey.includes("tip") && lowerKey.includes("percent")) {
    return Percent;
  }
  if (lowerKey.includes("labor") || lowerKey.includes("hours") || lowerKey.includes("wage")) {
    return Clock;
  }
  if (lowerKey.includes("discount") || lowerKey.includes("comp") || lowerKey.includes("promo")) {
    return Tag;
  }
  if (lowerKey.includes("void") || lowerKey.includes("refund")) {
    return TrendingDown;
  }
  if (lowerKey.includes("item") || lowerKey.includes("product")) {
    return ShoppingCart;
  }
  if (lowerKey.includes("check") || lowerKey.includes("transaction")) {
    return Receipt;
  }
  
  return BarChart3;
};

// Determine the format type based on field name
export const mapKPIToFormat = (key: string): "currency" | "percentage" | "number" => {
  const lowerKey = key.toLowerCase();
  
  if (lowerKey.includes("percent") || lowerKey.includes("percentage") || lowerKey.includes("%")) {
    return "percentage";
  }
  if (
    lowerKey.includes("sales") ||
    lowerKey.includes("revenue") ||
    lowerKey.includes("cost") ||
    lowerKey.includes("tip") ||
    lowerKey.includes("labor") ||
    lowerKey.includes("discount") ||
    lowerKey.includes("ppa") ||
    lowerKey.includes("check") ||
    lowerKey.includes("average") ||
    lowerKey.includes("avg") ||
    lowerKey.includes("income") ||
    lowerKey.includes("wage")
  ) {
    return "currency";
  }
  
  return "number";
};

// Convert camelCase to human-readable title
export const humanizeFieldName = (key: string): string => {
  // Special cases
  const specialCases: Record<string, string> = {
    ppa: "Per Person Average",
    netSales: "Net Sales",
    tipPercent: "Tip %",
    laborPercent: "Labor %",
    avgCheck: "Average Check",
  };
  
  if (specialCases[key]) {
    return specialCases[key];
  }
  
  // Convert camelCase to Title Case
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

// Extract chartable data from chart_data object
export const extractChartableData = (
  chartData: any
): Array<{ key: string; data: any[]; type: "bar" | "line" | "pie" }> => {
  if (!chartData) return [];
  
  const chartableData: Array<{ key: string; data: any[]; type: "bar" | "line" | "pie" }> = [];
  
  Object.entries(chartData).forEach(([key, value]) => {
    // Skip individualReports as it's handled separately
    if (key === "individualReports") return;
    
    // Handle arrays
    if (Array.isArray(value) && value.length > 0) {
      const chartType = determineChartType(value, key);
      chartableData.push({ key, data: value, type: chartType });
    }
    
    // Handle objects (category data)
    if (typeof value === "object" && !Array.isArray(value) && value !== null) {
      const entries = Object.entries(value);
      if (entries.length > 0 && typeof entries[0][1] === "number") {
        const pieData = entries.map(([name, val]) => ({ name, value: val }));
        chartableData.push({ key, data: pieData, type: "pie" });
      }
    }
  });
  
  return chartableData;
};

// Determine the appropriate chart type based on data structure
export const determineChartType = (data: any[], key: string): "bar" | "line" | "pie" => {
  const lowerKey = key.toLowerCase();
  
  // Check if it's a trend (line chart)
  if (lowerKey.includes("trend") || lowerKey.includes("ppa")) {
    return "line";
  }
  
  // Check first item structure
  if (data.length > 0 && typeof data[0] === "object") {
    const firstItem = data[0];
    
    // If it has 'date' and numeric field, it's a time series (bar chart)
    if (firstItem.date && (firstItem.sales || firstItem.value)) {
      return "bar";
    }
    
    // If it has 'name' and 'value', it could be pie
    if (firstItem.name && typeof firstItem.value === "number") {
      return "pie";
    }
  }
  
  return "bar";
};

// Determine the data key for a chart
export const determineDataKey = (key: string): string => {
  const lowerKey = key.toLowerCase();
  
  if (lowerKey.includes("ppa")) return "ppa";
  if (lowerKey.includes("sales")) return "sales";
  if (lowerKey.includes("guest")) return "guests";
  if (lowerKey.includes("category") || lowerKey.includes("mix")) return "value";
  
  return "value";
};

// Determine the name key for a chart
export const determineNameKey = (key: string): string => {
  const lowerKey = key.toLowerCase();
  
  if (lowerKey.includes("daily") || lowerKey.includes("trend")) return "date";
  if (lowerKey.includes("category") || lowerKey.includes("mix")) return "name";
  
  return "name";
};
