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

  const navLinks = [
    { label: "Upload", href: "/dashboard" },
    { label: "Reports", href: "/reports" },
  ];

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/auth";
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0b0f0f]/80 border-b border-primary/10">
      <div className="container max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Menu Trigger - All Screen Sizes */}
        {user && (
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="-ml-2"
                aria-label="Menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <nav className="flex flex-col gap-4 mt-8">
                {navLinks.map((item) => (
                  <Link key={item.href} to={item.href} onClick={() => setMobileMenuOpen(false)}>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start uppercase text-xs tracking-wider ${
                        isActive(item.href) ? "text-primary" : "text-muted-foreground hover:text-primary"
                      }`}
                    >
                      {item.label}
                    </Button>
                  </Link>
                ))}

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
              </nav>
            </SheetContent>
          </Sheet>
        )}

        {/* Logo - Centered */}
        <Link to={user ? "/reports" : "/auth"} className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <div className="relative glass-panel rounded-2xl p-2 border-primary/30">
              <Activity className="w-6 h-6 text-primary" strokeWidth={2.5} />
            </div>
          </div>
          <span className="text-2xl font-bold text-primary tracking-tight">Pulse</span>
        </Link>

        {/* Right Side - Sign Out / Auth */}
        <div className="flex items-center gap-4">
          {user && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((item) => (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant="ghost"
                    className={`uppercase text-xs tracking-wider ${
                      isActive(item.href) ? "text-primary" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {item.label}
                  </Button>
                </Link>
              ))}
              {isAdmin && (
                <Link to="/admin/pulse">
                  <Button
                    variant="ghost"
                    className={`uppercase text-xs tracking-wider flex items-center gap-2 ${
                      location.pathname.startsWith("/admin")
                        ? "text-primary"
                        : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    <Shield className="h-3 w-3" />
                    Admin
                  </Button>
                </Link>
              )}
            </nav>
          )}
          {user ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-primary"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
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
          )}
        </div>
      </div>
    </header>
  );
};
