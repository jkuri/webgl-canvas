import { useCallback, useRef } from "react";
import { useCanvasStore } from "@/store";

export interface CanvasControlsOptions {
  minScale?: number;
  maxScale?: number;
  zoomSensitivity?: number;
}

export function useCanvasControls(options: CanvasControlsOptions = {}) {
  const { minScale = 0.1, maxScale = 10, zoomSensitivity = 0.002 } = options;

  const transform = useCanvasStore((s) => s.transform);
  const setTransform = useCanvasStore((s) => s.setTransform);

  const panStartRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  const handleWheel = useCallback(
    (e: WheelEvent, rect: DOMRect) => {
      const target = e.target as HTMLElement;
      if (target.closest(".pointer-events-auto")) {
        return;
      }

      e.preventDefault();
      const isZoom = e.metaKey || e.ctrlKey;

      if (isZoom) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const delta = -e.deltaY * zoomSensitivity;
        const newScale = Math.max(minScale, Math.min(maxScale, transform.scale * (1 + delta)));
        const scaleRatio = newScale / transform.scale;
        const newX = mouseX - (mouseX - transform.x) * scaleRatio;
        const newY = mouseY - (mouseY - transform.y) * scaleRatio;
        setTransform({ x: newX, y: newY, scale: newScale });
      } else {
        setTransform({
          x: transform.x - e.deltaX,
          y: transform.y - e.deltaY,
        });
      }
    },
    [transform, setTransform, minScale, maxScale, zoomSensitivity],
  );

  const startPan = useCallback(
    (e: MouseEvent) => {
      panStartRef.current = { x: e.clientX, y: e.clientY, startX: transform.x, startY: transform.y };
    },
    [transform],
  );

  const updatePan = useCallback(
    (e: MouseEvent) => {
      if (!panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTransform({
        x: panStartRef.current.startX + dx,
        y: panStartRef.current.startY + dy,
      });
    },
    [setTransform],
  );

  const zoomIn = useCallback(() => {
    setTransform({ scale: Math.min(transform.scale * 1.2, maxScale) });
  }, [transform.scale, setTransform, maxScale]);

  const zoomOut = useCallback(() => {
    setTransform({ scale: Math.max(transform.scale / 1.2, minScale) });
  }, [transform.scale, setTransform, minScale]);

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, [setTransform]);

  const fitToScale = useCallback(
    (scale: number) => {
      setTransform({ scale: Math.max(minScale, Math.min(maxScale, scale)) });
    },
    [setTransform, minScale, maxScale],
  );

  return {
    transform,
    handlers: { handleWheel, startPan, updatePan },
    actions: { zoomIn, zoomOut, resetView, fitToScale },
  };
}
