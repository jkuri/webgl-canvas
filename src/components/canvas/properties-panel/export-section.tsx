import { Button } from "@/components/ui/button";
import { startJPGExportProcess, startPNGExportProcess, startSVGExportProcess } from "@/lib/svg-export";
import type { CanvasElement } from "@/types";
import { SectionHeader } from "./shared";

interface ExportSectionProps {
  element: CanvasElement;
}

export function ExportSection({ element }: ExportSectionProps) {
  const handleExportSVG = () => {
    startSVGExportProcess([element]);
  };

  const handleExportPNG = () => {
    startPNGExportProcess([element]);
  };

  const handleExportJPG = () => {
    startJPGExportProcess([element]);
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      <SectionHeader title="Export" />
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" className="w-full" onClick={handleExportSVG}>
          SVG
        </Button>
        <Button variant="outline" className="w-full" onClick={handleExportPNG}>
          PNG
        </Button>
        <Button variant="outline" className="w-full" onClick={handleExportJPG}>
          JPG
        </Button>
      </div>
    </div>
  );
}
