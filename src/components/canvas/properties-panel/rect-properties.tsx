import { NumberInput } from "@/components/shared/number-input";
import { Separator } from "@/components/ui/separator";
import { useCanvasStore } from "@/store";
import type { RectElement } from "@/types";
import { FillSection } from "./fill-section";
import { getElementBounds, RotateIcon, SectionHeader } from "./shared";
import { StrokeSection } from "./stroke-section";

interface RectPropertiesProps {
  element: RectElement;
}

export function RectProperties({ element }: RectPropertiesProps) {
  const updateElement = useCanvasStore((s) => s.updateElement);
  const bounds = getElementBounds(element);

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
            <NumberInput label="X" value={bounds.x} onChange={(v) => updateElement(element.id, { x: v })} />
            <NumberInput label="Y" value={bounds.y} onChange={(v) => updateElement(element.id, { y: v })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              icon={<RotateIcon />}
              value={(bounds.rotation * 180) / Math.PI}
              onChange={(v) => updateElement(element.id, { rotation: (v * Math.PI) / 180 })}
            />
          </div>
        </div>

        <Separator />

        {/* Layout */}
        <div className="flex flex-col gap-2">
          <SectionHeader title="Layout" />
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="W" value={bounds.width} onChange={(v) => updateElement(element.id, { width: v })} />
            <NumberInput label="H" value={bounds.height} onChange={(v) => updateElement(element.id, { height: v })} />
          </div>
        </div>

        <Separator />

        {/* Appearance */}
        <div className="flex flex-col gap-3 p-3">
          <SectionHeader title="Appearance" />
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="font-medium text-[10px] text-muted-foreground uppercase">Opacity</span>
              <NumberInput
                value={(element.opacity ?? 1) * 100}
                onChange={(v) => updateElement(element.id, { opacity: v / 100 })}
                step={1}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium text-[10px] text-muted-foreground uppercase">Corner Radius</span>
              <NumberInput value={element.rx || 0} onChange={(v) => updateElement(element.id, { rx: v, ry: v })} />
            </div>
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
