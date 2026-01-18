import { useEffect, useState } from "react";
import { WebGLCanvas } from "@/components/canvas";
import { ExportSpinner } from "@/components/canvas/export-spinner";
import { LoadingOverlay } from "@/components/canvas/loading-overlay";
import { preloadFonts } from "@/lib/text-renderer";
import { ThemeProvider } from "@/providers/theme-provider";

function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    preloadFonts().then(() => setIsReady(true));
  }, []);

  return (
    <ThemeProvider>
      <WebGLCanvas isReady={isReady} />
      <LoadingOverlay isLoading={!isReady} />
      <ExportSpinner />
    </ThemeProvider>
  );
}

export default App;
