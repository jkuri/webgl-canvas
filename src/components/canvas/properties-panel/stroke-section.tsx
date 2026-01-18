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
  element: Shape;
  showMarkers?: boolean;
}

export function StrokeSection({ element, showMarkers = false }: StrokeSectionProps) {
  const updateElement = useCanvasStore((s) => s.updateElement);
  const isLine = element.type === "line";

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <SectionHeader title="Stroke" />
        <Button
          size="icon"
          variant="ghost"
          className="h-4 w-4 text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (!element.stroke) {
              updateElement(element.id, { stroke: { color: "#000000", width: 1, dashArray: [] } });
            }
          }}
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-3" />
        </Button>
      </div>

      {element.stroke && (
        <div className="flex flex-col gap-3">
          {/* Color */}
          <div className="flex items-center gap-2">
            <ColorInput
              className="flex-1"
              value={typeof element.stroke.color === "string" ? element.stroke.color : "#000000"}
              opacity={element.stroke.opacity ?? 1}
              onChange={(color, newOpacity) => {
                updateElement(element.id, {
                  stroke: {
                    ...element.stroke!,
                    color,
                    ...(newOpacity !== undefined && { opacity: newOpacity }),
                  },
                });
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => updateElement(element.id, { stroke: null })}
            >
              <HugeiconsIcon icon={MinusSignIcon} className="size-3.5" />
            </Button>
          </div>

          {/* Weight */}
          <div className="flex flex-col gap-1">
            <span className="font-medium text-[10px] text-muted-foreground uppercase">Weight</span>
            <NumberInput
              icon={<WeightIcon />}
              value={element.stroke.width}
              onChange={(v) =>
                updateElement(element.id, {
                  stroke: { ...element.stroke!, width: v },
                })
              }
              step={1}
            />
          </div>

          {/* Dash Style */}
          <Select
            value={
              element.stroke.dashArray?.length ? (element.stroke.dashArray[0] === 1 ? "dotted" : "dashed") : "solid"
            }
            onValueChange={(val) => {
              let dashArray: number[] = [];
              if (val === "dashed") dashArray = [6, 6];
              if (val === "dotted") dashArray = [1, 5];
              updateElement(element.id, {
                stroke: { ...element.stroke!, dashArray },
              });
            }}
          >
            <SelectTrigger className="w-full text-xs">
              <SelectValue>
                {element.stroke.dashArray?.length ? (element.stroke.dashArray[0] === 1 ? "Dotted" : "Dashed") : "Solid"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="dashed">Dashed</SelectItem>
              <SelectItem value="dotted">Dotted</SelectItem>
            </SelectContent>
          </Select>

          {/* Line Markers */}
          {showMarkers && isLine && (
            <div className="mt-1 grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-[10px] text-muted-foreground uppercase">Start</span>
                <LineMarkerSelect
                  value={(element as LineElement).markerStart || "none"}
                  onChange={(val) => updateElement(element.id, { markerStart: val })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-medium text-[10px] text-muted-foreground uppercase">End</span>
                <LineMarkerSelect
                  value={(element as LineElement).markerEnd || "none"}
                  onChange={(val) => updateElement(element.id, { markerEnd: val })}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
