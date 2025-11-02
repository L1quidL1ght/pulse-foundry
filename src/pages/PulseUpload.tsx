import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UploadForm } from "@/components/UploadForm";

const PulseUpload = () => {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 glass-panel">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Pulse
            </h1>
            <div className="flex gap-4">
              <Link to="/">
                <Button variant="default">Upload</Button>
              </Link>
              <Link to="/report">
                <Button variant="ghost">Report</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="container max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-bold mb-4">Restaurant Analytics Dashboard</h2>
          <p className="text-muted-foreground text-lg">
            Upload your data and get AI-powered insights in seconds
          </p>
        </div>

        <UploadForm />
      </main>
    </div>
  );
};

export default PulseUpload;
