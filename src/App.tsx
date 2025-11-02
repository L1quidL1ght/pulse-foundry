import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import ReportDetail from "./pages/ReportDetail";
import AdminDashboard from "./pages/AdminDashboard";
import PulseUpload from "./pages/PulseUpload";
import PulseReport from "./pages/PulseReport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/report/:id" element={<ReportDetail />} />
            <Route path="/dashboard/:id" element={<ReportDetail />} />
            <Route path="/admin/pulse" element={<AdminDashboard />} />
            <Route path="/admin/pulse/:id" element={<ReportDetail />} />
            <Route path="/upload" element={<PulseUpload />} />
            <Route path="/report" element={<PulseReport />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
