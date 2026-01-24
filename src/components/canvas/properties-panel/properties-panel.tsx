import { Separator } from "@/components/ui/separator";
import { useCanvasStore } from "@/store";
import type { EllipseElement, GroupElement, ImageElement, LineElement, PathElement, RectElement, Shape, TextElement } from "@/types";
import { EllipseProperties } from "./ellipse-properties";
import { FillSection } from "./fill-section";
import { GroupProperties } from "./group-properties";
import { ImageProperties } from "./image-properties";
import { LineProperties } from "./line-properties";
import { PageProperties } from "./page-properties";
import { PathProperties } from "./path-properties";
import { RectProperties } from "./rect-properties";
import { StrokeSection } from "./stroke-section";
import { TextProperties } from "./text-properties";

export function PropertiesPanel() {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const elements = useCanvasStore((s) => s.elements);

  const selectedElements = elements.filter((e) => selectedIds.includes(e.id));
  const shapes = selectedElements.filter((e): e is Shape => e.type !== "group");

  if (selectedElements.length === 0) {
    return <PageProperties />;
  }

  if (selectedElements.length > 1) {
    const showStroke = shapes.some((e) => ["rect", "ellipse", "path", "line", "polygon", "polyline"].includes(e.type));

    return (
      <div className="flex h-full flex-col gap-0 text-foreground text-xs">
        <div className="flex h-10 shrink-0 items-center justify-between border-b px-3 font-medium">
          <span className="truncate">{selectedElements.length} items selected</span>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-2">
          {shapes.length > 0 && <FillSection elements={shapes} />}
          <Separator />
          {showStroke && <StrokeSection elements={shapes} showMarkers={shapes.every((e) => e.type === "line")} />}
        </div>
      </div>
    );
  }

  const selectedElement = selectedElements[0];

  switch (selectedElement.type) {
    case "rect":
      return <RectProperties element={selectedElement as RectElement} />;
    case "ellipse":
      return <EllipseProperties element={selectedElement as EllipseElement} />;
    case "line":
      return <LineProperties element={selectedElement as LineElement} />;
    case "text":
      return <TextProperties element={selectedElement as TextElement} />;
    case "path":
      return <PathProperties element={selectedElement as PathElement} />;
    case "image":
      return <ImageProperties element={selectedElement as ImageElement} />;
    case "group":
      return <GroupProperties element={selectedElement as GroupElement} />;
    default:
      return <PageProperties />;
  }
}
