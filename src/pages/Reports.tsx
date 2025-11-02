import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, Eye, UploadCloud, BarChart2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

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

const Reports = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const {
    data: reports,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["reports", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("pulse_reports")
        .select("id, restaurant_name, report_type, period, created_at, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []) as Array<Pick<Tables<"pulse_reports">, "id" | "restaurant_name" | "report_type" | "period" | "created_at" | "status">>;
    },
    enabled: !!user,
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (isError) {
      toast({
        title: "Unable to load reports",
        description: "Please try again in a few moments.",
        variant: "destructive",
      });
    }
  }, [isError, toast]);

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

      <main className="container max-w-7xl mx-auto px-6 pt-32 pb-16 space-y-10">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-primary/80">Pulse Reports</p>
            <h1 className="text-4xl font-semibold text-foreground mt-2">History & Insights</h1>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Review every report you&apos;ve generated, revisit AI guidance, and keep your team aligned on performance.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => refetch()} className="glass-panel border-primary/30">
              <BarChart2 className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => navigate("/dashboard")}> 
              <UploadCloud className="h-4 w-4 mr-2" />
              New Upload
            </Button>
          </div>
        </section>

        <section className="glass-panel rounded-2xl">
          <div className="px-6 py-5 border-b border-primary/10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Report Archive</h2>
              <p className="text-sm text-muted-foreground">Sorted by most recent uploads</p>
            </div>
            <Badge variant="outline" className="rounded-full border-primary/30 text-xs uppercase tracking-wide">
              {reports?.length ?? 0} total
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !reports?.length ? (
            <div className="py-20 text-center space-y-4">
              <p className="text-muted-foreground">No reports yet. Start by uploading your sales data.</p>
              <Button onClick={() => navigate("/dashboard")}>Start an Upload</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-primary/10">
                    <TableHead className="text-muted-foreground/70">Restaurant</TableHead>
                    <TableHead className="text-muted-foreground/70">Report Type</TableHead>
                    <TableHead className="text-muted-foreground/70">Period</TableHead>
                    <TableHead className="text-muted-foreground/70">Created</TableHead>
                    <TableHead className="text-muted-foreground/70">Status</TableHead>
                    <TableHead className="text-right text-muted-foreground/70">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => {
                    const status = formatStatus(report.status);

                    return (
                      <TableRow key={report.id} className="border-primary/5 hover:bg-primary/5 transition-colors">
                        <TableCell className="font-medium">{report.restaurant_name ?? "—"}</TableCell>
                        <TableCell>{report.report_type ?? "—"}</TableCell>
                        <TableCell>{report.period ?? "—"}</TableCell>
                        <TableCell>
                          {report.created_at ? format(new Date(report.created_at), "MMM d, yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.tone}`}>
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary"
                            onClick={() => navigate(`/report/${report.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Reports;
