import { useCallback, useRef } from "react";
import { calculateBoundingBox } from "@/core";
import type { CanvasElement, ResizeHandle } from "@/types";
import { collectElementsForRotation, flattenCanvasElements } from "./element-helpers";
import type { RotateStartState } from "./types";
import { scheduleUpdate } from "./update-scheduler";

export function useRotateInteraction(
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number },
  getElementById: (id: string) => CanvasElement | undefined,
) {
  const rotateStartRef = useRef<RotateStartState | null>(null);

  const startRotate = useCallback(
    (
      worldX: number,
      worldY: number,
      handle: ResizeHandle,
      selectedElements: CanvasElement[],
      setIsRotating: (rotating: boolean) => void,
    ) => {
      const flattenedElements = flattenCanvasElements(selectedElements, getElementById);
      const bounds = calculateBoundingBox(flattenedElements);

      if (!bounds) return false;

      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      const startAngle = Math.atan2(worldY - centerY, worldX - centerX);

      const originalRotations = new Map<string, number>();
      const originalElements = new Map<
        string,
        {
          x: number;
          y: number;
          width: number;
          height: number;
          rotation: number;
          type: string;
          cx?: number;
          cy?: number;
          rx?: number;
          ry?: number;
          x1?: number;
          y1?: number;
          x2?: number;
          y2?: number;
          d?: string;
          bounds?: { x: number; y: number; width: number; height: number };
          anchorX?: number;
          anchorY?: number;
        }
      >();

      if (selectedElements.length === 1 && selectedElements[0].type === "group") {
        const group = selectedElements[0];
        originalRotations.set(group.id, group.rotation);
        originalElements.set(group.id, {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: group.rotation,
          type: "group",
        });
      }

      collectElementsForRotation(flattenedElements, originalRotations, originalElements);

      setIsRotating(true);
      rotateStartRef.current = {
        startAngle,
        centerX,
        centerY,
        originalRotations,
        originalElements,
        handle,
      };

      return true;
    },
    [getElementById],
  );

  const updateRotate = useCallback(
    (clientX: number, clientY: number) => {
      if (!rotateStartRef.current) return;

      const world = screenToWorld(clientX, clientY);
      const { startAngle, centerX, centerY, originalRotations, originalElements } = rotateStartRef.current;
      const currentAngle = Math.atan2(world.y - centerY, world.x - centerX);
      const deltaAngle = currentAngle - startAngle;

      const updates = new Map<string, Record<string, unknown>>();
      for (const [id, original] of originalElements) {
        const originalRotation = originalRotations.get(id) ?? 0;
        const newRotation = originalRotation + deltaAngle;

        const cos = Math.cos(deltaAngle);
        const sin = Math.sin(deltaAngle);

        const rotatePoint = (x: number, y: number) => ({
          x: centerX + (x - centerX) * cos - (y - centerY) * sin,
          y: centerY + (x - centerX) * sin + (y - centerY) * cos,
        });

        if (original.type === "line") {
          const p1 = rotatePoint(original.x1!, original.y1!);
          const p2 = rotatePoint(original.x2!, original.y2!);

          updates.set(id, {
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            rotation: newRotation,
          });
        } else if (original.type === "group") {
          updates.set(id, {
            rotation: newRotation,
          });
        } else if (original.type === "ellipse") {
          const center = rotatePoint(original.cx!, original.cy!);
          updates.set(id, {
            cx: center.x,
            cy: center.y,
            rotation: newRotation,
          });
        } else if (original.type === "rect" || original.type === "image") {
          const ox = original.x + original.width / 2;
          const oy = original.y + original.height / 2;
          const center = rotatePoint(ox, oy);

          updates.set(id, {
            x: center.x - original.width / 2,
            y: center.y - original.height / 2,
            rotation: newRotation,
          });
        } else if (original.type === "text") {
          const boundsX = original.x;
          const boundsY = original.y;
          const anchorX = original.anchorX ?? boundsX;
          const anchorY = original.anchorY ?? boundsY;

          const visualCenterX = boundsX + original.width / 2;
          const visualCenterY = boundsY + original.height / 2;

          const isSingleElement = originalElements.size === 1;

          if (isSingleElement) {
            updates.set(id, {
              rotation: newRotation,
            });
          } else {
            const newVisualCenter = rotatePoint(visualCenterX, visualCenterY);

            const newBoundsX = newVisualCenter.x - original.width / 2;
            const newBoundsY = newVisualCenter.y - original.height / 2;

            const anchorToBoundsX = boundsX - anchorX;
            const anchorToBoundsY = boundsY - anchorY;

            const rotatedOffsetX = anchorToBoundsX * cos - anchorToBoundsY * sin;
            const rotatedOffsetY = anchorToBoundsX * sin + anchorToBoundsY * cos;

            updates.set(id, {
              x: newBoundsX - rotatedOffsetX,
              y: newBoundsY - rotatedOffsetY,
              rotation: newRotation,
            });
          }
        } else if (original.type === "path") {
          const ox = original.bounds!.x + original.bounds!.width / 2;
          const oy = original.bounds!.y + original.bounds!.height / 2;
          const center = rotatePoint(ox, oy);

          updates.set(id, {
            bounds: {
              ...original.bounds!,
              x: center.x - original.bounds!.width / 2,
              y: center.y - original.bounds!.height / 2,
            },
            rotation: newRotation,
          });
        }
      }

      if (updates.size > 0) {
        scheduleUpdate({
          type: "rotate",
          updates,
        });
      }
    },
    [screenToWorld],
  );

  const endRotate = useCallback(() => {
    rotateStartRef.current = null;
  }, []);

  const getActiveHandle = useCallback(() => rotateStartRef.current?.handle ?? null, []);

  return {
    startRotate,
    updateRotate,
    endRotate,
    getActiveHandle,
    rotateStartRef,
  };
}
