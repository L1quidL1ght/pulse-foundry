import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  DollarSign,
  Users,
  TrendingUp,
  Percent,
  Clock,
  Download,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type ParsedReport = Tables<"pulse_reports"> & {
  kpis: Record<string, unknown>;
  agent: Record<string, unknown>;
  chart_data: Record<string, unknown>;
};

const parseJsonField = <T,>(field: unknown, fallback: T): T => {
  if (!field && field !== 0) return fallback;

  if (typeof field === "string") {
    try {
      return JSON.parse(field) as T;
    } catch (error) {
      console.warn("Failed to parse JSON field", error);
      return fallback;
    }
  }

  if (typeof field === "object" && field !== null) {
    return field as T;
  }

  return fallback;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const resolveStoragePath = (fileUrl: string) => {
  if (!fileUrl) return "";

  if (fileUrl.startsWith("http")) {
    const marker = "/storage/v1/object/";
    const index = fileUrl.indexOf(marker);

    if (index !== -1) {
      const relative = fileUrl.slice(index + marker.length);
      const parts = relative.split("/").filter(Boolean);

      // Strip possible "public" | "authenticated" prefix and bucket name
      if (parts[0] === "public" || parts[0] === "authenticated") {
        parts.shift();
      }
      if (parts[0] === "pulse-data") {
        parts.shift();
      }

      return parts.join("/");
    }
  }

  return fileUrl;
};

const formatStatus = (status?: string | null) => {
  if (!status) return { label: "Pending", tone: "bg-yellow-500/20 text-yellow-300" };

  switch (status) {
    case "processing":
      return { label: "Processing", tone: "bg-blue-500/20 text-blue-300" };
    case "approved":
      return { label: "Approved", tone: "bg-emerald-500/20 text-emerald-300" };
    case "rejected":
      return { label: "Needs Review", tone: "bg-red-500/20 text-red-300" };
    default:
      return { label: status, tone: "bg-muted/20 text-muted-foreground" };
  }
};

const ReportDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const {
    data: report,
    isLoading,
    error,
  } = useQuery<ParsedReport | null>({
    queryKey: ["report", id, user?.id],
    enabled: !!id && !!user,
    retry: false,
    queryFn: async () => {
      if (!id || !user) return null;

      const { data, error: fetchError } = await supabase
        .from("pulse_reports")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        const notFoundError = new Error("Report not found");
        notFoundError.name = "NotFound";
        throw notFoundError;
      }

      const parsed: ParsedReport = {
        ...data,
        kpis: parseJsonField<Record<string, unknown>>(data.kpis, {}),
        agent: parseJsonField<Record<string, unknown>>(data.agent, {}),
        chart_data: parseJsonField<Record<string, unknown>>(data.chart_data, {}),
      };

      return parsed;
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Unable to load report";
      toast({
        title: "Unable to open report",
        description: message,
        variant: "destructive",
      });
      navigate("/reports");
    }
  }, [error, navigate, toast]);

  const kpis = useMemo(() => {
    if (!report) {
      return {
        netSales: 0,
        guests: 0,
        ppa: 0,
        tipPercent: 0,
        laborPercent: 0,
      };
    }

    const data = report.kpis;

    return {
      netSales: toNumber(data.netSales ?? data.net_sales ?? data.totalSales),
      guests: toNumber(data.guests ?? data.guestCount ?? data.guest_count),
      ppa: toNumber(data.ppa ?? data.perPersonAverage ?? data.per_person_average),
      tipPercent: toNumber(data.tipPercent ?? data.tip_percent),
      laborPercent: toNumber(data.laborPercent ?? data.labor_percent),
    };
  }, [report]);

  const agent = useMemo(() => {
    const defaults = {
      summary: "No AI insights are available for this report yet.",
      insights: [] as string[],
      actions: [] as string[],
    };

    if (!report) return defaults;

    const raw = report.agent;
    const summary = typeof raw.summary === "string" && raw.summary.trim().length > 0 ? raw.summary : defaults.summary;
    const insights = Array.isArray(raw.insights)
      ? (raw.insights.filter((item): item is string => typeof item === "string") as string[])
      : defaults.insights;
    const actions = Array.isArray(raw.actions)
      ? (raw.actions.filter((item): item is string => typeof item === "string") as string[])
      : defaults.actions;

    return { summary, insights, actions };
  }, [report]);

  const chartData = useMemo(() => {
    if (!report) {
      return { dailySales: [] as Array<{ date: string; sales: number }>, ppaTrend: [] as Array<{ date: string; ppa: number }> };
    }

    const raw = report.chart_data;
    const toDailySales = Array.isArray(raw.dailySales)
      ? raw.dailySales
      : Array.isArray(raw.daily_sales)
      ? raw.daily_sales
      : [];

    const toPpaTrend = Array.isArray(raw.ppaTrend)
      ? raw.ppaTrend
      : Array.isArray(raw.ppa_trend)
      ? raw.ppa_trend
      : [];

    const normalisedDailySales = (toDailySales as Array<Record<string, unknown>>).map((entry) => ({
      date: typeof entry.date === "string" ? entry.date : String(entry.date ?? ""),
      sales: toNumber(entry.sales ?? entry.value ?? entry.netSales ?? entry.net_sales),
    }));

    const normalisedPpaTrend = (toPpaTrend as Array<Record<string, unknown>>).map((entry) => ({
      date: typeof entry.date === "string" ? entry.date : String(entry.date ?? ""),
      ppa: toNumber(entry.ppa ?? entry.value ?? entry.amount),
    }));

    return {
      dailySales: normalisedDailySales,
      ppaTrend: normalisedPpaTrend,
    };
  }, [report]);

  const handleDownload = async () => {
    if (!report?.file_url) return;

    try {
      const storagePath = resolveStoragePath(report.file_url);
      const { data, error: downloadError } = await supabase.storage
        .from("pulse-data")
        .download(storagePath);

      if (downloadError) {
        throw downloadError;
      }

      const blobUrl = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `${report.restaurant_name ?? "report"}_${report.period ?? "data"}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);

      toast({
        title: "Download started",
        description: "Your original upload is on its way.",
      });
    } catch (downloadError) {
      console.error("Error downloading file:", downloadError);
      toast({
        title: "Download failed",
        description: "We couldn\'t download that file. Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  if (authLoading || isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const statusBadge = formatStatus(report.status);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container max-w-7xl mx-auto px-6 pt-32 pb-16 space-y-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <Button variant="ghost" onClick={() => navigate("/reports")} className="mb-6 w-fit">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to reports
            </Button>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h1 className="text-4xl font-semibold">{report.restaurant_name ?? "Report"}</h1>
              {report.report_type && (
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {report.report_type}
                </Badge>
              )}
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge.tone}`}>
                {statusBadge.label}
              </span>
            </div>
            <p className="text-muted-foreground">
              {report.period ?? "Unspecified period"} • {report.created_at ? format(new Date(report.created_at), "MMM d, yyyy") : "Uploaded date unknown"}
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto">
            <Button onClick={handleDownload} className="w-full md:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Download raw data
            </Button>
            {report.notes && (
              <div className="glass-panel rounded-xl p-4 text-sm text-muted-foreground">
                <p className="uppercase text-[0.65rem] tracking-[0.35em] text-primary mb-2">Operator notes</p>
                <p>{report.notes}</p>
              </div>
            )}
          </div>
        </div>

        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard title="Net Sales" value={kpis.netSales} icon={DollarSign} format="currency" />
            <KPICard title="Guest Count" value={kpis.guests} icon={Users} format="number" />
            <KPICard title="Per Person Avg." value={kpis.ppa} icon={TrendingUp} format="currency" />
            <KPICard title="Tip Percentage" value={kpis.tipPercent} icon={Percent} format="percentage" />
            <KPICard title="Labor Percentage" value={kpis.laborPercent} icon={Clock} format="percentage" />
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-8 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold mb-3">AI Analysis</h2>
            <p className="text-muted-foreground leading-relaxed">{agent.summary}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm uppercase tracking-[0.35em] text-primary mb-4">Key Insights</h3>
              {agent.insights.length ? (
                <ul className="space-y-3">
                  {agent.insights.map((insight, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-1">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No insights have been generated yet.</p>
              )}
            </div>

            <div>
              <h3 className="text-sm uppercase tracking-[0.35em] text-secondary mb-4">Recommended Actions</h3>
              {agent.actions.length ? (
                <ul className="space-y-3">
                  {agent.actions.map((action, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-secondary mt-1">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No recommended actions available yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-8">
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-sm uppercase tracking-[0.35em] text-muted-foreground/80 mb-4">Daily Sales Trend</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData.dailySales}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                  }}
                />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-sm uppercase tracking-[0.35em] text-muted-foreground/80 mb-4">PPA Trend</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData.ppaTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                  }}
                />
                <Line type="monotone" dataKey="ppa" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ReportDetail;
