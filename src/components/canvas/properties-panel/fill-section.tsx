import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ColorInput } from "@/components/shared/color-input";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/store";
import type { Shape } from "@/types";
import { SectionHeader } from "./shared";

interface FillSectionProps {
  element: Shape;
}

export function FillSection({ element }: FillSectionProps) {
  const updateElement = useCanvasStore((s) => s.updateElement);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <SectionHeader title="Fill" />
        <Button
          size="icon"
          variant="ghost"
          className="h-4 w-4 text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (!element.fill) {
              updateElement(element.id, { fill: "#000000" });
            }
          }}
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-3" />
        </Button>
      </div>
      {element.fill && (
        <div className="flex items-center gap-2">
          <ColorInput
            className="flex-1"
            value={typeof element.fill === "string" ? element.fill : "#000000"}
            opacity={element.fillOpacity ?? 1}
            onChange={(hex, newOpacity) => {
              updateElement(element.id, {
                fill: hex,
                ...(newOpacity !== undefined && { fillOpacity: newOpacity }),
              });
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => updateElement(element.id, { fill: null })}
          >
            <HugeiconsIcon icon={MinusSignIcon} className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
