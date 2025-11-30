import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { KPICard } from "@/components/KPICard";
import { DynamicChart } from "@/components/DynamicChart";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download, ArrowLeft, Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  extractNumericKPIs,
  mapKPIToIcon,
  mapKPIToFormat,
  humanizeFieldName,
  extractChartableData,
  determineDataKey,
  determineNameKey,
} from "@/utils/reportRenderer";

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
    // Skip auth check in dev mode
    if (import.meta.env.DEV) return;
    
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
          {extractNumericKPIs(report.kpis).map(({ key, value }) => (
            <KPICard
              key={key}
              title={humanizeFieldName(key)}
              value={value}
              icon={mapKPIToIcon(key)}
              format={mapKPIToFormat(key)}
            />
          ))}
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

        {report.chart_data.individualReports && report.chart_data.individualReports.length > 0 && (
          <div className="glass-panel rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">Reports Included</h2>
            <div className="grid gap-4">
              {report.chart_data.individualReports.map((fileReport: any, idx: number) => (
                <div key={idx} className="glass-panel rounded-xl p-6 border border-primary/20">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <FileText className="h-5 w-5 text-primary mt-1" />
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2">{fileReport.fileName}</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Net Sales</p>
                            <p className="font-semibold">${fileReport.kpis.netSales.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Guests</p>
                            <p className="font-semibold">{fileReport.kpis.guests}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">PPA</p>
                            <p className="font-semibold">${fileReport.kpis.ppa.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {extractChartableData(report.chart_data).length > 0 && (
          <div className="grid md:grid-cols-2 gap-8">
            {extractChartableData(report.chart_data).map(({ key, data, type }) => (
              <DynamicChart
                key={key}
                title={humanizeFieldName(key)}
                data={data}
                chartType={type}
                dataKey={determineDataKey(key)}
                nameKey={determineNameKey(key)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ReportDetail;
