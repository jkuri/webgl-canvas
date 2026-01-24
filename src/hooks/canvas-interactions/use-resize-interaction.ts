import { useCallback, useRef } from "react";
import { calculateBoundingBox } from "@/core";
import { resizePath } from "@/lib/svg-import";
import { useCanvasStore } from "@/store";
import type { BoundingBox, CanvasElement, ResizeHandle, Shape } from "@/types";
import { getElementBounds } from "@/types";
import { collectElementsForResize, flattenCanvasElements } from "./element-helpers";
import type { ElementData, ResizeStartState } from "./types";
import { scheduleUpdate } from "./update-scheduler";

export function useResizeInteraction(
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number },
  getElementById: (id: string) => CanvasElement | undefined,
) {
  const resizeStartRef = useRef<ResizeStartState | null>(null);

  const startResize = useCallback(
    (
      worldX: number,
      worldY: number,
      handle: ResizeHandle,
      selectedElements: CanvasElement[],
      setIsResizing: (resizing: boolean, handle?: ResizeHandle) => void,
    ) => {
      const isSingleRotatedElement =
        selectedElements.length === 1 &&
        (selectedElements[0].rotation !== 0 || selectedElements[0].type === "line") &&
        selectedElements[0].type !== "group";
      const elementRotation = isSingleRotatedElement ? selectedElements[0].rotation : 0;

      let bounds: BoundingBox | null;
      let flattenedElements: CanvasElement[] = [];

      if (isSingleRotatedElement) {
        bounds = getElementBounds(selectedElements[0]);
        flattenedElements = [selectedElements[0]];
      } else {
        flattenedElements = flattenCanvasElements(selectedElements, getElementById);
        bounds = calculateBoundingBox(flattenedElements);
      }

      if (!bounds) return false;

      setIsResizing(true, handle);

      const originalElements = new Map<string, ElementData>();
      collectElementsForResize(flattenedElements, originalElements, getElementById);

      resizeStartRef.current = {
        worldX,
        worldY,
        handle,
        originalBounds: bounds,
        originalElements: originalElements as ResizeStartState["originalElements"],
        isSingleRotatedElement,
        elementRotation,
      };

      return true;
    },
    [getElementById],
  );

  const updateResize = useCallback(
    (clientX: number, clientY: number, shiftKey: boolean) => {
      if (!resizeStartRef.current) return;

      const world = screenToWorld(clientX, clientY);
      const {
        handle,
        originalBounds,
        originalElements,
        isSingleRotatedElement,
        elementRotation,
        worldX: startX,
        worldY: startY,
      } = resizeStartRef.current;

      const deltaX = world.x - startX;
      const deltaY = world.y - startY;

      if (isSingleRotatedElement && originalElements.size === 1) {
        const [id, original] = [...originalElements.entries()][0];

        if (original.type === "rect" || original.type === "image") {
          const cos = Math.cos(elementRotation);
          const sin = Math.sin(elementRotation);
          const cosNeg = Math.cos(-elementRotation);
          const sinNeg = Math.sin(-elementRotation);

          const localDeltaX = deltaX * cosNeg - deltaY * sinNeg;
          const localDeltaY = deltaX * sinNeg + deltaY * cosNeg;

          let newWidth = original.width;
          let newHeight = original.height;
          let anchorLocalX = 0;
          let anchorLocalY = 0;

          if (handle?.includes("e")) {
            newWidth = original.width + localDeltaX;
            anchorLocalX = original.x;
          } else if (handle?.includes("w")) {
            newWidth = original.width - localDeltaX;
            anchorLocalX = original.x + original.width;
          } else {
            anchorLocalX = original.x + original.width / 2;
          }

          if (handle?.includes("s")) {
            newHeight = original.height + localDeltaY;
            anchorLocalY = original.y;
          } else if (handle?.includes("n")) {
            newHeight = original.height - localDeltaY;
            anchorLocalY = original.y + original.height;
          } else {
            anchorLocalY = original.y + original.height / 2;
          }

          const minSize = 20;
          newWidth = Math.max(minSize, newWidth);
          newHeight = Math.max(minSize, newHeight);

          const shouldMaintainRatio = original.aspectRatioLocked || shiftKey;

          if (shouldMaintainRatio) {
            const ratio = original.width / original.height;
            let driveByWidth = true;

            if (handle?.length === 1) {
              if (handle === "n" || handle === "s") driveByWidth = false;
            } else {
              if (Math.abs(localDeltaY * ratio) > Math.abs(localDeltaX)) {
                driveByWidth = false;
              }
            }

            if (driveByWidth) {
              newHeight = newWidth / ratio;
            } else {
              newWidth = newHeight * ratio;
            }
          }

          const origCenterX = original.x + original.width / 2;
          const origCenterY = original.y + original.height / 2;
          const anchorOffsetX = anchorLocalX - origCenterX;
          const anchorOffsetY = anchorLocalY - origCenterY;
          const anchorWorldX = origCenterX + anchorOffsetX * cos - anchorOffsetY * sin;
          const anchorWorldY = origCenterY + anchorOffsetX * sin + anchorOffsetY * cos;

          let finalAnchorOffsetX = 0;
          let finalAnchorOffsetY = 0;
          if (handle?.includes("w")) {
            finalAnchorOffsetX = newWidth / 2;
          } else if (handle?.includes("e")) {
            finalAnchorOffsetX = -newWidth / 2;
          }
          if (handle?.includes("n")) {
            finalAnchorOffsetY = newHeight / 2;
          } else if (handle?.includes("s")) {
            finalAnchorOffsetY = -newHeight / 2;
          }

          const newCenterWorldX = anchorWorldX - (finalAnchorOffsetX * cos - finalAnchorOffsetY * sin);
          const newCenterWorldY = anchorWorldY - (finalAnchorOffsetX * sin + finalAnchorOffsetY * cos);

          const finalX = newCenterWorldX - newWidth / 2;
          const finalY = newCenterWorldY - newHeight / 2;

          scheduleUpdate({
            type: "resize",
            singleUpdate: {
              id,
              data: {
                x: finalX,
                y: finalY,
                width: newWidth,
                height: newHeight,
              },
            },
          });
        } else if (original.type === "line") {
          const currentX1 = original.x1 ?? 0;
          const currentY1 = original.y1 ?? 0;
          const currentX2 = original.x2 ?? 0;
          const currentY2 = original.y2 ?? 0;

          if (handle === "nw") {
            scheduleUpdate({
              type: "resize",
              singleUpdate: {
                id,
                data: {
                  x1: currentX1 + deltaX,
                  y1: currentY1 + deltaY,
                },
              },
            });
          } else if (handle === "se") {
            scheduleUpdate({
              type: "resize",
              singleUpdate: {
                id,
                data: {
                  x2: currentX2 + deltaX,
                  y2: currentY2 + deltaY,
                },
              },
            });
          }
        } else if (original.type === "path") {
          const bounds = original.bounds || { x: 0, y: 0, width: 0, height: 0 };
          const cosNeg = Math.cos(-elementRotation);
          const sinNeg = Math.sin(-elementRotation);

          const localDeltaX = deltaX * cosNeg - deltaY * sinNeg;
          const localDeltaY = deltaX * sinNeg + deltaY * cosNeg;

          let newWidth = bounds.width;
          let newHeight = bounds.height;
          let newX = bounds.x;
          let newY = bounds.y;

          if (handle?.includes("e")) {
            newWidth = bounds.width + localDeltaX;
          } else if (handle?.includes("w")) {
            newWidth = bounds.width - localDeltaX;
            newX = bounds.x + localDeltaX;
          }

          if (handle?.includes("s")) {
            newHeight = bounds.height + localDeltaY;
          } else if (handle?.includes("n")) {
            newHeight = bounds.height - localDeltaY;
            newY = bounds.y + localDeltaY;
          }

          const minSize = 20;
          newWidth = Math.max(minSize, newWidth);
          newHeight = Math.max(minSize, newHeight);

          const shouldMaintainRatio = original.aspectRatioLocked || shiftKey;

          if (shouldMaintainRatio) {
            const ratio = bounds.width / bounds.height;
            let driveByWidth = true;

            if (handle?.length === 1) {
              if (handle === "n" || handle === "s") driveByWidth = false;
            } else {
              if (Math.abs(localDeltaY * ratio) > Math.abs(localDeltaX)) {
                driveByWidth = false;
              }
            }

            if (driveByWidth) {
              newHeight = newWidth / ratio;
            } else {
              newWidth = newHeight * ratio;
            }

            if (handle?.includes("w")) {
              newX = bounds.x + bounds.width - newWidth;
            } else if (!handle?.includes("e")) {
              newX = bounds.x + (bounds.width - newWidth) / 2;
            }

            if (handle?.includes("n")) {
              newY = bounds.y + bounds.height - newHeight;
            } else if (!handle?.includes("s")) {
              newY = bounds.y + (bounds.height - newHeight) / 2;
            }
          }

          const newBounds = { x: newX, y: newY, width: newWidth, height: newHeight };
          const newD = resizePath(original.d!, bounds, newBounds);

          scheduleUpdate({
            type: "resize",
            singleUpdate: {
              id,
              data: {
                d: newD,
                bounds: newBounds,
              },
            },
          });
        }
      } else {
        const shouldMaintainRatio =
          originalElements.size === 1 ? [...originalElements.values()][0].aspectRatioLocked || shiftKey : shiftKey;

        let newBoundsX = originalBounds.x;
        let newBoundsY = originalBounds.y;
        let newBoundsWidth = originalBounds.width;
        let newBoundsHeight = originalBounds.height;

        if (handle?.includes("w")) {
          newBoundsWidth = originalBounds.width - deltaX;
          newBoundsX = originalBounds.x + deltaX;
        } else if (handle?.includes("e")) {
          newBoundsWidth = originalBounds.width + deltaX;
        }

        if (handle?.includes("n")) {
          newBoundsHeight = originalBounds.height - deltaY;
          newBoundsY = originalBounds.y + deltaY;
        } else if (handle?.includes("s")) {
          newBoundsHeight = originalBounds.height + deltaY;
        }

        if (shouldMaintainRatio) {
          const ratio = originalBounds.width / originalBounds.height;
          let driveByWidth = true;

          if (handle?.length === 1) {
            if (handle === "n" || handle === "s") driveByWidth = false;
          } else {
            const deltaW = Math.abs(newBoundsWidth - originalBounds.width);
            const deltaH = Math.abs(newBoundsHeight - originalBounds.height);
            if (deltaH * ratio > deltaW) {
              driveByWidth = false;
            }
          }

          if (driveByWidth) {
            newBoundsHeight = newBoundsWidth / ratio;
          } else {
            newBoundsWidth = newBoundsHeight * ratio;
          }

          if (handle?.includes("w")) {
            newBoundsX = originalBounds.x + originalBounds.width - newBoundsWidth;
          } else if (!handle?.includes("e")) {
            newBoundsX = originalBounds.x + (originalBounds.width - newBoundsWidth) / 2;
          }

          if (handle?.includes("n")) {
            newBoundsY = originalBounds.y + originalBounds.height - newBoundsHeight;
          } else if (!handle?.includes("s")) {
            newBoundsY = originalBounds.y + (originalBounds.height - newBoundsHeight) / 2;
          }
        }

        const minSize = 20;
        if (newBoundsWidth < minSize) {
          if (handle?.includes("w")) newBoundsX = originalBounds.x + originalBounds.width - minSize;
          newBoundsWidth = minSize;
        }
        if (newBoundsHeight < minSize) {
          if (handle?.includes("n")) newBoundsY = originalBounds.y + originalBounds.height - minSize;
          newBoundsHeight = minSize;
        }

        const updates = new Map<string, Record<string, unknown>>();
        for (const [id, original] of originalElements) {
          const relX = (original.x - originalBounds.x) / originalBounds.width;
          const relY = (original.y - originalBounds.y) / originalBounds.height;
          const relW = original.width / originalBounds.width;
          const relH = original.height / originalBounds.height;

          const newX = newBoundsX + relX * newBoundsWidth;
          const newY = newBoundsY + relY * newBoundsHeight;
          const newW = Math.max(1, relW * newBoundsWidth);
          const newH = Math.max(1, relH * newBoundsHeight);

          if (original.type === "rect" || original.type === "image") {
            updates.set(id, { x: newX, y: newY, width: newW, height: newH });
          } else if (original.type === "ellipse") {
            updates.set(id, {
              cx: newX + newW / 2,
              cy: newY + newH / 2,
              rx: newW / 2,
              ry: newH / 2,
            });
          } else if (original.type === "line") {
            const relX1 = ((original.x1 ?? 0) - originalBounds.x) / originalBounds.width;
            const relY1 = ((original.y1 ?? 0) - originalBounds.y) / originalBounds.height;
            const relX2 = ((original.x2 ?? 0) - originalBounds.x) / originalBounds.width;
            const relY2 = ((original.y2 ?? 0) - originalBounds.y) / originalBounds.height;

            updates.set(id, {
              x1: newBoundsX + relX1 * newBoundsWidth,
              y1: newBoundsY + relY1 * newBoundsHeight,
              x2: newBoundsX + relX2 * newBoundsWidth,
              y2: newBoundsY + relY2 * newBoundsHeight,
            });
          } else if (original.type === "path") {
            const oldBounds = original.bounds || { x: 0, y: 0, width: 0, height: 0 };
            const newBounds = {
              ...oldBounds,
              x: newX,
              y: newY,
              width: newW,
              height: newH,
            };
            const newD = resizePath(original.d!, oldBounds, newBounds);

            updates.set(id, {
              d: newD,
              bounds: newBounds,
            });
          }
        }

        if (updates.size > 0) {
          const { snapToGrid, snapToObjects, snapToGeometry } = useCanvasStore.getState();
          const hasSnapping = snapToGrid || snapToObjects || snapToGeometry;
          scheduleUpdate({
            type: "drag",
            updates,
            smartGuides: hasSnapping ? useCanvasStore.getState().smartGuides : [],
          });
        }
      }
    },
    [screenToWorld],
  );

  const endResize = useCallback(() => {
    resizeStartRef.current = null;
  }, []);

  return {
    startResize,
    updateResize,
    endResize,
    resizeStartRef,
  };
}

export function getResizeHandle(
  worldX: number,
  worldY: number,
  selectedElements: CanvasElement[],
  scale: number,
  getElementById: (id: string) => CanvasElement | undefined,
  hitTestRotatedElementHandle: (x: number, y: number, element: Shape, scale: number) => ResizeHandle,
  hitTestBoundsHandle: (x: number, y: number, bounds: BoundingBox, scale: number) => ResizeHandle,
): ResizeHandle {
  if (selectedElements.length === 1 && selectedElements[0].type !== "group" && selectedElements[0].type !== "text") {
    return hitTestRotatedElementHandle(worldX, worldY, selectedElements[0] as Shape, scale);
  } else if (selectedElements.length > 1 || (selectedElements.length === 1 && selectedElements[0].type === "group")) {
    const flattened = flattenCanvasElements(selectedElements, getElementById);
    const bounds = calculateBoundingBox(flattened);
    if (bounds) {
      return hitTestBoundsHandle(worldX, worldY, bounds, scale);
    }
  }
  return null;
}
