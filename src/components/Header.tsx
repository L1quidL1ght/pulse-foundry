import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Shield } from "lucide-react";

export const Header = () => {
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/auth";
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0b0f0f]/80 border-b border-primary/10">
      <div className="container max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to={user ? "/dashboard" : "/auth"} className="flex flex-col">
          <h1 className="text-2xl font-bold text-primary tracking-tight">PULSE</h1>
          <p className="text-[10px] text-white/70 tracking-wide mt-0.5">BY THE FOUNDRY</p>
        </Link>
        
        <nav className="flex items-center gap-6">
          {user ? (
            <>
              <Link to="/dashboard">
                <Button 
                  variant="ghost" 
                  className={`uppercase text-xs tracking-wider ${
                    location.pathname.startsWith("/dashboard") ? "text-primary" : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  Dashboard
                </Button>
              </Link>
              
              {isAdmin && (
                <Link to="/admin/pulse">
                  <Button 
                    variant="ghost" 
                    className={`uppercase text-xs tracking-wider ${
                      location.pathname.startsWith("/admin") ? "text-primary" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </Button>
                </Link>
              )}
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleSignOut}
                className="uppercase text-xs tracking-wider text-muted-foreground hover:text-primary"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/upload">
                <Button 
                  variant="ghost" 
                  className={`uppercase text-xs tracking-wider ${
                    location.pathname === "/upload" ? "text-primary" : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  Upload
                </Button>
              </Link>
              <Link to="/auth">
                <Button 
                  variant="ghost" 
                  className={`uppercase text-xs tracking-wider ${
                    location.pathname === "/auth" ? "text-primary" : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  Sign In
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
