import type { StateCreator } from "zustand";
import type { CanvasElement, SmartGuide, Transform } from "@/types";

export interface UiSlice {
  transform: Transform;
  canvasBackground: string;
  canvasBackgroundVisible: boolean;
  snapToGrid: boolean;
  snapToObjects: boolean;
  snapToGeometry: boolean;
  gridSize: number;
  smartGuides: SmartGuide[];
  isViewMode: boolean;
  isExporting: boolean;

  setTransform: (transform: Partial<Transform>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (scale: number) => void;
  resetView: () => void;
  panToCenter: (scale?: number, center?: { x: number; y: number }) => void;
  setCanvasBackground: (color: string) => void;
  setCanvasBackgroundVisible: (visible: boolean) => void;
  setViewMode: (viewMode: boolean) => void;
  setIsExporting: (isExporting: boolean) => void;
  setSnapToGrid: (enabled: boolean) => void;
  setSnapToObjects: (enabled: boolean) => void;
  setSnapToGeometry: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setSmartGuides: (guides: SmartGuide[]) => void;
}

export const createUiSlice: StateCreator<UiSlice & { elements: CanvasElement[] }, [], [], UiSlice> = (set, get) => ({
  transform: { x: 0, y: 0, scale: 1 },
  canvasBackground: "#F5F5F5",
  canvasBackgroundVisible: true,
  snapToGrid: true,
  snapToObjects: true,
  snapToGeometry: false,
  gridSize: 10,
  smartGuides: [],
  isViewMode: false,
  isExporting: false,

  setTransform: (transform) => set((state) => ({ transform: { ...state.transform, ...transform } })),

  zoomIn: () => {
    const { scale, x, y } = get().transform;
    const newScale = Math.min(scale * 1.2, 10);
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const cx = (viewportCenterX - x) / scale;
    const cy = (viewportCenterY - y) / scale;
    get().panToCenter(newScale, { x: cx, y: cy });
  },

  zoomOut: () => {
    const { scale, x, y } = get().transform;
    const newScale = Math.max(scale / 1.2, 0.1);
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const cx = (viewportCenterX - x) / scale;
    const cy = (viewportCenterY - y) / scale;
    get().panToCenter(newScale, { x: cx, y: cy });
  },

  zoomTo: (newScale) => {
    const { scale, x, y } = get().transform;
    const clampedScale = Math.max(0.1, Math.min(10, newScale));
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const cx = (viewportCenterX - x) / scale;
    const cy = (viewportCenterY - y) / scale;
    get().panToCenter(clampedScale, { x: cx, y: cy });
  },

  resetView: () => get().panToCenter(),

  panToCenter: (scale, center) => {
    const state = get();

    if (center) {
      const targetScale = scale ?? state.transform.scale;
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;

      const newX = viewportCenterX - center.x * targetScale;
      const newY = viewportCenterY - center.y * targetScale;

      set({ transform: { x: newX, y: newY, scale: targetScale } });
      return;
    }

    if (state.elements.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of state.elements) {
      if (el.type === "group") continue;

      if (el.type === "rect" || el.type === "image") {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
      } else if (el.type === "ellipse") {
        minX = Math.min(minX, el.cx - el.rx);
        minY = Math.min(minY, el.cy - el.ry);
        maxX = Math.max(maxX, el.cx + el.rx);
        maxY = Math.max(maxY, el.cy + el.ry);
      } else if (el.type === "line") {
        minX = Math.min(minX, el.x1, el.x2);
        minY = Math.min(minY, el.y1, el.y2);
        maxX = Math.max(maxX, el.x1, el.x2);
        maxY = Math.max(maxY, el.y1, el.y2);
      } else if (el.type === "path") {
        minX = Math.min(minX, el.bounds.x);
        minY = Math.min(minY, el.bounds.y);
        maxX = Math.max(maxX, el.bounds.x + el.bounds.width);
        maxY = Math.max(maxY, el.bounds.y + el.bounds.height);
      } else if (el.type === "polygon" || el.type === "polyline") {
        for (const pt of el.points) {
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x);
          maxY = Math.max(maxY, pt.y);
        }
      } else if (el.type === "text") {
        if (el.bounds) {
          minX = Math.min(minX, el.x + el.bounds.x);
          minY = Math.min(minY, el.y + el.bounds.y);
          maxX = Math.max(maxX, el.x + el.bounds.x + el.bounds.width);
          maxY = Math.max(maxY, el.y + el.bounds.y + el.bounds.height);
        } else {
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y - (el.fontSize || 12));

          maxX = Math.max(maxX, el.x + el.text.length * el.fontSize * 0.6);
          maxY = Math.max(maxY, el.y);
        }
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;

    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;

    const targetScale = scale ?? state.transform.scale;
    const newX = viewportCenterX - contentCenterX * targetScale;
    const newY = viewportCenterY - contentCenterY * targetScale;

    set({ transform: { x: newX, y: newY, scale: targetScale } });
  },

  setCanvasBackground: (color) => set({ canvasBackground: color }),
  setCanvasBackgroundVisible: (visible) => set({ canvasBackgroundVisible: visible }),
  setViewMode: (viewMode) => set({ isViewMode: viewMode }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setSnapToObjects: (snap) => set({ snapToObjects: snap }),
  setSnapToGeometry: (snap) => set({ snapToGeometry: snap }),
  setGridSize: (size) => set({ gridSize: Math.max(1, size) }),
  setSmartGuides: (guides) => set({ smartGuides: guides }),
});
