import { useCallback, useRef } from "react";
import { type Bounds, calculateSnaps, getBounds } from "@/core/snapping";
import { useCanvasStore } from "@/store";
import type { CanvasElement } from "@/types";
import { collectDraggableElements, getDescendantIds, getSnapCandidatesAndPoints } from "./element-helpers";
import type { DragStartState } from "./types";
import { scheduleUpdate } from "./update-scheduler";

export function useDragInteraction(
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number },
  getElementById: (id: string) => CanvasElement | undefined,
) {
  const dragStartRef = useRef<DragStartState | null>(null);

  const startDrag = useCallback(
    (
      worldX: number,
      worldY: number,
      elementIds: string[],
      elements: CanvasElement[],
      setIsDragging: (dragging: boolean) => void,
    ) => {
      setIsDragging(true);

      const elementsMap = new Map<
        string,
        { x: number; y: number; cx?: number; cy?: number; x1?: number; y1?: number; x2?: number; y2?: number }
      >();

      collectDraggableElements(elementIds, elementsMap, getElementById);

      const excludedIds = getDescendantIds(elementIds, getElementById);
      const snapState = getSnapCandidatesAndPoints(elements, excludedIds);

      const draggedEls = elements.filter((e) => elementIds.includes(e.id));
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      for (const el of draggedEls) {
        const b = getBounds(el, elements);
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }

      const originalBounds: Bounds = {
        minX,
        minY,
        maxX,
        maxY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
      };

      dragStartRef.current = {
        worldX,
        worldY,
        elements: elementsMap,
        snapState,
        originalBounds,
      };
    },
    [getElementById],
  );

  const startDragForElement = useCallback(
    (
      worldX: number,
      worldY: number,
      element: CanvasElement,
      elements: CanvasElement[],
      setIsDragging: (dragging: boolean) => void,
    ) => {
      setIsDragging(true);

      const elementsMap = new Map<
        string,
        { x: number; y: number; cx?: number; cy?: number; x1?: number; y1?: number; x2?: number; y2?: number }
      >();

      if (element.type === "rect" || element.type === "image") {
        elementsMap.set(element.id, { x: element.x, y: element.y });
      } else if (element.type === "ellipse") {
        elementsMap.set(element.id, { x: 0, y: 0, cx: element.cx, cy: element.cy });
      } else if (element.type === "line") {
        elementsMap.set(element.id, {
          x: 0,
          y: 0,
          x1: element.x1,
          y1: element.y1,
          x2: element.x2,
          y2: element.y2,
        });
      } else if (element.type === "path") {
        elementsMap.set(element.id, { x: element.bounds.x, y: element.bounds.y });
      } else if (element.type === "text") {
        elementsMap.set(element.id, { x: element.x, y: element.y });
      }

      const snapState = getSnapCandidatesAndPoints(elements, element.id);
      const b = getBounds(element, elements);
      const originalBounds: Bounds = {
        minX: b.minX,
        minY: b.minY,
        maxX: b.maxX,
        maxY: b.maxY,
        centerX: b.centerX,
        centerY: b.centerY,
      };

      dragStartRef.current = {
        worldX,
        worldY,
        elements: elementsMap,
        snapState,
        originalBounds,
      };
    },
    [],
  );

  const updateDrag = useCallback(
    (clientX: number, clientY: number, scale: number) => {
      if (!dragStartRef.current) return;

      const world = screenToWorld(clientX, clientY);
      const deltaX = world.x - dragStartRef.current.worldX;
      const deltaY = world.y - dragStartRef.current.worldY;

      let finalDeltaX = deltaX;
      let finalDeltaY = deltaY;

      const { snapToGrid, snapToObjects, snapToGeometry, gridSize } = useCanvasStore.getState();

      if (snapToGrid || snapToObjects || snapToGeometry) {
        const originalBounds = dragStartRef.current.originalBounds;
        const snapState = dragStartRef.current.snapState;

        const projected: Bounds = {
          minX: originalBounds.minX + deltaX,
          minY: originalBounds.minY + deltaY,
          maxX: originalBounds.maxX + deltaX,
          maxY: originalBounds.maxY + deltaY,
          centerX: originalBounds.centerX + deltaX,
          centerY: originalBounds.centerY + deltaY,
        };

        const snapResult = calculateSnaps(projected, snapState, {
          snapToGrid,
          snapToObjects,
          snapToGeometry,
          gridSize,
          threshold: 10,
          scale,
        });

        finalDeltaX = deltaX + snapResult.x;
        finalDeltaY = deltaY + snapResult.y;
        useCanvasStore.getState().setSmartGuides(snapResult.guides);
      } else {
        useCanvasStore.getState().setSmartGuides([]);
      }

      const updates = new Map<string, Record<string, unknown>>();
      for (const [id, startPos] of dragStartRef.current.elements) {
        const element = getElementById(id);
        if (!element) continue;

        if (element.type === "rect" || element.type === "image") {
          updates.set(id, { x: startPos.x + finalDeltaX, y: startPos.y + finalDeltaY });
        } else if (element.type === "ellipse") {
          updates.set(id, { cx: (startPos.cx ?? 0) + finalDeltaX, cy: (startPos.cy ?? 0) + finalDeltaY });
        } else if (element.type === "line") {
          updates.set(id, {
            x1: (startPos.x1 ?? 0) + finalDeltaX,
            y1: (startPos.y1 ?? 0) + finalDeltaY,
            x2: (startPos.x2 ?? 0) + finalDeltaX,
            y2: (startPos.y2 ?? 0) + finalDeltaY,
          });
        } else if (element.type === "path") {
          updates.set(id, {
            bounds: {
              ...element.bounds,
              x: startPos.x + finalDeltaX,
              y: startPos.y + finalDeltaY,
            },
          });
        } else if (element.type === "text") {
          updates.set(id, { x: startPos.x + finalDeltaX, y: startPos.y + finalDeltaY });
        }
      }

      if (updates.size > 0) {
        scheduleUpdate({
          type: "drag",
          updates,
          smartGuides: useCanvasStore.getState().smartGuides,
        });
      }
    },
    [screenToWorld, getElementById],
  );

  const endDrag = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  const isDragging = useCallback(() => dragStartRef.current !== null, []);

  return {
    startDrag,
    startDragForElement,
    updateDrag,
    endDrag,
    isDragging,
    dragStartRef,
  };
}
