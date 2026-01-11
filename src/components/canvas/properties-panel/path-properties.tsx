import { NumberInput } from "@/components/shared/number-input";
import { Separator } from "@/components/ui/separator";
import { useCanvasStore } from "@/store";
import type { PathElement } from "@/types";
import { FillSection } from "./fill-section";
import { SectionHeader } from "./shared";
import { StrokeSection } from "./stroke-section";

interface PathPropertiesProps {
  element: PathElement;
}

export function PathProperties({ element }: PathPropertiesProps) {
  const updateElement = useCanvasStore((s) => s.updateElement);

  return (
    <div className="flex h-full flex-col gap-0 text-foreground text-xs">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3 font-medium">
        <span className="truncate">{element.name}</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-2">
        {/* Appearance */}
        <div className="flex flex-col gap-3 p-3">
          <SectionHeader title="Appearance" />
          <div className="flex flex-col gap-1">
            <span className="font-medium text-[10px] text-muted-foreground uppercase">Opacity</span>
            <NumberInput
              value={(element.opacity ?? 1) * 100}
              onChange={(v) => updateElement(element.id, { opacity: v / 100 })}
              step={1}
            />
          </div>
        </div>

        <Separator />

        <FillSection element={element} />

        <Separator />

        <StrokeSection element={element} />
      </div>
    </div>
  );
}
