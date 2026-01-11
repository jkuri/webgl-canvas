import { useCanvasStore } from "@/store";
import type { EllipseElement, ImageElement, LineElement, PathElement, RectElement, TextElement } from "@/types";
import { EllipseProperties } from "./ellipse-properties";
import { ImageProperties } from "./image-properties";
import { LineProperties } from "./line-properties";
import { PageProperties } from "./page-properties";
import { PathProperties } from "./path-properties";
import { RectProperties } from "./rect-properties";
import { TextProperties } from "./text-properties";

export function PropertiesPanel() {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const elements = useCanvasStore((s) => s.elements);

  const selectedElement = elements.find((e) => e.id === selectedIds[0]);
  const isMultiple = selectedIds.length > 1;

  // No selection - show page properties
  if (!selectedElement) {
    return <PageProperties />;
  }

  // Multiple selection
  if (isMultiple) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-muted-foreground text-xs">
        <p>{selectedIds.length} items selected</p>
      </div>
    );
  }

  // Single element - show type-specific properties
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
      return (
        <div className="flex h-full flex-col gap-0 text-foreground text-xs">
          <div className="flex h-10 shrink-0 items-center justify-between border-b px-3 font-medium">
            <span className="truncate">{selectedElement.name}</span>
          </div>
          <div className="flex flex-1 items-center justify-center p-4 text-muted-foreground">
            <p>Group selected</p>
          </div>
        </div>
      );
    default:
      return <PageProperties />;
  }
}
