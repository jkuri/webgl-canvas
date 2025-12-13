import { create } from "zustand";
import type { CanvasElement, GroupElement, ResizeHandle, SmartGuide, Tool, Transform } from "@/types";

interface CanvasState {
  // Elements (replaces shapes)
  elements: CanvasElement[];
  selectedIds: string[];
  expandedGroupIds: string[]; // For layers panel UI

  // Clipboard
  clipboard: CanvasElement[];

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
  contextMenuTarget: CanvasElement | null;

  // Selection box
  selectionBox: { startX: number; startY: number; endX: number; endY: number } | null;

  // Page Settings
  canvasBackground: string;
  canvasBackgroundVisible: boolean;

  // Snapping & Guides
  snapToGrid: boolean;
  snapToObjects: boolean;
  snapToGeometry: boolean;
  smartGuides: SmartGuide[];
}

interface CanvasActions {
  // ... existing actions
  setSnapToGrid: (enabled: boolean) => void;
  setSnapToObjects: (enabled: boolean) => void;
  setSnapToGeometry: (enabled: boolean) => void;
  setSmartGuides: (guides: SmartGuide[]) => void;
  // Element actions
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, updates: Record<string, unknown>) => void;
  deleteElement: (id: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => string[];
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  // Grouping actions
  groupSelected: () => string | null;
  ungroupSelected: () => void;

  // Clipboard actions
  copySelected: () => void;
  paste: () => void;

  // Transform actions for elements
  flipHorizontal: () => void;
  flipVertical: () => void;

  // Lock actions
  toggleLock: () => void;

  // Visibility actions
  setElementVisibility: (id: string, visible: boolean) => void;

  // Layers panel
  toggleGroupExpanded: (groupId: string) => void;
  renameElement: (id: string, name: string) => void;

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
  setContextMenuTarget: (element: CanvasElement | null) => void;
  setSelectionBox: (box: { startX: number; startY: number; endX: number; endY: number } | null) => void;

  // Snapping actions
  // setSnapToGrid... removed duplicates
  // Helpers
  getElementById: (id: string) => CanvasElement | undefined;
  getSelectedElements: () => CanvasElement[];
  getRenderOrder: () => CanvasElement[]; // Flattened render order (excludes groups, includes children)
  getTopLevelElements: () => CanvasElement[]; // Elements without parents
  getChildrenOfGroup: (groupId: string) => CanvasElement[];
  getParentGroup: (elementId: string) => GroupElement | undefined;

  // Page Actions
  setCanvasBackground: (color: string) => void;
  setCanvasBackgroundVisible: (visible: boolean) => void;
}

// Helper to generate default element names
function generateElementName(type: CanvasElement["type"], elements: CanvasElement[]): string {
  const prefix =
    type === "rect"
      ? "Rectangle"
      : type === "ellipse"
        ? "Ellipse"
        : type === "line"
          ? "Line"
          : type === "path"
            ? "Path"
            : "Group";
  const count = elements.filter((e) => e.type === type).length + 1;
  return `${prefix} ${count}`;
}

const DEFAULT_ELEMENTS: CanvasElement[] = [
  {
    id: "1",
    type: "rect",
    name: "Rectangle 1",
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    rotation: 0,
    fill: "#3B82F6",
    stroke: null,
    opacity: 1,
  },
  {
    id: "2",
    type: "rect",
    name: "Rectangle 2",
    x: 450,
    y: 200,
    width: 150,
    height: 150,
    rotation: 0,
    fill: "#D946EF",
    stroke: null,
    opacity: 1,
  },
  {
    id: "3",
    type: "ellipse",
    name: "Ellipse 1",
    cx: 290,
    cy: 510,
    rx: 90,
    ry: 60,
    rotation: 0,
    fill: "#10B981",
    stroke: null,
    opacity: 1,
  },
];

