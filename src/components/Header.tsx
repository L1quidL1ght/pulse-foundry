import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const Header = () => {
  const location = useLocation();
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0b0f0f]/80 border-b border-primary/10">
      <div className="container max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/">
          <h1 className="text-2xl font-bold text-primary text-glow tracking-tight">PULSE</h1>
        </Link>
        
        <nav className="flex gap-6">
          <Link to="/">
            <Button 
              variant="ghost" 
              className={`uppercase text-xs tracking-wider ${
                location.pathname === "/" 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              Upload
            </Button>
          </Link>
          <Link to="/report">
            <Button 
              variant="ghost"
              className={`uppercase text-xs tracking-wider ${
                location.pathname === "/report" 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              Reports
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
};
