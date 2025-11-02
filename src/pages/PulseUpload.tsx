import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PulseUpload = () => {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Pulse
            </h1>
            <div className="flex gap-4">
              <Link to="/">
                <Button variant="ghost">Upload</Button>
              </Link>
              <Link to="/report">
                <Button variant="ghost">Report</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-4">Upload Your Data</h2>
          <p className="text-muted-foreground mb-8">
            Ready to integrate your custom components here
          </p>
          
          {/* Your custom PulseUpload code will go here */}
        </div>
      </main>
    </div>
  );
};

export default PulseUpload;
