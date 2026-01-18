import { Button } from "@/components/ui/button";
import { downloadSVG, exportToSVG } from "@/lib/svg-export";
import { useCanvasStore } from "@/store";
import type { CanvasElement } from "@/types";
import { SectionHeader } from "./shared";

interface ExportSectionProps {
  element: CanvasElement;
}

export function ExportSection({ element }: ExportSectionProps) {
  const elements = useCanvasStore((s) => s.elements);

  const handleExportSVG = () => {
    const svgContent = exportToSVG([element], elements);
    const filename = `${element.name?.replace(/\s+/g, "-").toLowerCase() || "export"}.svg`;
    downloadSVG(svgContent, filename);
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
