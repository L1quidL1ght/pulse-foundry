import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isResetPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?reset=true`,
        });

        if (error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: "Password reset link sent! Check your email.",
          });
          setIsResetPassword(false);
        }
      } else {
        const { error } = isSignUp 
          ? await signUp(email, password)
          : await signIn(email, password);

        if (error) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        } else {
          if (isSignUp) {
            toast({
              title: "Success",
              description: "Account created! Please check your email to confirm.",
            });
          } else {
            navigate("/reports");
          }
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Logo />
        
        <Card className="glass-panel p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">
              {isResetPassword ? "Reset Password" : isSignUp ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="text-muted-foreground">
              {isResetPassword 
                ? "Enter your email to receive a reset link" 
                : isSignUp 
                ? "Sign up to start analyzing your data" 
                : "Sign in to your account"}
            </p>
          </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-sm placeholder:text-muted-foreground/40"
            />
          </div>

          {!isResetPassword && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="text-sm placeholder:text-muted-foreground/40"
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isResetPassword ? "Send Reset Link" : isSignUp ? "Sign Up" : "Sign In"}
          </Button>
        </form>

          <div className="mt-6 space-y-3 text-center">
            {!isResetPassword && !isSignUp && (
              <button
                onClick={() => setIsResetPassword(true)}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                Forgot password?
              </button>
            )}
            
            <div>
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setIsResetPassword(false);
                }}
                className="text-sm text-primary hover:underline"
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            </div>
            
            {isResetPassword && (
              <button
                onClick={() => setIsResetPassword(false)}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                Back to sign in
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
