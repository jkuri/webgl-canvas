import { useEffect, useState } from "react";
import { WebGLCanvas } from "@/components/canvas";
import { ExportSpinner } from "@/components/canvas/export-spinner";
import { LoadingOverlay } from "@/components/canvas/loading-overlay";
import { preloadFonts } from "@/lib/text-renderer";

function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    preloadFonts().then(() => setIsReady(true));
  }, []);

  return (
    <>
      <WebGLCanvas isReady={isReady} />
      <LoadingOverlay isLoading={!isReady} />
      <ExportSpinner />
    </>
  );
}

export default App;
