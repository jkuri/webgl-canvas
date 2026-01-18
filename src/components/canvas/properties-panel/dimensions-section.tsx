import { SquareLock01Icon, SquareUnlock02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { NumberInput } from "@/components/shared/number-input";
import { Button } from "@/components/ui/button";
import type { CanvasElement } from "@/types";
import { SectionHeader } from "./shared";
import { getElementBounds } from "./utils";

interface DimensionsSectionProps {
  element: CanvasElement;
  updateElement: (id: string, updates: Record<string, unknown>) => void;
  bounds?: { width: number; height: number };
}

export function DimensionsSection({ element, updateElement, bounds: providedBounds }: DimensionsSectionProps) {
  const isLocked = !!element.aspectRatioLocked;
  const bounds = providedBounds ?? getElementBounds(element);

  const toggleLock = () => {
    updateElement(element.id, { aspectRatioLocked: !isLocked });
  };

  const handleWidthChange = (newWidth: number) => {
    const updates: Record<string, unknown> = { width: newWidth };

    if (isLocked && bounds.width !== 0) {
      const ratio = bounds.height / bounds.width;
      updates.height = newWidth * ratio;
    }

    updateElement(element.id, updates);
  };

  const handleHeightChange = (newHeight: number) => {
    const updates: Record<string, unknown> = { height: newHeight };

    if (isLocked && bounds.height !== 0) {
      const ratio = bounds.width / bounds.height;
      updates.width = newHeight * ratio;
    }

    updateElement(element.id, updates);
  };

  return (
    <div className="flex flex-col gap-2">
      <SectionHeader title="Layout" />
      <div className="flex items-end gap-2">
        <NumberInput label="W" value={bounds.width} onChange={handleWidthChange} className="flex-1" />

        <div className="flex h-8 items-center">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 rounded-md text-muted-foreground focus:bg-transparent focus:text-muted-foreground"
            onClick={toggleLock}
            title={isLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
          >
            {isLocked ? (
              <HugeiconsIcon icon={SquareLock01Icon} className="size-4" />
            ) : (
              <HugeiconsIcon icon={SquareUnlock02Icon} className="size-4" />
            )}
          </Button>
        </div>

        <NumberInput label="H" value={bounds.height} onChange={handleHeightChange} className="flex-1" />
      </div>
    </div>
  );
}
