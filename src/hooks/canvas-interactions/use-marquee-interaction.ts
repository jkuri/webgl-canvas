import { useCallback, useRef } from "react";
import { getShapesInBox } from "@/core";
import { useCanvasStore } from "@/store";
import type { MarqueeStartState } from "./types";
import { scheduleUpdate } from "./update-scheduler";

export function useMarqueeInteraction(screenToWorld: (screenX: number, screenY: number) => { x: number; y: number }) {
  const marqueeStartRef = useRef<MarqueeStartState | null>(null);
  const initialSelectedIdsRef = useRef<string[]>([]);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const startMarquee = useCallback(
    (
      clientX: number,
      clientY: number,
      currentSelectedIds: string[],
      shiftKey: boolean,
      setIsMarqueeSelecting: (selecting: boolean) => void,
      setSelectedIds: (ids: string[]) => void,
      setSelectionBox: (box: { startX: number; startY: number; endX: number; endY: number } | null) => void,
    ) => {
      const world = screenToWorld(clientX, clientY);

      if (!shiftKey) {
        setSelectedIds([]);
        initialSelectedIdsRef.current = [];
      } else {
        initialSelectedIdsRef.current = [...currentSelectedIds];
      }

      setIsMarqueeSelecting(true);
      marqueeStartRef.current = { worldX: world.x, worldY: world.y };
      lastMousePosRef.current = { x: clientX, y: clientY };
      setSelectionBox({ startX: world.x, startY: world.y, endX: world.x, endY: world.y });
    },
    [screenToWorld],
  );

  const updateMarquee = useCallback(
    (clientX: number, clientY: number, currentSelectedIds: string[]) => {
      if (!marqueeStartRef.current) return;

      lastMousePosRef.current = { x: clientX, y: clientY };
      const world = screenToWorld(clientX, clientY);

      const elements = useCanvasStore.getState().elements;
      const boxElements = getShapesInBox(
        {
          startX: marqueeStartRef.current.worldX,
          startY: marqueeStartRef.current.worldY,
          endX: world.x,
          endY: world.y,
        },
        elements,
      );

      let newSelectedIds: string[] | undefined;
      if (boxElements.length > 0 || initialSelectedIdsRef.current.length > 0) {
        const newIds = [...new Set([...initialSelectedIdsRef.current, ...boxElements.map((e) => e.id)])];

        if (newIds.length !== currentSelectedIds.length || !newIds.every((id) => currentSelectedIds.includes(id))) {
          newSelectedIds = newIds;
        }
      } else if (currentSelectedIds.length > 0) {
        newSelectedIds = [];
      }

      scheduleUpdate({
        type: "marquee",
        selectionBox: {
          startX: marqueeStartRef.current.worldX,
          startY: marqueeStartRef.current.worldY,
          endX: world.x,
          endY: world.y,
        },
        selectedIds: newSelectedIds,
      });
    },
    [screenToWorld],
  );

  const endMarquee = useCallback(
    (setSelectedIds: (ids: string[]) => void, setSelectionBox: (box: null) => void) => {
      if (!marqueeStartRef.current) return;

      const world = screenToWorld(lastMousePosRef.current.x, lastMousePosRef.current.y);
      const elements = useCanvasStore.getState().elements;
      const boxElements = getShapesInBox(
        {
          startX: marqueeStartRef.current.worldX,
          startY: marqueeStartRef.current.worldY,
          endX: world.x,
          endY: world.y,
        },
        elements,
      );

      if (boxElements.length > 0 || initialSelectedIdsRef.current.length > 0) {
        setSelectedIds([...new Set([...initialSelectedIdsRef.current, ...boxElements.map((e) => e.id)])]);
      } else {
        setSelectedIds([]);
      }

      setSelectionBox(null);
      marqueeStartRef.current = null;
    },
    [screenToWorld],
  );

  return {
    startMarquee,
    updateMarquee,
    endMarquee,
    marqueeStartRef,
    lastMousePosRef,
  };
}
