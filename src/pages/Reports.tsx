import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, TrendingUp, Users, DollarSign, Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ReportKPIs {
  net_sales?: number;
  guests?: number;
  ppa?: number;
  tip_pct?: number;
  labor_pct?: number;
}

interface Report {
  id: string;
  restaurant_name: string;
  report_type: string;
  period: string;
  created_at: string;
  status: string;
  kpis: ReportKPIs;
}

const Reports = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchReports();
    }
  }, [user]);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from("pulse_reports")
        .select("id, restaurant_name, report_type, period, created_at, status, kpis")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports((data || []) as Report[]);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return "—";
    return `$${value.toLocaleString()}`;
  };

  const formatPercentage = (value?: number) => {
    if (value === undefined || value === null) return "—";
    return `${value.toFixed(1)}%`;
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container max-w-7xl mx-auto px-6 pt-32 pb-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Reports Dashboard</h1>
          <p className="text-muted-foreground">View and analyze all your uploaded reports</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-panel rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-muted/20 rounded mb-4 w-3/4" />
                <div className="h-4 bg-muted/20 rounded mb-6 w-1/2" />
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="h-12 bg-muted/20 rounded" />
                  <div className="h-12 bg-muted/20 rounded" />
                  <div className="h-12 bg-muted/20 rounded" />
                </div>
                <div className="h-9 bg-muted/20 rounded" />
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Reports Yet</h2>
            <p className="text-muted-foreground mb-6">
              Upload your first report to get started with Pulse analytics
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => (
              <div
                key={report.id}
                className="glass-panel rounded-2xl p-6 hover:border-primary/30 hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                onClick={() => navigate(`/report/${report.id}`)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold truncate mb-1">
                      {report.restaurant_name}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {report.report_type}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Subheader */}
                <div className="text-xs text-muted-foreground/60 mb-6 space-y-1">
                  <p className="uppercase tracking-wider">{report.period}</p>
                  <p>{format(new Date(report.created_at), "MMM d, yyyy")}</p>
                </div>

                {/* Quick KPIs */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground/60" />
                      <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">Sales</p>
                    </div>
                    <p className="text-sm font-semibold">{formatCurrency(report.kpis?.net_sales)}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingUp className="h-3 w-3 text-muted-foreground/60" />
                      <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">PPA</p>
                    </div>
                    <p className="text-sm font-semibold">{formatCurrency(report.kpis?.ppa)}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Percent className="h-3 w-3 text-muted-foreground/60" />
                      <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">Tips</p>
                    </div>
                    <p className="text-sm font-semibold">{formatPercentage(report.kpis?.tip_pct)}</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    report.status === 'approved' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {report.status}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-xs group-hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/report/${report.id}`);
                    }}
                  >
                    View Details →
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Reports;
