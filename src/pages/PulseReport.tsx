import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/KPICard";
import { DollarSign, Users, TrendingUp, Percent, Clock } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="glass-panel rounded-2xl p-8 text-center max-w-md">
          <p className="text-muted-foreground mb-6">No data</p>
          <Link to="/">
            <Button className="rounded-xl px-6 py-2 bg-primary hover:bg-primary/90 text-black font-semibold">
              Upload
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container max-w-7xl mx-auto px-6 pt-32 pb-12">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
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
            title="Tips"
            value={reportData.kpis.tipPercent}
            icon={Percent}
            format="percentage"
          />
          <KPICard
            title="Labor"
            value={reportData.kpis.laborPercent}
            icon={Clock}
            format="percentage"
          />
        </div>

        {/* AI Summary */}
        <div className="glass-panel rounded-2xl p-8 mb-8">
          <p className="text-muted-foreground/80 leading-relaxed">{reportData.agent.summary}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Insights */}
          <div className="glass-panel rounded-2xl p-8">
            <h3 className="text-sm uppercase tracking-wider text-primary mb-6">Insights</h3>
            <ul className="space-y-4">
              {reportData.agent.insights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                  <p className="text-muted-foreground/80 text-sm leading-relaxed">{insight}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="glass-panel rounded-2xl p-8">
            <h3 className="text-sm uppercase tracking-wider text-secondary mb-6">Actions</h3>
            <ul className="space-y-4">
              {reportData.agent.actions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-secondary rounded-full mt-2 flex-shrink-0" />
                  <p className="text-muted-foreground/80 text-sm leading-relaxed">{action}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="glass-panel rounded-2xl p-8">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground/60 mb-6">Daily Sales</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={reportData.chartData.dailySales}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(16, 185, 129, 0.1)" />
                <XAxis 
                  dataKey="date" 
                  stroke="rgba(255, 255, 255, 0.3)" 
                  tick={{ fill: "rgba(255, 255, 255, 0.5)", fontSize: 11 }}
                />
                <YAxis 
                  stroke="rgba(255, 255, 255, 0.3)"
                  tick={{ fill: "rgba(255, 255, 255, 0.5)", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(18, 24, 24, 0.95)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    borderRadius: "0.75rem",
                    boxShadow: "0 0 20px rgba(16, 185, 129, 0.2)",
                  }}
                  labelStyle={{ color: "rgba(255, 255, 255, 0.9)" }}
                  itemStyle={{ color: "hsl(var(--primary))" }}
                />
                <Bar dataKey="sales" fill="url(#salesGradient)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-panel rounded-2xl p-8">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground/60 mb-6">PPA Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={reportData.chartData.ppaTrend}>
                <defs>
                  <linearGradient id="ppaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(16, 185, 129, 0.1)" />
                <XAxis 
                  dataKey="date" 
                  stroke="rgba(255, 255, 255, 0.3)"
                  tick={{ fill: "rgba(255, 255, 255, 0.5)", fontSize: 11 }}
                />
                <YAxis 
                  stroke="rgba(255, 255, 255, 0.3)"
                  tick={{ fill: "rgba(255, 255, 255, 0.5)", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(18, 24, 24, 0.95)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    borderRadius: "0.75rem",
                    boxShadow: "0 0 20px rgba(16, 185, 129, 0.2)",
                  }}
                  labelStyle={{ color: "rgba(255, 255, 255, 0.9)" }}
                  itemStyle={{ color: "hsl(var(--secondary))" }}
                />
                <Line
                  type="monotone"
                  dataKey="ppa"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--secondary))", r: 3, strokeWidth: 0 }}
                  fill="url(#ppaGradient)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PulseReport;
