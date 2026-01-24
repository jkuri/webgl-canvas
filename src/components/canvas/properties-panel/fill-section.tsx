import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ColorInput } from "@/components/shared/color-input";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/store";
import type { Shape } from "@/types";
import { SectionHeader } from "./shared";

interface FillSectionProps {
  elements: Shape[];
}

export function FillSection({ elements }: FillSectionProps) {
  const updateElements = useCanvasStore((s) => s.updateElements);

  if (elements.length === 0) {
    return null;
  }

  const uniqueFills = new Set(
    elements.map((e) => {
      if (typeof e.fill === "string") return e.fill;
      return null;
    }),
  );

  const displayFill = uniqueFills.size === 1 ? elements[0].fill : (elements[0].fill ?? "#000000");
  const hasMultipleValues = uniqueFills.size > 1;

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <SectionHeader title="Fill" />
        <Button
          size="icon"
          variant="ghost"
          className="h-4 w-4 text-muted-foreground hover:text-foreground"
          onClick={() => {
            const updates = new Map<string, Record<string, unknown>>();
            elements.forEach((element) => {
              if (!element.fill) {
                updates.set(element.id, { fill: "#000000" });
              }
            });
            if (updates.size > 0) updateElements(updates);
          }}
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-3" />
        </Button>
      </div>
      {elements.some((e) => e.fill) && (
        <div className="flex items-center gap-2">
          <ColorInput
            className="flex-1"
            value={typeof displayFill === "string" ? displayFill : "#000000"}
            opacity={elements[0].fillOpacity ?? 1}
            isMixed={hasMultipleValues}
            onChange={(hex, newOpacity) => {
              const updates = new Map<string, Record<string, unknown>>();
              elements.forEach((element) => {
                updates.set(element.id, {
                  fill: hex,
                  ...(newOpacity !== undefined && { fillOpacity: newOpacity }),
                });
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
                updates.set(element.id, { fill: null });
              });
              updateElements(updates);
            }}
          >
            <HugeiconsIcon icon={MinusSignIcon} className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
