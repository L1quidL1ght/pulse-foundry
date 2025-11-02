import { Activity } from "lucide-react";

export const Logo = () => {
  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
        <div className="relative glass-panel rounded-2xl p-4 border-primary/30">
          <Activity className="w-12 h-12 text-primary" strokeWidth={2.5} />
        </div>
      </div>
      <div className="flex flex-col items-center">
        <h1 className="text-4xl font-bold text-primary tracking-tight">PULSE</h1>
        <p className="text-xs text-muted-foreground tracking-[0.3em] mt-1">BY THE FOUNDRY</p>
      </div>
    </div>
  );
};
