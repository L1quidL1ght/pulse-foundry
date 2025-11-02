import { Header } from "@/components/Header";
import { UploadForm } from "@/components/UploadForm";

const PulseUpload = () => {
  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container max-w-7xl mx-auto px-6 pt-32 pb-12">
        <UploadForm />
      </main>
    </div>
  );
};

export default PulseUpload;
