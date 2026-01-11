import { useEffect, useState } from "react";
import { WebGLCanvas } from "@/components/canvas";
import { LoadingOverlay } from "@/components/canvas/loading-overlay";
import { preloadFonts } from "@/lib/text-renderer";

function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    preloadFonts().then(() => setFontsLoaded(true));
  }, []);

  return (
    <>
      <WebGLCanvas fontsReady={fontsLoaded} />
      <LoadingOverlay isLoading={!fontsLoaded} />
    </>
  );
}

export default App;
