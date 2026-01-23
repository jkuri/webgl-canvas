import { NumberInput } from "@/components/shared/number-input";
import { Separator } from "@/components/ui/separator";
import { resizePath } from "@/lib/svg-import";
import { useCanvasStore } from "@/store";
import type { CanvasElement, GroupElement } from "@/types";
import { getElementBounds } from "@/types";
import { DimensionsSection } from "./dimensions-section";
import { ExportSection } from "./export-section";
import { RotateIcon, SectionHeader } from "./shared";

interface GroupPropertiesProps {
  element: GroupElement;
}

export function GroupProperties({ element }: GroupPropertiesProps) {
  const elements = useCanvasStore((s) => s.elements);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const updateElements = useCanvasStore((s) => s.updateElements);

  const getGroupBounds = (): { x: number; y: number; width: number; height: number } => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasChildren = false;

    const traverse = (ids: string[]) => {
      for (const id of ids) {
        const el = elements.find((e) => e.id === id);
        if (!el) continue;

        if (el.type === "group") {
          traverse(el.childIds);
        } else {
          hasChildren = true;
          const b = getElementBounds(el);
          minX = Math.min(minX, b.x);
          minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + b.width);
          maxY = Math.max(maxY, b.y + b.height);
        }
      }
    };

    traverse(element.childIds);

    if (!hasChildren) return { x: 0, y: 0, width: 0, height: 0 };

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  const bounds = getGroupBounds();

  const handleXChange = (newX: number) => {
    const dx = newX - bounds.x;
    moveChildren(dx, 0);
  };

  const handleYChange = (newY: number) => {
    const dy = newY - bounds.y;
    moveChildren(0, dy);
  };

  const moveChildren = (dx: number, dy: number) => {
    const updates = new Map<string, Record<string, unknown>>();

    const traverse = (ids: string[]) => {
      for (const id of ids) {
        const el = elements.find((e) => e.id === id);
        if (!el) continue;

        if (el.type === "group") {
          traverse(el.childIds);
        } else {
          if (el.type === "rect" || el.type === "image" || el.type === "text") {
            updates.set(id, { x: el.x + dx, y: el.y + dy });
          } else if (el.type === "ellipse") {
            updates.set(id, { cx: el.cx + dx, cy: el.cy + dy });
          } else if (el.type === "line") {
            updates.set(id, { x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy });
          } else if (el.type === "path") {
            updates.set(id, { bounds: { ...el.bounds, x: el.bounds.x + dx, y: el.bounds.y + dy } });
          } else if (el.type === "polygon" || el.type === "polyline") {
            updates.set(id, { points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) });
          }
        }
      }
    };

    traverse(element.childIds);
    if (updates.size > 0) updateElements(updates);
  };

  const handleDimensionsUpdate = (id: string, updates: Record<string, unknown>) => {
    if ("aspectRatioLocked" in updates && Object.keys(updates).length === 1) {
      updateElement(id, updates);
      return;
    }

    if (bounds.width === 0 || bounds.height === 0) return;

    let newWidth = bounds.width;
    let newHeight = bounds.height;
    const newX = bounds.x;
    const newY = bounds.y;

    if ("width" in updates) {
      newWidth = Math.max(0.1, updates.width as number);
    }

    if ("height" in updates) {
      newHeight = Math.max(0.1, updates.height as number);
    }

    const newBounds = { x: newX, y: newY, width: newWidth, height: newHeight };
    const oldBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };

    const elementUpdates = new Map<string, Record<string, unknown>>();

    const traverse = (ids: string[]) => {
      for (const childId of ids) {
        const el = elements.find((e) => e.id === childId);
        if (!el) continue;

        if (el.type === "group") {
          traverse(el.childIds);
        } else {
          resizeElement(el, oldBounds, newBounds, elementUpdates);
        }
      }
    };

    traverse(element.childIds);
    if (elementUpdates.size > 0) updateElements(elementUpdates);
  };

  const resizeElement = (
    el: CanvasElement,
    oldB: { x: number; y: number; width: number; height: number },
    newB: { x: number; y: number; width: number; height: number },
    updates: Map<string, Record<string, unknown>>,
  ) => {
    if (el.type === "rect" || el.type === "image") {
      const x = newB.x + ((el.x - oldB.x) / oldB.width) * newB.width;
      const y = newB.y + ((el.y - oldB.y) / oldB.height) * newB.height;
      updates.set(el.id, {
        x,
        y,
        width: (el.width / oldB.width) * newB.width,
        height: (el.height / oldB.height) * newB.height,
      });
    } else if (el.type === "ellipse") {
      const relCx = (el.cx - oldB.x) / oldB.width;
      const relCy = (el.cy - oldB.y) / oldB.height;

      updates.set(el.id, {
        cx: newB.x + relCx * newB.width,
        cy: newB.y + relCy * newB.height,
        rx: (el.rx / oldB.width) * newB.width,
        ry: (el.ry / oldB.height) * newB.height,
      });
    } else if (el.type === "text") {
      const x = newB.x + ((el.x - oldB.x) / oldB.width) * newB.width;
      const y = newB.y + ((el.y - oldB.y) / oldB.height) * newB.height;

      const scaleX = newB.width / oldB.width;
      const scaleY = newB.height / oldB.height;
      const avgScale = (scaleX + scaleY) / 2;

      updates.set(el.id, { x, y, fontSize: el.fontSize * avgScale });
    } else if (el.type === "line") {
      const relX1 = (el.x1 - oldB.x) / oldB.width;
      const relY1 = (el.y1 - oldB.y) / oldB.height;
      const relX2 = (el.x2 - oldB.x) / oldB.width;
      const relY2 = (el.y2 - oldB.y) / oldB.height;

      updates.set(el.id, {
        x1: newB.x + relX1 * newB.width,
        y1: newB.y + relY1 * newB.height,
        x2: newB.x + relX2 * newB.width,
        y2: newB.y + relY2 * newB.height,
      });
    } else if (el.type === "path") {
      const pathOldBounds = el.bounds;

      const relX = (pathOldBounds.x - oldB.x) / oldB.width;
      const relY = (pathOldBounds.y - oldB.y) / oldB.height;
      const relW = pathOldBounds.width / oldB.width;
      const relH = pathOldBounds.height / oldB.height;

      const pathNewBounds = {
        x: newB.x + relX * newB.width,
        y: newB.y + relY * newB.height,
        width: relW * newB.width,
        height: relH * newB.height,
      };

      const newD = resizePath(el.d, pathOldBounds, pathNewBounds);

      updates.set(el.id, {
        d: newD,
        bounds: pathNewBounds,
      });
    } else if (el.type === "polygon" || el.type === "polyline") {
      const newPoints = el.points.map((p) => ({
        x: newB.x + ((p.x - oldB.x) / oldB.width) * newB.width,
        y: newB.y + ((p.y - oldB.y) / oldB.height) * newB.height,
      }));
      updates.set(el.id, { points: newPoints });
    }
  };

  return (
    <div className="flex h-full flex-col gap-0 text-foreground text-xs">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3 font-medium">
        <span className="truncate">{element.name}</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-2">
        {}
        <div className="flex flex-col gap-2">
          <SectionHeader title="Position" />
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="X" value={bounds.x} onChange={handleXChange} />
            <NumberInput label="Y" value={bounds.y} onChange={handleYChange} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              icon={<RotateIcon />}
              value={(element.rotation * 180) / Math.PI}
              onChange={(v) => {
                const newRotation = (v * Math.PI) / 180;
                const deltaRotation = newRotation - element.rotation;

                const updates = new Map<string, Record<string, unknown>>();
                updates.set(element.id, { rotation: newRotation });

                const groupCenterX = bounds.x + bounds.width / 2;
                const groupCenterY = bounds.y + bounds.height / 2;

                const cos = Math.cos(deltaRotation);
                const sin = Math.sin(deltaRotation);

                const traverse = (ids: string[]) => {
                  for (const id of ids) {
                    const el = elements.find((e) => e.id === id);
                    if (!el) continue;

                    if (el.type === "group") {
                      traverse(el.childIds);
                    } else {
                      const elUpdate: Record<string, unknown> = {};

                      if (el.type === "line") {
                        const dx1 = el.x1 - groupCenterX;
                        const dy1 = el.y1 - groupCenterY;
                        const dx2 = el.x2 - groupCenterX;
                        const dy2 = el.y2 - groupCenterY;

                        elUpdate.x1 = groupCenterX + dx1 * cos - dy1 * sin;
                        elUpdate.y1 = groupCenterY + dx1 * sin + dy1 * cos;
                        elUpdate.x2 = groupCenterX + dx2 * cos - dy2 * sin;
                        elUpdate.y2 = groupCenterY + dx2 * sin + dy2 * cos;
                        elUpdate.rotation = el.rotation + deltaRotation;
                      } else if (el.type === "ellipse") {
                        const dcx = el.cx - groupCenterX;
                        const dcy = el.cy - groupCenterY;
                        elUpdate.cx = groupCenterX + dcx * cos - dcy * sin;
                        elUpdate.cy = groupCenterY + dcx * sin + dcy * cos;
                        elUpdate.rotation = el.rotation + deltaRotation;
                      } else if (el.type === "path") {
                        const b = el.bounds;
                        const bCx = b.x + b.width / 2;
                        const bCy = b.y + b.height / 2;

                        const dbCx = bCx - groupCenterX;
                        const dbCy = bCy - groupCenterY;

                        const newBCx = groupCenterX + dbCx * cos - dbCy * sin;
                        const newBCy = groupCenterY + dbCx * sin + dbCy * cos;

                        const newBoundsX = newBCx - b.width / 2;
                        const newBoundsY = newBCy - b.height / 2;

                        elUpdate.bounds = { ...b, x: newBoundsX, y: newBoundsY };
                        elUpdate.rotation = el.rotation + deltaRotation;
                      } else if (el.type === "rect" || el.type === "image" || el.type === "text") {
                        let w = 0;
                        let h = 0;

                        if (el.type === "text") {
                          if (el.bounds) {
                            w = el.bounds.width;
                            h = el.bounds.height;
                          } else {
                            w = 0;
                            h = 0;
                          }
                        } else {
                          w = el.width;
                          h = el.height;
                        }

                        const elCx = el.x + w / 2;
                        const elCy = el.y + h / 2;

                        const dCx = elCx - groupCenterX;
                        const dCy = elCy - groupCenterY;

                        const newCx = groupCenterX + dCx * cos - dCy * sin;
                        const newCy = groupCenterY + dCx * sin + dCy * cos;

                        elUpdate.x = newCx - w / 2;
                        elUpdate.y = newCy - h / 2;
                        elUpdate.rotation = el.rotation + deltaRotation;
                      }

                      updates.set(el.id, elUpdate);
                    }
                  }
                };

                traverse(element.childIds);
                updateElements(updates);
              }}
            />
          </div>
        </div>

        <Separator />

        {}
        <DimensionsSection
          element={element}
          updateElement={handleDimensionsUpdate}
          bounds={{ width: bounds.width, height: bounds.height }}
        />

        <Separator />

        {}
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
          </div>
        </div>

        <Separator />

        <ExportSection element={element} />
      </div>
    </div>
  );
}
