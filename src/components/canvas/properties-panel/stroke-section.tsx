import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ColorInput } from "@/components/shared/color-input";
import { NumberInput } from "@/components/shared/number-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCanvasStore } from "@/store";
import type { LineElement, Shape } from "@/types";
import { LineMarkerSelect } from "../line-marker-select";
import { SectionHeader, WeightIcon } from "./shared";

interface StrokeSectionProps {
  elements: Shape[];
  showMarkers?: boolean;
}

export function StrokeSection({ elements, showMarkers = false }: StrokeSectionProps) {
  const updateElements = useCanvasStore((s) => s.updateElements);

  const allLines = elements.every((e) => e.type === "line");
  const hasStroke = elements.some((e) => e.stroke);

  const uniqueColors = new Set(
    elements.map((e) => {
      if (e.stroke && typeof e.stroke.color === "string") return e.stroke.color;
      return null;
    }),
  );
  const displayColor = uniqueColors.size === 1 ? (elements[0].stroke?.color ?? "#000000") : (elements[0].stroke?.color ?? "#000000");
  const isMixedColor = uniqueColors.size > 1;

  const uniqueWidths = new Set(elements.map((e) => e.stroke?.width));
  const displayWidth = uniqueWidths.size === 1 ? (elements[0].stroke?.width ?? 1) : (elements[0].stroke?.width ?? 1);

  const uniqueOpacities = new Set(elements.map((e) => e.stroke?.opacity));
  const displayOpacity = uniqueOpacities.size === 1 ? (elements[0].stroke?.opacity ?? 1) : (elements[0].stroke?.opacity ?? 1);

  const displayDashArray = elements[0].stroke?.dashArray;

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <SectionHeader title="Stroke" />
        <Button
          size="icon"
          variant="ghost"
          className="h-4 w-4 text-muted-foreground hover:text-foreground"
          onClick={() => {
            const updates = new Map<string, Record<string, unknown>>();
            elements.forEach((element) => {
              if (!element.stroke) {
                updates.set(element.id, { stroke: { color: "#000000", width: 1, dashArray: [] } });
              }
            });
            if (updates.size > 0) updateElements(updates);
          }}
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-3" />
        </Button>
      </div>

      {hasStroke && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <ColorInput
              className="flex-1"
              value={typeof displayColor === "string" ? displayColor : "#000000"}
              opacity={displayOpacity}
              isMixed={isMixedColor}
              onChange={(color, newOpacity) => {
                const updates = new Map<string, Record<string, unknown>>();
                elements.forEach((element) => {
                  if (element.stroke) {
                    updates.set(element.id, {
                      stroke: {
                        ...element.stroke,
                        color,
                        ...(newOpacity !== undefined && { opacity: newOpacity }),
                      },
                    });
                  }
                });
                updateElements(updates);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                const updates = new Map<string, Record<string, unknown>>();
                elements.forEach((element) => {
                  updates.set(element.id, { stroke: null });
                });
                updateElements(updates);
              }}
            >
              <HugeiconsIcon icon={MinusSignIcon} className="size-3.5" />
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-medium text-[10px] text-muted-foreground uppercase">Weight</span>
            <NumberInput
              icon={<WeightIcon />}
              value={displayWidth}
              onChange={(v) => {
                const updates = new Map<string, Record<string, unknown>>();
                elements.forEach((element) => {
                  if (element.stroke) {
                    updates.set(element.id, { stroke: { ...element.stroke, width: v } });
                  }
                });
                updateElements(updates);
              }}
              step={1}
            />
          </div>

          <Select
            value={displayDashArray?.length ? (displayDashArray[0] === 1 ? "dotted" : "dashed") : "solid"}
            onValueChange={(val) => {
              let dashArray: number[] = [];
              if (val === "dashed") dashArray = [6, 6];
              if (val === "dotted") dashArray = [1, 5];

              const updates = new Map<string, Record<string, unknown>>();
              elements.forEach((element) => {
                if (element.stroke) {
                  updates.set(element.id, { stroke: { ...element.stroke, dashArray } });
                }
              });
              updateElements(updates);
            }}
          >
            <SelectTrigger className="w-full text-xs">
              <SelectValue>{displayDashArray?.length ? (displayDashArray[0] === 1 ? "Dotted" : "Dashed") : "Solid"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="dashed">Dashed</SelectItem>
              <SelectItem value="dotted">Dotted</SelectItem>
            </SelectContent>
          </Select>

          {showMarkers && allLines && (
            <div className="mt-1 grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-[10px] text-muted-foreground uppercase">Start</span>
                <LineMarkerSelect
                  value={(elements[0] as LineElement).markerStart || "none"}
                  onChange={(val) => {
                    const updates = new Map<string, Record<string, unknown>>();
                    elements.forEach((element) => {
                      if (element.type === "line") {
                        updates.set(element.id, { markerStart: val });
                      }
                    });
                    updateElements(updates);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-medium text-[10px] text-muted-foreground uppercase">End</span>
                <LineMarkerSelect
                  value={(elements[0] as LineElement).markerEnd || "none"}
                  onChange={(val) => {
                    const updates = new Map<string, Record<string, unknown>>();
                    elements.forEach((element) => {
                      if (element.type === "line") {
                        updates.set(element.id, { markerEnd: val });
                      }
                    });
                    updateElements(updates);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