export const useCanvasStore = create<CanvasState & CanvasActions>((set, get) => ({
  // Initial state
  elements: DEFAULT_ELEMENTS,
  selectedIds: [],
  expandedGroupIds: [],
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
  canvasBackground: "#F5F5F5",
  canvasBackgroundVisible: true,
  snapToGrid: true,
  snapToObjects: true,
  snapToGeometry: false,
  smartGuides: [],

  // Element actions
  addElement: (element) => set((state) => ({ elements: [...state.elements, element], selectedIds: [element.id] })),

  updateElement: (id, updates) =>
    set((state) => ({
      elements: state.elements.map((el) => {
        if (el.id === id) {
          return { ...el, ...updates } as CanvasElement;
        }
        return el;
      }),
    })),

  deleteElement: (id) =>
    set((state) => {
      const deleteRecursive = (elementId: string, elements: CanvasElement[]): CanvasElement[] => {
        const element = elements.find((e) => e.id === elementId);
        if (!element) return elements;

        let newElements = elements.filter((e) => e.id !== elementId);

        if (element.type === "group") {
          for (const childId of (element as GroupElement).childIds) {
            newElements = deleteRecursive(childId, newElements);
          }
        }
        return newElements;
      };
      return {
        elements: deleteRecursive(id, state.elements),
        selectedIds: state.selectedIds.filter((sid) => sid !== id),
      };
    }),

  deleteSelected: () => {
    const state = get();
    state.selectedIds.forEach((id) => { state.deleteElement(id); });
  },

  duplicateSelected: () => {
    const state = get();
    const newIds: string[] = [];

    const newElements = [...state.elements];

    for (const id of state.selectedIds) {
      const original = state.elements.find((e) => e.id === id);
      if (original) {
        const newId = crypto.randomUUID();
        const copy = { ...original, id: newId, name: `${original.name} Copy` };

        // Offset slightly
        if (copy.type === "rect" || copy.type === "line" || copy.type === "path") {

            if ('x' in copy) copy.x += 20;
            if ('y' in copy) copy.y += 20;
            if ('x1' in copy) { copy.x1 += 20; copy.x2 += 20; }
            if ('y1' in copy) { copy.y1 += 20; copy.y2 += 20; }
        } else if (copy.type === "ellipse") {
             copy.cx += 20;
             copy.cy += 20;
        }

        newElements.push(copy);
        newIds.push(newId);
      }
    }

    set({ elements: newElements, selectedIds: newIds });
    return newIds;
  },

  bringToFront: (id) =>
    set((state) => {
      const index = state.elements.findIndex((e) => e.id === id);
      if (index === -1 || index === state.elements.length - 1) return state;
      const newElements = [...state.elements];
      const [removed] = newElements.splice(index, 1);
      newElements.push(removed);
      return { elements: newElements };
    }),

  sendToBack: (id) =>
    set((state) => {
      const idx = state.elements.findIndex((e) => e.id === id);
      if (idx === -1) return state;
      const element = state.elements[idx];
      const newElements = [element, ...state.elements.slice(0, idx), ...state.elements.slice(idx + 1)];
      return { elements: newElements };
    }),

  // Grouping actions
  groupSelected: () => {
    const state = get();
    if (state.selectedIds.length < 2) return null;

    const groupId = crypto.randomUUID();
    const groupName = generateElementName("group", state.elements);

    // Get selected elements that don't have a parent (top-level only)
    const selectedTopLevel = state.selectedIds.filter((id) => {
      const element = state.elements.find((e) => e.id === id);
      return element && !element.parentId;
    });

    if (selectedTopLevel.length < 2) return null;

    const group: GroupElement = {
      id: groupId,
      type: "group",
      name: groupName,
      rotation: 0,
      opacity: 1,
      childIds: selectedTopLevel,
      expanded: true,
    };

    set((s) => ({
      elements: [...s.elements.map((e) => (selectedTopLevel.includes(e.id) ? { ...e, parentId: groupId } : e)), group],
      selectedIds: [groupId],
    }));

    return groupId;
  },

  ungroupSelected: () =>
    set((state) => {
      const groupsToUngroup = state.selectedIds.filter(
        (id) => state.elements.find((e) => e.id === id)?.type === "group",
      );

      if (groupsToUngroup.length === 0) return state;

      const childIdsToSelect: string[] = [];

      const updatedElements = state.elements
        .map((e) => {
          if (groupsToUngroup.includes(e.parentId ?? "")) {
            childIdsToSelect.push(e.id);
            return { ...e, parentId: undefined };
          }
          return e;
        })
        .filter((e) => !groupsToUngroup.includes(e.id));

      return {
        elements: updatedElements,
        selectedIds: childIdsToSelect,
      };
    }),

  // Clipboard actions
  copySelected: () => {
    const state = get();
    const selectedElements = state.elements.filter((e) => state.selectedIds.includes(e.id));
    set({ clipboard: selectedElements });
  },

  paste: () => {
    const state = get();
    if (state.clipboard.length === 0) return;

    const newElements: CanvasElement[] = [];
    const newIds: string[] = [];

    for (const element of state.clipboard) {
      const newId = crypto.randomUUID();
      if (element.type === "rect") {
        newElements.push({
          ...element,
          id: newId,
          x: element.x + 20,
          y: element.y + 20,
          parentId: undefined,
        });
      } else if (element.type === "ellipse") {
        newElements.push({
          ...element,
          id: newId,
          cx: element.cx + 20,
          cy: element.cy + 20,
          parentId: undefined,
        });
      } else if (element.type === "line") {
        newElements.push({
          ...element,
          id: newId,
          x1: element.x1 + 20,
          y1: element.y1 + 20,
          x2: element.x2 + 20,
          y2: element.y2 + 20,
          parentId: undefined,
        });
      } else if (element.type === "path") {
        newElements.push({
          ...element,
          id: newId,
          bounds: {
            ...element.bounds,
            x: element.bounds.x + 20,
            y: element.bounds.y + 20,
          },
          parentId: undefined,
        });
      }
      // Skip groups in paste for simplicity
      if (element.type !== "group") {
        newIds.push(newId);
      }
    }

    set((s) => ({
      elements: [...s.elements, ...newElements],
      selectedIds: newIds,
      clipboard: newElements,
    }));
  },

  // Transform actions for elements
  flipHorizontal: () =>
    set((state) => {
      if (state.selectedIds.length === 0) return state;

      const selectedElements = state.elements.filter((e) => state.selectedIds.includes(e.id) && e.type !== "group");
      if (selectedElements.length === 0) return state;

      // Calculate bounding box center
      let minX = Infinity;
      let maxX = -Infinity;
      for (const element of selectedElements) {
        if (element.type === "rect") {
          minX = Math.min(minX, element.x);
          maxX = Math.max(maxX, element.x + element.width);
        } else if (element.type === "ellipse") {
          minX = Math.min(minX, element.cx - element.rx);
          maxX = Math.max(maxX, element.cx + element.rx);
        } else if (element.type === "line") {
          minX = Math.min(minX, element.x1, element.x2);
          maxX = Math.max(maxX, element.x1, element.x2);
        }
      }
      const centerX = (minX + maxX) / 2;

      return {
        elements: state.elements.map((e) => {
          if (!state.selectedIds.includes(e.id)) return e;
          if (e.type === "rect") {
            const newX = centerX - (e.x + e.width - centerX);
            return { ...e, x: newX, rotation: -e.rotation };
          }
          if (e.type === "ellipse") {
            const newCx = centerX - (e.cx - centerX);
            return { ...e, cx: newCx, rotation: -e.rotation };
          }
          if (e.type === "line") {
            const newX1 = centerX - (e.x1 - centerX);
            const newX2 = centerX - (e.x2 - centerX);
            return { ...e, x1: newX1, x2: newX2 };
          }
          return e;
        }),
      };
    }),

  flipVertical: () =>
    set((state) => {
      if (state.selectedIds.length === 0) return state;

      const selectedElements = state.elements.filter((e) => state.selectedIds.includes(e.id) && e.type !== "group");
      if (selectedElements.length === 0) return state;

      let minY = Infinity;
      let maxY = -Infinity;
      for (const element of selectedElements) {
        if (element.type === "rect") {
          minY = Math.min(minY, element.y);
          maxY = Math.max(maxY, element.y + element.height);
        } else if (element.type === "ellipse") {
          minY = Math.min(minY, element.cy - element.ry);
          maxY = Math.max(maxY, element.cy + element.ry);
        } else if (element.type === "line") {
          minY = Math.min(minY, element.y1, element.y2);
          maxY = Math.max(maxY, element.y1, element.y2);
        }
      }
      const centerY = (minY + maxY) / 2;

      return {
        elements: state.elements.map((e) => {
          if (!state.selectedIds.includes(e.id)) return e;
          if (e.type === "rect") {
            const newY = centerY - (e.y + e.height - centerY);
            return { ...e, y: newY, rotation: -e.rotation };
          }
          if (e.type === "ellipse") {
            const newCy = centerY - (e.cy - centerY);
            return { ...e, cy: newCy, rotation: -e.rotation };
          }
          if (e.type === "line") {
            const newY1 = centerY - (e.y1 - centerY);
            const newY2 = centerY - (e.y2 - centerY);
            return { ...e, y1: newY1, y2: newY2 };
          }
          return e;
        }),
      };
    }),

  // Lock actions
  toggleLock: () =>
    set((state) => {
      if (state.selectedIds.length === 0) return state;
      const selectedElements = state.elements.filter((e) => state.selectedIds.includes(e.id));
      const anyUnlocked = selectedElements.some((e) => !e.locked);

      return {
        elements: state.elements.map((e) => {
          if (!state.selectedIds.includes(e.id)) return e;
          return { ...e, locked: anyUnlocked };
        }),
      };
    }),

  // Visibility actions
  setElementVisibility: (id, visible) =>
    set((state) => ({
      elements: state.elements.map((e) => (e.id === id ? { ...e, visible } : e)),
    })),

  // Layers panel
  toggleGroupExpanded: (groupId) =>
    set((state) => ({
      expandedGroupIds: state.expandedGroupIds.includes(groupId)
        ? state.expandedGroupIds.filter((id) => id !== groupId)
        : [...state.expandedGroupIds, groupId],
    })),

  renameElement: (id, name) =>
    set((state) => ({
      elements: state.elements.map((e) => (e.id === id ? { ...e, name } : e)),
    })),

  // Selection actions
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  selectAll: () => set((state) => ({ selectedIds: state.elements.filter((e) => !e.parentId).map((e) => e.id) })),
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
  setContextMenuTarget: (element) => set({ contextMenuTarget: element }),
  setSelectionBox: (box) => set({ selectionBox: box }),

  // --- Snapping Actions ---
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setSnapToObjects: (snap) => set({ snapToObjects: snap }),
  setSnapToGeometry: (snap) => set({ snapToGeometry: snap }),
  setSmartGuides: (guides) => set({ smartGuides: guides }),

  // Helpers
  getElementById: (id) => get().elements.find((e) => e.id === id),

  getSelectedElements: () => {
    const state = get();
    return state.elements.filter((e) => state.selectedIds.includes(e.id));
  },

  getRenderOrder: () => {
    const state = get();
    // Return only visible, non-group elements in render order
    // Groups are virtual containers, their children render at their positions
    const result: CanvasElement[] = [];

    const addElement = (element: CanvasElement) => {
      if (element.visible === false) return;
      if (element.type === "group") {
        // Render children of group (in order)
        for (const childId of element.childIds) {
          const child = state.elements.find((e) => e.id === childId);
          if (child) addElement(child);
        }
      } else {
        result.push(element);
      }
    };

    // Start with top-level elements (no parent)
    const topLevel = state.elements.filter((e) => !e.parentId);
    for (const element of topLevel) {
      addElement(element);
    }

    return result;
  },

  getTopLevelElements: () => {
    const state = get();
    return state.elements.filter((e) => !e.parentId);
  },

  getChildrenOfGroup: (groupId) => {
    const state = get();
    const group = state.elements.find((e) => e.id === groupId);
    if (!group || group.type !== "group") return [];
    return group.childIds.map((id) => state.elements.find((e) => e.id === id)).filter(Boolean) as CanvasElement[];
  },

  getParentGroup: (elementId) => {
    const state = get();
    const element = state.elements.find((e) => e.id === elementId);
    if (!element?.parentId) return undefined;
    return state.elements.find((e) => e.id === element.parentId) as GroupElement | undefined;
  },

  setCanvasBackground: (color) => set({ canvasBackground: color }),
  setCanvasBackgroundVisible: (visible) => set({ canvasBackgroundVisible: visible }),
}));
