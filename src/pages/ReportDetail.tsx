import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Users, TrendingUp, Percent, Clock, Download, ArrowLeft, Loader2 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";

interface ReportData {
  id: string;
  restaurant_name: string;
  report_type: string;
  period: string;
  kpis: any;
  agent: any;
  chart_data: any;
  file_url: string;
  status: string;
  notes: string;
  created_at: string;
}

const ReportDetail = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchReport();
    }
  }, [user, id]);

  const fetchReport = async () => {
    try {
      const { data, error } = await supabase
        .from("pulse_reports")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast({
          title: "Report not found",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }
      
      setReport(data);
    } catch (error) {
      console.error("Error fetching report:", error);
      toast({
        title: "Error loading report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!report?.file_url) return;
    
    try {
      const { data, error } = await supabase.storage
        .from("pulse-data")
        .download(report.file_url.split("/").pop() || "");

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.restaurant_name}_${report.period}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download started",
      });
    } catch (error) {
      console.error("Error downloading file:", error);
      toast({
        title: "Error downloading file",
        variant: "destructive",
      });
    }
  };

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container max-w-7xl mx-auto px-6 pt-32 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-4xl font-bold">{report.restaurant_name}</h1>
            <p className="text-muted-foreground">
              {report.report_type} • {report.period}
            </p>
          </div>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download Raw Data
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {(() => {
            const availability = report.kpis?.available ?? {};
            const cards = [
              {
                key: "netSales",
                title: "Net Sales",
                icon: DollarSign,
                format: "currency" as const,
                available: availability.netSales ?? true,
              },
              {
                key: "guests",
                title: "Guest Count",
                icon: Users,
                format: "number" as const,
                available: availability.guests ?? true,
              },
              {
                key: "ppa",
                title: "Per Person Average",
                icon: TrendingUp,
                format: "currency" as const,
                available: availability.ppa ?? true,
              },
              {
                key: "tipPercent",
                title: "Tip Percentage",
                icon: Percent,
                format: "percentage" as const,
                available: availability.tipPercent ?? true,
              },
              {
                key: "laborPercent",
                title: "Labor Percentage",
                icon: Clock,
                format: "percentage" as const,
                available: availability.laborPercent ?? false,
              },
            ];

            const filtered = cards.filter(({ key, available }) => {
              const value = (report.kpis as Record<string, string | number | undefined>)[key];
              if (!available) return false;
              if (value === undefined || value === null) return false;
              if (typeof value === "string" && value.toUpperCase() === "N/A") return false;
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="glass-panel rounded-2xl p-6 md:col-span-2 lg:col-span-4 flex items-center justify-center text-muted-foreground">
                  No KPI data available for this upload.
                </div>
              );
            }

            return filtered.map(({ key, title, icon, format }) => (
              <KPICard
                key={key}
                title={title}
                value={(report.kpis as Record<string, string | number>)[key]}
                icon={icon}
                format={format}
              />
            ));
          })()}
        </div>

        <div className="glass-panel rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4">AI Analysis</h2>
          <p className="text-muted-foreground mb-6">{report.agent.summary}</p>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Key Insights</h3>
              <ul className="space-y-2">
                {report.agent.insights.map((insight: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Recommended Actions</h3>
              <ul className="space-y-2">
                {report.agent.actions.map((action: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {(() => {
            const availableCharts = report.chart_data?.availableCharts ?? {};
            const dailySalesAvailable = availableCharts.dailySales && report.chart_data.dailySales?.length;
            const ppaTrendAvailable = availableCharts.ppaTrend && report.chart_data.ppaTrend?.length;

            return (
              <>
                <div className="glass-panel rounded-2xl p-6">
                  <h3 className="text-xl font-bold mb-6">Daily Sales Trend</h3>
                  {dailySalesAvailable ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={report.chart_data.dailySales}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground">No daily sales data available.</p>
                  )}
                </div>

                <div className="glass-panel rounded-2xl p-6">
                  <h3 className="text-xl font-bold mb-6">PPA Trend</h3>
                  {ppaTrendAvailable ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={report.chart_data.ppaTrend}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Line type="monotone" dataKey="ppa" stroke="hsl(var(--primary))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground">No PPA data available.</p>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </main>
    </div>
  );
};

export default ReportDetail;
