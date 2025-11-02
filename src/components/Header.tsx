import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Shield, Menu, Activity } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export const Header = () => {
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/auth";
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0b0f0f]/80 border-b border-primary/10">
      <div className="container max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Mobile Menu Trigger */}
        {user && (
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="md:hidden"
                aria-label="Menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <nav className="flex flex-col gap-4 mt-8">
                <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start uppercase text-xs tracking-wider ${
                      location.pathname.startsWith("/dashboard") ? "text-primary" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    Dashboard
                  </Button>
                </Link>
                
                {isAdmin && (
                  <Link to="/admin/pulse" onClick={() => setMobileMenuOpen(false)}>
                    <Button 
                      variant="ghost" 
                      className={`w-full justify-start uppercase text-xs tracking-wider ${
                        location.pathname.startsWith("/admin") ? "text-primary" : "text-muted-foreground hover:text-primary"
                      }`}
                    >
                      <Shield className="h-3 w-3 mr-2" />
                      Admin
                    </Button>
                  </Link>
                )}
                
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="w-full justify-start uppercase text-xs tracking-wider text-muted-foreground hover:text-primary"
                >
                  <LogOut className="h-3 w-3 mr-2" />
                  Sign Out
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        )}

        {/* Logo */}
        <Link to={user ? "/dashboard" : "/auth"} className="flex items-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <div className="relative glass-panel rounded-2xl p-2 border-primary/30">
              <Activity className="w-6 h-6 text-primary" strokeWidth={2.5} />
            </div>
          </div>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
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
                size="icon"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-primary"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
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
