import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KPICard } from "@/components/KPICard";
import { DollarSign, Users, TrendingUp, Percent, Clock } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface ReportData {
  kpis: {
    netSales: number;
    guests: number;
    ppa: number;
    tipPercent: number;
    laborPercent: number;
  };
  agent: {
    summary: string;
    insights: string[];
    actions: string[];
  };
  chartData: {
    dailySales: Array<{ date: string; sales: number }>;
    ppaTrend: Array<{ date: string; ppa: number }>;
  };
}

const PulseReport = () => {
  const [reportData, setReportData] = useState<ReportData | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("latestReport");
    if (stored) {
      setReportData(JSON.parse(stored));
    }
  }, []);

  if (!reportData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="glass-panel p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">No Report Available</h2>
          <p className="text-muted-foreground mb-6">Upload your data to generate a report</p>
          <Link to="/">
            <Button>Go to Upload</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 glass-panel">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Pulse
            </h1>
            <div className="flex gap-4">
              <Link to="/">
                <Button variant="ghost">Upload</Button>
              </Link>
              <Link to="/report">
                <Button variant="default">Report</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="container max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h2 className="text-4xl font-bold mb-2">Performance Report</h2>
          <p className="text-muted-foreground">AI-powered analysis of your restaurant data</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
          <KPICard
            title="Net Sales"
            value={reportData.kpis.netSales}
            icon={DollarSign}
            format="currency"
          />
          <KPICard
            title="Guests"
            value={reportData.kpis.guests}
            icon={Users}
            format="number"
          />
          <KPICard
            title="PPA"
            value={reportData.kpis.ppa}
            icon={TrendingUp}
            format="currency"
          />
          <KPICard
            title="Tip %"
            value={reportData.kpis.tipPercent}
            icon={Percent}
            format="percentage"
          />
          <KPICard
            title="Labor %"
            value={reportData.kpis.laborPercent}
            icon={Clock}
            format="percentage"
          />
        </div>

        {/* AI Summary */}
        <Card className="glass-panel p-8 mb-12">
          <h3 className="text-2xl font-bold mb-4">Summary</h3>
          <p className="text-muted-foreground leading-relaxed">{reportData.agent.summary}</p>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Insights */}
          <Card className="glass-panel p-8">
            <h3 className="text-2xl font-bold mb-6">Key Insights</h3>
            <ul className="space-y-4">
              {reportData.agent.insights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                  <p className="text-muted-foreground">{insight}</p>
                </li>
              ))}
            </ul>
          </Card>

          {/* Actions */}
          <Card className="glass-panel p-8">
            <h3 className="text-2xl font-bold mb-6">Recommended Actions</h3>
            <ul className="space-y-4">
              {reportData.agent.actions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <p className="text-muted-foreground">{action}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="glass-panel p-8">
            <h3 className="text-xl font-bold mb-6">Daily Sales</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reportData.chartData.dailySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="glass-panel p-8">
            <h3 className="text-xl font-bold mb-6">PPA Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={reportData.chartData.ppaTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="ppa"
                  stroke="hsl(var(--accent))"
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--accent))", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PulseReport;
