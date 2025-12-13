import { create } from "zustand";
import { SHAPE_COLORS } from "@/lib/colors";
import type { ResizeHandle, Shape, Tool, Transform } from "@/types";

interface CanvasState {
  // Shapes
  shapes: Shape[];
  selectedIds: string[];

  // Clipboard
  clipboard: Shape[];

  // Transform
  transform: Transform;

  // Tools & Interaction
  activeTool: Tool;
  isSpaceHeld: boolean;
  isPanning: boolean;
  isDragging: boolean;
  isResizing: boolean;
  isRotating: boolean;
  isMarqueeSelecting: boolean;
  hoveredHandle: ResizeHandle;
  activeResizeHandle: ResizeHandle;

  // Context menu
  contextMenuTarget: Shape | null;

  // Selection box
  selectionBox: { startX: number; startY: number; endX: number; endY: number } | null;
}

interface CanvasActions {
  // Shape actions
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Omit<Shape, "id">>) => void;
  deleteShape: (id: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => string[];
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  // Clipboard actions
  copySelected: () => void;
  paste: () => void;

  // Transform actions for shapes
  flipHorizontal: () => void;
  flipVertical: () => void;

  // Lock actions
  toggleLock: () => void;

  // Selection actions
  setSelectedIds: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  toggleSelection: (id: string) => void;

  // Transform actions
  setTransform: (transform: Partial<Transform>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (scale: number) => void;
  resetView: () => void;

  // Tool actions
  setActiveTool: (tool: Tool) => void;
  setIsSpaceHeld: (held: boolean) => void;

  // Interaction state
  setIsPanning: (panning: boolean) => void;
  setIsDragging: (dragging: boolean) => void;
  setIsResizing: (resizing: boolean, handle?: ResizeHandle) => void;
  setIsRotating: (rotating: boolean) => void;
  setIsMarqueeSelecting: (selecting: boolean) => void;
  setHoveredHandle: (handle: ResizeHandle) => void;
  setActiveResizeHandle: (handle: ResizeHandle) => void;
  setContextMenuTarget: (shape: Shape | null) => void;
  setSelectionBox: (box: { startX: number; startY: number; endX: number; endY: number } | null) => void;

  // Helpers
  getShapeById: (id: string) => Shape | undefined;
  getSelectedShapes: () => Shape[];
}

const DEFAULT_SHAPES: Shape[] = [
  { id: "1", type: "rect", x: 100, y: 100, width: 200, height: 150, rotation: 0, color: SHAPE_COLORS.Blue },
  { id: "2", type: "rect", x: 450, y: 200, width: 150, height: 150, rotation: 0, color: SHAPE_COLORS.Fuchsia },
  { id: "3", type: "rect", x: 200, y: 450, width: 180, height: 120, rotation: 0, color: SHAPE_COLORS.Green },
];

export const useCanvasStore = create<CanvasState & CanvasActions>((set, get) => ({
  // Initial state
  shapes: DEFAULT_SHAPES,
  selectedIds: [],
  clipboard: [],
  transform: { x: 0, y: 0, scale: 1 },
  activeTool: "select",
  isSpaceHeld: false,
  isPanning: false,
  isDragging: false,
  isResizing: false,
  isRotating: false,
  isMarqueeSelecting: false,
  hoveredHandle: null,
  activeResizeHandle: null,
  contextMenuTarget: null,
  selectionBox: null,

  // Shape actions
  addShape: (shape) => set((state) => ({ shapes: [...state.shapes, shape] })),

  updateShape: (id, updates) =>
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),

  deleteShape: (id) =>
    set((state) => ({
      shapes: state.shapes.filter((s) => s.id !== id),
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
    })),

  deleteSelected: () =>
    set((state) => ({
      shapes: state.shapes.filter((s) => !state.selectedIds.includes(s.id)),
      selectedIds: [],
    })),

  duplicateSelected: () => {
    const state = get();
    const newShapes: Shape[] = [];
    const newIds: string[] = [];

    for (const id of state.selectedIds) {
      const shape = state.shapes.find((s) => s.id === id);
      if (shape) {
        const newShape: Shape = {
          ...shape,
          id: crypto.randomUUID(),
          x: shape.x + 20,
          y: shape.y + 20,
        };
        newShapes.push(newShape);
        newIds.push(newShape.id);
      }
    }

    set((state) => ({
      shapes: [...state.shapes, ...newShapes],
      selectedIds: newIds,
    }));

    return newIds;
  },

  bringToFront: (id) =>
    set((state) => {
      const idx = state.shapes.findIndex((s) => s.id === id);
      if (idx === -1) return state;
      const shape = state.shapes[idx];
      const newShapes = [...state.shapes.slice(0, idx), ...state.shapes.slice(idx + 1), shape];
      return { shapes: newShapes };
    }),

  sendToBack: (id) =>
    set((state) => {
      const idx = state.shapes.findIndex((s) => s.id === id);
      if (idx === -1) return state;
      const shape = state.shapes[idx];
      const newShapes = [shape, ...state.shapes.slice(0, idx), ...state.shapes.slice(idx + 1)];
      return { shapes: newShapes };
    }),

  // Clipboard actions
  copySelected: () => {
    const state = get();
    const selectedShapes = state.shapes.filter((s) => state.selectedIds.includes(s.id));
    set({ clipboard: selectedShapes });
  },

  paste: () => {
    const state = get();
    if (state.clipboard.length === 0) return;

    const newShapes: Shape[] = [];
    const newIds: string[] = [];

    for (const shape of state.clipboard) {
      const newShape: Shape = {
        ...shape,
        id: crypto.randomUUID(),
        x: shape.x + 20,
        y: shape.y + 20,
      };
      newShapes.push(newShape);
      newIds.push(newShape.id);
    }

    set((s) => ({
      shapes: [...s.shapes, ...newShapes],
      selectedIds: newIds,
      clipboard: newShapes, // Update clipboard for subsequent pastes
    }));
  },

  // Transform actions for shapes
  flipHorizontal: () =>
    set((state) => {
      if (state.selectedIds.length === 0) return state;

      // Calculate bounding box center of selection
      const selectedShapes = state.shapes.filter((s) => state.selectedIds.includes(s.id));
      let minX = Infinity;
      let maxX = -Infinity;
      for (const shape of selectedShapes) {
        minX = Math.min(minX, shape.x);
        maxX = Math.max(maxX, shape.x + shape.width);
      }
      const centerX = (minX + maxX) / 2;

      return {
        shapes: state.shapes.map((s) => {
          if (!state.selectedIds.includes(s.id)) return s;
          // Mirror x position around center and flip rotation
          const newX = centerX - (s.x + s.width - centerX);
          return { ...s, x: newX, rotation: -s.rotation };
        }),
      };
    }),

  flipVertical: () =>
    set((state) => {
      if (state.selectedIds.length === 0) return state;

      // Calculate bounding box center of selection
      const selectedShapes = state.shapes.filter((s) => state.selectedIds.includes(s.id));
      let minY = Infinity;
      let maxY = -Infinity;
      for (const shape of selectedShapes) {
        minY = Math.min(minY, shape.y);
        maxY = Math.max(maxY, shape.y + shape.height);
      }
      const centerY = (minY + maxY) / 2;

      return {
        shapes: state.shapes.map((s) => {
          if (!state.selectedIds.includes(s.id)) return s;
          // Mirror y position around center and flip rotation
          const newY = centerY - (s.y + s.height - centerY);
          return { ...s, y: newY, rotation: -s.rotation };
        }),
      };
    }),

  // Lock actions
  toggleLock: () =>
    set((state) => {
      if (state.selectedIds.length === 0) return state;
      // Check if any selected shape is unlocked
      const selectedShapes = state.shapes.filter((s) => state.selectedIds.includes(s.id));
      const anyUnlocked = selectedShapes.some((s) => !s.locked);

      return {
        shapes: state.shapes.map((s) => {
          if (!state.selectedIds.includes(s.id)) return s;
          return { ...s, locked: anyUnlocked };
        }),
      };
    }),

  // Selection actions
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  selectAll: () => set((state) => ({ selectedIds: state.shapes.map((s) => s.id) })),
  clearSelection: () => set({ selectedIds: [] }),
  toggleSelection: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((sid) => sid !== id)
        : [...state.selectedIds, id],
    })),

  // Transform actions
  setTransform: (transform) => set((state) => ({ transform: { ...state.transform, ...transform } })),

  zoomIn: () =>
    set((state) => ({
      transform: { ...state.transform, scale: Math.min(state.transform.scale * 1.2, 10) },
    })),

  zoomOut: () =>
    set((state) => ({
      transform: { ...state.transform, scale: Math.max(state.transform.scale / 1.2, 0.1) },
    })),

  zoomTo: (scale) =>
    set((state) => ({
      transform: { ...state.transform, scale: Math.max(0.1, Math.min(10, scale)) },
    })),

  resetView: () => set({ transform: { x: 0, y: 0, scale: 1 } }),

  // Tool actions
  setActiveTool: (tool) => set({ activeTool: tool }),
  setIsSpaceHeld: (held) => set({ isSpaceHeld: held }),

  // Interaction state
  setIsPanning: (panning) => set({ isPanning: panning }),
  setIsDragging: (dragging) => set({ isDragging: dragging }),
  setIsResizing: (resizing, handle) =>
    set({ isResizing: resizing, activeResizeHandle: resizing ? (handle ?? null) : null }),
  setIsRotating: (rotating) => set({ isRotating: rotating }),
  setIsMarqueeSelecting: (selecting) => set({ isMarqueeSelecting: selecting }),
  setHoveredHandle: (handle) => set({ hoveredHandle: handle }),
  setActiveResizeHandle: (handle) => set({ activeResizeHandle: handle }),
  setContextMenuTarget: (shape) => set({ contextMenuTarget: shape }),
  setSelectionBox: (box) => set({ selectionBox: box }),

  // Helpers
  getShapeById: (id) => get().shapes.find((s) => s.id === id),
  getSelectedShapes: () => {
    const state = get();
    return state.shapes.filter((s) => state.selectedIds.includes(s.id));
  },
}));
