import { NumberInput } from "@/components/shared/number-input";
import { Separator } from "@/components/ui/separator";
import { useCanvasStore } from "@/store";
import type { LineElement } from "@/types";
import { getElementBounds, RotateIcon, SectionHeader } from "./shared";
import { StrokeSection } from "./stroke-section";

interface LinePropertiesProps {
  element: LineElement;
}

export function LineProperties({ element }: LinePropertiesProps) {
  const updateElement = useCanvasStore((s) => s.updateElement);
  const bounds = getElementBounds(element);

  const updateBounds = (newBounds: { x?: number; y?: number; width?: number; rotation?: number }) => {
    const cx = newBounds.x ?? bounds.x;
    const cy = newBounds.y ?? bounds.y;
    const length = newBounds.width ?? bounds.width;
    const rotation = newBounds.rotation ?? bounds.rotation;

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const dx = (length / 2) * cos;
    const dy = (length / 2) * sin;

    updateElement(element.id, {
      x1: cx - dx,
      y1: cy - dy,
      x2: cx + dx,
      y2: cy + dy,
    });
  };

  return (
    <div className="flex h-full flex-col gap-0 text-foreground text-xs">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3 font-medium">
        <span className="truncate">{element.name}</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-2">
        {/* Position */}
        <div className="flex flex-col gap-2">
          <SectionHeader title="Position" />
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="X" value={bounds.x} onChange={(v) => updateBounds({ x: v })} />
            <NumberInput label="Y" value={bounds.y} onChange={(v) => updateBounds({ y: v })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              icon={<RotateIcon />}
              value={(bounds.rotation * 180) / Math.PI}
              onChange={(v) => updateBounds({ rotation: (v * Math.PI) / 180 })}
            />
          </div>
        </div>

        <Separator />

        {/* Layout */}
        <div className="flex flex-col gap-2">
          <SectionHeader title="Layout" />
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Length" value={bounds.width} onChange={(v) => updateBounds({ width: v })} />
          </div>
        </div>

        <Separator />

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

        <StrokeSection element={element} showMarkers />
      </div>
    </div>
  );
}
