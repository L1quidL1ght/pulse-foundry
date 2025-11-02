import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  format?: "currency" | "number" | "percentage";
}

export const KPICard = ({ title, value, icon: Icon, format = "number" }: KPICardProps) => {
  const formatValue = (val: string | number) => {
    if (typeof val === "string") return val;
    
    switch (format) {
      case "currency":
        return `$${val.toLocaleString()}`;
      case "percentage":
        return `${val.toFixed(1)}%`;
      default:
        return val.toLocaleString();
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 hover:border-primary/30 transition-all duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground/60">{title}</p>
        <p className="text-3xl font-semibold text-foreground">{formatValue(value)}</p>
      </div>
    </div>
  );
};
