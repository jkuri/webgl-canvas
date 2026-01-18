import { Button } from "@/components/ui/button";
import { startSVGExportProcess } from "@/lib/svg-export";
import type { CanvasElement } from "@/types";
import { SectionHeader } from "./shared";

interface ExportSectionProps {
  element: CanvasElement;
}

export function ExportSection({ element }: ExportSectionProps) {
  const handleExportSVG = () => {
    startSVGExportProcess([element]);
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      <SectionHeader title="Export" />
      <Button variant="outline" className="w-full" onClick={handleExportSVG}>
        Export as SVG
      </Button>
    </div>
  );
}
