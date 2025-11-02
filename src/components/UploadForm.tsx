import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const SUPABASE_FUNCTION_URL = "https://vbijtwzriiqykkjvxjkw.supabase.co/functions/v1/pulse-upload";

// Anon key is public by design; using it here unblocks auth header issues.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWp0d3pyaWlxeWtranZ4amt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNjg0MTQsImV4cCI6MjA3NzY0NDQxNH0.3W9QzSuX10zXUHsWp8L13YsCfXKYbJXGW8CSY5W3wDs";

const uploadSchema = z.object({
  restaurantName: z.string().min(1, "Required"),
  reportType: z.string().min(1, "Required"),
  period: z.string().min(1, "Required"),
  file: z.instanceof(FileList).refine((files) => files?.length > 0, "Required"),
});

type UploadFormData = z.infer<typeof uploadSchema>;

export const UploadForm = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
  });

  const onSubmit = async (data: UploadFormData) => {
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const file = data.file[0];
      setUploadProgress(30);

      // Build multipart form-data
      const formData = new FormData();
      formData.append("restaurant_name", data.restaurantName);
      formData.append("report_type", data.reportType);
      formData.append("period", data.period);
      formData.append("file", file);

      // Call Edge Function directly with required headers
      const res = await fetch(SUPABASE_FUNCTION_URL, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: formData,
      });

      setUploadProgress(80);

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(errText || `Upload failed: ${res.status} ${res.statusText}`);
      }

      const uploadData = await res.json();

      setUploadProgress(100);

      toast({ title: "Analysis complete", description: "Data processed" });

      localStorage.setItem("latestReport", JSON.stringify(uploadData));
      setTimeout(() => navigate("/report"), 500);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: "Upload failed",
        variant: "destructive",
      });
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-8 max-w-2xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="restaurantName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Restaurant</FormLabel>
                <FormControl>
                  <Input placeholder="Name" {...field} className="bg-muted/50 border-primary/20 focus:border-primary" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reportType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-muted/50 border-primary/20 focus:border-primary">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-card border-primary/20">
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="labor">Labor</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="period"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Period</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Q1 2024"
                    {...field}
                    className="bg-muted/50 border-primary/20 focus:border-primary"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="file"
            render={({ field: { onChange, value, ...field } }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Data File</FormLabel>
                <FormControl>
                  <div className="relative group">
                    <div className="glass-panel rounded-xl p-8 border-dashed border-2 border-primary/30 hover:border-primary/50 transition-all cursor-pointer">
                      <Input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => onChange(e.target.files)}
                        {...field}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Upload className="w-8 h-8 text-primary" />
                        <p className="text-sm text-muted-foreground">CSV, XLSX</p>
                      </div>
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {isUploading && (
            <div className="space-y-3">
              <Progress value={uploadProgress} className="h-1 bg-muted" />
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse-glow" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Processing</p>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={isUploading}
            className="w-full rounded-xl px-6 py-3 bg-primary hover:bg-primary/90 text-black font-semibold transition-all duration-200 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing
              </>
            ) : (
              "Analyze"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
};
