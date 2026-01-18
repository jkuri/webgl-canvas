import { create } from "zustand";
import { canvasHistory } from "@/lib/canvas-history";
import type { CanvasElement, GroupElement, ResizeHandle, SmartGuide, Tool, Transform } from "@/types";

// Flag to skip auto-save when restoring from undo/redo
let isRestoringFromHistory = false;

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
  isEditingText: boolean;
  editingTextId: string | null;
  hoveredHandle: ResizeHandle;
  activeResizeHandle: ResizeHandle;

  // Context menu
  contextMenuTarget: CanvasElement | null;

  // Export state
  isExporting: boolean;

  // Selection box
  selectionBox: { startX: number; startY: number; endX: number; endY: number } | null;

  // Page Settings
  canvasBackground: string;
  canvasBackgroundVisible: boolean;

  // Snapping & Guides
  snapToGrid: boolean;
  snapToObjects: boolean;
  snapToGeometry: boolean;
  gridSize: number;
  smartGuides: SmartGuide[];

  // View Mode
  isViewMode: boolean;
}

interface CanvasActions {
  // ... existing actions
  setSnapToGrid: (enabled: boolean) => void;
  setSnapToObjects: (enabled: boolean) => void;
  setSnapToGeometry: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setSmartGuides: (guides: SmartGuide[]) => void;
  // Element actions
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, updates: Record<string, unknown>) => void;
  deleteElement: (id: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => string[];
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;

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

  // Import action
  importElements: (elements: CanvasElement[]) => void;

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
  panToCenter: (scale?: number, center?: { x: number; y: number }) => void;

  // Tool actions
  setActiveTool: (tool: Tool) => void;
  setIsSpaceHeld: (held: boolean) => void;

  // Interaction state
  setIsPanning: (panning: boolean) => void;
  setIsDragging: (dragging: boolean) => void;
  setIsResizing: (resizing: boolean, handle?: ResizeHandle) => void;
  setIsRotating: (rotating: boolean) => void;
  setIsMarqueeSelecting: (selecting: boolean) => void;
  setIsEditingText: (editing: boolean, elementId?: string | null) => void;
  setHoveredHandle: (handle: ResizeHandle) => void;
  setActiveResizeHandle: (handle: ResizeHandle) => void;
  setContextMenuTarget: (element: CanvasElement | null) => void;
  setIsExporting: (isExporting: boolean) => void;
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

  // View Mode
  setViewMode: (viewMode: boolean) => void;

  // Drag and Drop
  moveElement: (elementId: string, targetId: string | null, position: "before" | "after" | "inside") => void;

  // History / Persistence
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  loadFromStorage: () => Promise<void>;

  // File operations
  newProject: () => void;
  exportProject: () => void;
  openProject: () => void;
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
            : type === "text"
              ? "Text"
              : type === "polygon"
                ? "Polygon"
                : type === "polyline"
                  ? "Polyline"
                  : type === "image"
                    ? "Image"
                    : "Group";
  const count = elements.filter((e) => e.type === type).length + 1;
  return `${prefix} ${count}`;
}

// Helper to deep clone an element and offset it
const cloneElement = (element: CanvasElement, newId: string, offset: number = 20): CanvasElement => {
  const copy = { ...element, id: newId, name: `${element.name} Copy` };

  if (copy.type === "rect" || copy.type === "image" || copy.type === "text") {
    copy.x += offset;
    copy.y += offset;
  } else if (copy.type === "ellipse") {
    copy.cx += offset;
    copy.cy += offset;
  } else if (copy.type === "line") {
    copy.x1 += offset;
    copy.y1 += offset;
    copy.x2 += offset;
    copy.y2 += offset;
  } else if (copy.type === "path") {
    copy.bounds = {
      ...copy.bounds,
      x: copy.bounds.x + offset,
      y: copy.bounds.y + offset,
    };
  } else if (copy.type === "polygon" || copy.type === "polyline") {
    copy.points = copy.points.map((p) => ({ x: p.x + offset, y: p.y + offset }));
  }

  return copy;
};

// Helper to recursively get all descendants of a group
const getDescendants = (
  groupId: string,
  elements: CanvasElement[],
  collected: CanvasElement[] = [],
): CanvasElement[] => {
  const group = elements.find((e) => e.id === groupId);
  if (!group || group.type !== "group") return collected;

  for (const childId of group.childIds) {
    const child = elements.find((e) => e.id === childId);
    if (child) {
      collected.push(child);
      if (child.type === "group") {
        getDescendants(child.id, elements, collected);
      }
    }
  }
  return collected;
};

export const useCanvasStore = create<CanvasState & CanvasActions>((set, get) => ({
  // Initial state
  elements: [],
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
  isEditingText: false,
  editingTextId: null,
  hoveredHandle: null,
  activeResizeHandle: null,
  contextMenuTarget: null,
  isExporting: false,
  selectionBox: null,
  canvasBackground: "#F5F5F5",
  canvasBackgroundVisible: true,
  snapToGrid: true,
  snapToObjects: true,
  snapToGeometry: false,
  gridSize: 10,
  smartGuides: [],
  isViewMode: false,

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
    state.selectedIds.forEach((id) => {
      state.deleteElement(id);
    });
  },

  duplicateSelected: () => {
    const state = get();
    if (state.selectedIds.length === 0) return [];

    const newElements: CanvasElement[] = [];
    const newSelectedIds: string[] = [];
    const idMap = new Map<string, string>(); // Old ID -> New ID

    // 1. Identify top-level selected elements (elements whose parents are NOT also selected)
    // This avoids double-cloning children of selected groups
    const topLevelSelected = state.selectedIds.filter((id) => {
      const element = state.elements.find((e) => e.id === id);
      if (!element) return false;
      // If element has a parent, and that parent is ALSO selected, skip this element (it will be cloned by the parent)
      if (element.parentId && state.selectedIds.includes(element.parentId)) {
        return false;
      }
      return true;
    });

    // 2. Gather all descendants for these top-level elements
    const elementsToClone: CanvasElement[] = [];

    for (const id of topLevelSelected) {
      const element = state.elements.find((e) => e.id === id);
      if (element) {
        elementsToClone.push(element);
        if (element.type === "group") {
          const descendants = getDescendants(element.id, state.elements);
          elementsToClone.push(...descendants);
        }
      }
    }

    // 3. Create new IDs and clone elements
    for (const element of elementsToClone) {
      const newId = crypto.randomUUID();
      idMap.set(element.id, newId);
    }

    for (const element of elementsToClone) {
      const newId = idMap.get(element.id)!;
      // Apply offset ONLY to top-level items in this selection batch
      // Descendants naturally follow their parents if parents are offset,
      // BUT `cloneElement` applies offset to geometry.
      // If we offset a group, we shouldn't double-offset children if they are absolute.
      // However, our `cloneElement` applies offset to absolute coords.
      // So effectively, we shift EVERYTHING in the batch by 20px.

      const newElement = cloneElement(element, newId, 20);

      // Re-link hierarchy
      if (newElement.parentId && idMap.has(newElement.parentId)) {
        newElement.parentId = idMap.get(newElement.parentId);
      } else {
        // If parent wasn't selected/cloned, drop the parent ref (orphan it? or keep original parent?)
        // If we duplicate a selection, likely we want new copies to be siblings of originals (share parent)
        // unless parent was also duplicated.
        // Current logic: if parent NOT in map, keep original parentId (add to same group)
        // OR make it top-level?
        // Figma behavior: Duplicate inside group -> stays in group.
        newElement.parentId = element.parentId;

        // If we simply keep parentId, we must ensure the parent group gets updated with new child ID.
        // But `updateElement` isn't called here. Use `set` logic later?
        // Actually, we must push updates to the parent group element if it exists in state but not in clone set.
      }

      if (newElement.type === "group") {
        newElement.childIds = newElement.childIds.map((cid) => idMap.get(cid)).filter(Boolean) as string[];
      }

      newElements.push(newElement);

      // If this was one of the originally selected top-level items, select the new copy
      if (topLevelSelected.includes(element.id)) {
        newSelectedIds.push(newId);
      }
    }

    // 4. Handle adding to existing parents (siblings of original selection)
    const updatedState = [...state.elements, ...newElements];

    // We need to update existing parents to include these new children
    const elementsWithNonClonedParents = newElements.filter((e) => e.parentId && !idMap.has(e.parentId));

    for (const newEl of elementsWithNonClonedParents) {
      const parentIdx = updatedState.findIndex((e) => e.id === newEl.parentId);
      if (parentIdx !== -1) {
        const parent = updatedState[parentIdx] as GroupElement;
        // Insert new child after the original child?
        // Find index of original ID
        // const originalId = ... (we'd need reverse lookup or iterate idMap)
        // Simplest: append for now.
        updatedState[parentIdx] = {
          ...parent,
          childIds: [...parent.childIds, newEl.id],
        };
      }
    }

    set({ elements: updatedState, selectedIds: newSelectedIds });
    return newSelectedIds;
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

  bringForward: (id) =>
    set((state) => {
      const idx = state.elements.findIndex((e) => e.id === id);
      if (idx === -1 || idx === state.elements.length - 1) return state;
      const newElements = [...state.elements];
      [newElements[idx], newElements[idx + 1]] = [newElements[idx + 1], newElements[idx]];
      return { elements: newElements };
    }),

  sendBackward: (id) =>
    set((state) => {
      const idx = state.elements.findIndex((e) => e.id === id);
      if (idx <= 0) return state;
      const newElements = [...state.elements];
      [newElements[idx - 1], newElements[idx]] = [newElements[idx], newElements[idx - 1]];
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

    // Sort by z-index (position in elements array) to preserve visual stacking order
    selectedTopLevel.sort((a, b) => {
      const indexA = state.elements.findIndex((e) => e.id === a);
      const indexB = state.elements.findIndex((e) => e.id === b);
      return indexA - indexB;
    });

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
    // Similar logic to duplicate: gather all descendants
    // 1. Identify top-level selected
    const topLevelSelected = state.selectedIds.filter((id) => {
      const element = state.elements.find((e) => e.id === id);
      if (!element) return false;
      if (element.parentId && state.selectedIds.includes(element.parentId)) {
        return false;
      }
      return true;
    });

    // 2. Collect descendants
    const elementsToCopy: CanvasElement[] = [];
    for (const id of topLevelSelected) {
      const element = state.elements.find((e) => e.id === id);
      if (element) {
        elementsToCopy.push(element);
        if (element.type === "group") {
          const descendants = getDescendants(element.id, state.elements);
          elementsToCopy.push(...descendants);
        }
      }
    }

    set({ clipboard: elementsToCopy });
  },

  paste: () => {
    const state = get();
    if (state.clipboard.length === 0) return;

    const newElements: CanvasElement[] = [];
    const newSelectedIds: string[] = [];
    const idMap = new Map<string, string>(); // Old ID -> New ID

    // 1. Generate new IDs map
    for (const element of state.clipboard) {
      const newId = crypto.randomUUID();
      idMap.set(element.id, newId);
    }

    // 2. Clone and fix references
    // Identify top-level items in clipboard relative to the clipboard set
    // (An item is top-level in clipboard if its parent is NOT in clipboard)
    const topLevelInClipboard = state.clipboard.filter((e) => !e.parentId || !idMap.has(e.parentId));

    for (const element of state.clipboard) {
      const newId = idMap.get(element.id)!;

      // Apply offset ONLY to top-level pasted items
      // (Descendants follow 20px via parent, or via cloneElement logic)
      // Actually cloneElement adds 20px to absolute geometry.
      // If we clone everything with 20px offset, we shift the whole group 20px.
      // This is correct for absolute coords.
      const newElement = cloneElement(element, newId, 20);

      // Fix parentId
      if (newElement.parentId && idMap.has(newElement.parentId)) {
        newElement.parentId = idMap.get(newElement.parentId);
      } else {
        // If parent logic above says it's top-level in clipboard, we unset parentId
        // so it pastes to root (or we could paste into current selection if we wanted nesting)
        // For now: paste to root
        newElement.parentId = undefined;
      }

      // Fix childIds for groups
      if (newElement.type === "group") {
        newElement.childIds = newElement.childIds.map((cid) => idMap.get(cid)).filter(Boolean) as string[];
      }

      newElements.push(newElement);

      // Select top-level pasted items
      if (topLevelInClipboard.find((pl) => pl.id === element.id)) {
        newSelectedIds.push(newId);
      }
    }

    set((s) => ({
      elements: [...s.elements, ...newElements],
      selectedIds: newSelectedIds,
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

  // Import action
  importElements: (newElements) =>
    set((state) => {
      // If importing multiple elements, group them automatically
      if (newElements.length > 1) {
        const groupId = crypto.randomUUID();
        const groupName = generateElementName("group", state.elements);

        // Create the group element
        const group: GroupElement = {
          id: groupId,
          type: "group",
          name: groupName,
          rotation: 0,
          opacity: 1,
          childIds: newElements.map((e) => e.id),
          expanded: false,
        };

        // Assign parentId to all imported elements
        const groupedElements = newElements.map((e) => ({
          ...e,
          parentId: groupId,
        }));

        const updatedElements = [...state.elements, ...groupedElements, group];

        return {
          elements: updatedElements,
          selectedIds: [groupId], // Select the group
        };
      }

      // Single element import - normal behavior
      const updatedElements = [...state.elements, ...newElements];
      const newIds = newElements.map((e) => e.id);
      return {
        elements: updatedElements,
        selectedIds: newIds,
      };
    }),

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

  setIsExporting: (isExporting) => set({ isExporting }),

  // Transform actions
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

    // If center is provided, use it
    if (center) {
      const targetScale = scale ?? state.transform.scale;
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;

      const newX = viewportCenterX - center.x * targetScale;
      const newY = viewportCenterY - center.y * targetScale;

      set({ transform: { x: newX, y: newY, scale: targetScale } });
      return;
    }

    // Otherwise, calculate center of all elements
    if (state.elements.length === 0) return;

    // Calculate bounding box of all elements
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of state.elements) {
      if (el.type === "group") continue; // Skip groups, we'll use their children

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
          // Text bounds are relative to element position, so add el.x/el.y
          minX = Math.min(minX, el.x + el.bounds.x);
          minY = Math.min(minY, el.y + el.bounds.y);
          maxX = Math.max(maxX, el.x + el.bounds.x + el.bounds.width);
          maxY = Math.max(maxY, el.y + el.bounds.y + el.bounds.height);
        } else {
          // Fallback approximation
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y - el.fontSize);
          maxX = Math.max(maxX, el.x + el.text.length * el.fontSize * 0.6);
          maxY = Math.max(maxY, el.y);
        }
      }
    }

    // If no valid bounds found, do nothing
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;

    // Calculate center of all elements
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    // Calculate viewport center
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;

    // Calculate new transform to center content
    const targetScale = scale ?? state.transform.scale;
    const newX = viewportCenterX - contentCenterX * targetScale;
    const newY = viewportCenterY - contentCenterY * targetScale;

    set({ transform: { x: newX, y: newY, scale: targetScale } });
  },

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
  setIsEditingText: (editing, elementId) => set({ isEditingText: editing, editingTextId: elementId ?? null }),
  setHoveredHandle: (handle) => set({ hoveredHandle: handle }),
  setActiveResizeHandle: (handle) => set({ activeResizeHandle: handle }),
  setContextMenuTarget: (element) => set({ contextMenuTarget: element }),
  setSelectionBox: (box) => set({ selectionBox: box }),

  // --- Snapping Actions ---
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setSnapToObjects: (snap) => set({ snapToObjects: snap }),
  setSnapToGeometry: (snap) => set({ snapToGeometry: snap }),
  setGridSize: (size) => set({ gridSize: Math.max(1, size) }),
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
  setViewMode: (viewMode) => set({ isViewMode: viewMode }),

  moveElement: (elementId, targetId, position) =>
    set((state) => {
      const elementIndex = state.elements.findIndex((e) => e.id === elementId);
      if (elementIndex === -1) return state;

      const element = state.elements[elementIndex];
      const newElements = [...state.elements];

      // Remove from old parent
      if (element.parentId) {
        const parentGroupIndex = newElements.findIndex((e) => e.id === element.parentId);
        if (parentGroupIndex !== -1) {
          const parentGroup = newElements[parentGroupIndex] as GroupElement;
          newElements[parentGroupIndex] = {
            ...parentGroup,
            childIds: parentGroup.childIds.filter((id) => id !== elementId),
          };
        }
      }

      // Remove from array (temporarily)
      const currentIndex = newElements.findIndex((e) => e.id === elementId);
      newElements.splice(currentIndex, 1);

      let newParentId: string | undefined;

      // Determine new parent
      if (position === "inside" && targetId) {
        newParentId = targetId;
      } else if (targetId) {
        // Find target to get its parent
        const targetElement = state.elements.find((e) => e.id === targetId);
        newParentId = targetElement?.parentId;
      }

      const updatedElement = { ...element, parentId: newParentId };

      // Insert logic
      if (position === "inside" && targetId) {
        // Add to group children
        const groupIndex = newElements.findIndex((e) => e.id === targetId);
        if (groupIndex !== -1) {
          const group = newElements[groupIndex] as GroupElement;
          newElements[groupIndex] = {
            ...group,
            childIds: [...group.childIds, elementId],
          };
          // For visualization/render order, append to end of list
          // or just after the group?
          // If we append to end, it draws on top.
          newElements.push(updatedElement);
        } else {
          // Fallback
          newElements.push(updatedElement);
        }
      } else if (targetId) {
        // Insert relative to target
        const targetIndex = newElements.findIndex((e) => e.id === targetId);

        // Handle insertion into sibling group
        if (newParentId) {
          const parentGroupIndex = newElements.findIndex((e) => e.id === newParentId);
          if (parentGroupIndex !== -1) {
            const parentGroup = newElements[parentGroupIndex] as GroupElement;
            const siblingIndex = parentGroup.childIds.indexOf(targetId);
            const newChildIds = [...parentGroup.childIds];
            if (position === "before") {
              newChildIds.splice(siblingIndex, 0, elementId);
            } else {
              // after
              newChildIds.splice(siblingIndex + 1, 0, elementId);
            }
            newElements[parentGroupIndex] = {
              ...parentGroup,
              childIds: newChildIds,
            };
          }
        }

        if (targetIndex !== -1) {
          if (position === "before") {
            newElements.splice(targetIndex, 0, updatedElement);
          } else {
            newElements.splice(targetIndex + 1, 0, updatedElement);
          }
        } else {
          newElements.push(updatedElement);
        }
      } else {
        // No target (e.g. dropped at root end), just append
        newElements.push(updatedElement);
      }

      return { elements: newElements };
    }),

  // History / Persistence actions
  pushHistory: () => {
    const state = get();
    canvasHistory.push({
      elements: state.elements,
      canvasBackground: state.canvasBackground,
      canvasBackgroundVisible: state.canvasBackgroundVisible,
    });
  },

  undo: () => {
    const snapshot = canvasHistory.undo();
    if (snapshot) {
      isRestoringFromHistory = true;
      set({
        elements: snapshot.elements,
        canvasBackground: snapshot.canvasBackground,
        canvasBackgroundVisible: snapshot.canvasBackgroundVisible,
      });
      isRestoringFromHistory = false;
    }
  },

  redo: () => {
    const snapshot = canvasHistory.redo();
    if (snapshot) {
      isRestoringFromHistory = true;
      set({
        elements: snapshot.elements,
        canvasBackground: snapshot.canvasBackground,
        canvasBackgroundVisible: snapshot.canvasBackgroundVisible,
      });
      isRestoringFromHistory = false;
    }
  },

  loadFromStorage: async () => {
    const snapshot = await canvasHistory.loadFromIndexedDB();
    if (snapshot) {
      set({
        elements: snapshot.elements,
        canvasBackground: snapshot.canvasBackground,
        canvasBackgroundVisible: snapshot.canvasBackgroundVisible,
      });
      get().panToCenter();
    }
  },

  // File operations
  newProject: () => {
    canvasHistory.clear();
    set({
      elements: [],
      selectedIds: [],
      canvasBackground: "#F5F5F5",
      canvasBackgroundVisible: true,
      transform: { x: 0, y: 0, scale: 1 },
    });
  },

  exportProject: () => {
    const state = get();
    const projectData = {
      version: 1,
      elements: state.elements,
      canvasBackground: state.canvasBackground,
      canvasBackgroundVisible: state.canvasBackgroundVisible,
      transform: state.transform,
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `canvas-project-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  openProject: () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.elements && Array.isArray(data.elements)) {
          canvasHistory.clear();
          // Use setState directly to avoid closure issues with async
          useCanvasStore.setState({
            elements: data.elements,
            selectedIds: [],
            canvasBackground: data.canvasBackground || "#F5F5F5",
            canvasBackgroundVisible: data.canvasBackgroundVisible ?? true,
            transform: data.transform || { x: 0, y: 0, scale: 1 },
          });
        } else {
          console.error("Invalid project file format");
        }
      } catch (error) {
        console.error("Failed to open project:", error);
      }
    };
    input.click();
  },
}));

// Auto-save state to IndexedDB whenever elements change (debounced)
let saveTimeout: number | null = null;
const DEBOUNCE_MS = 500;

useCanvasStore.subscribe((state, prevState) => {
  // Only save when elements change (not for UI state changes)
  // Skip if we're restoring from undo/redo to avoid clearing the redo stack
  if (state.elements !== prevState.elements && !isRestoringFromHistory) {
    // Debounce the save
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = window.setTimeout(() => {
      canvasHistory.push({
        elements: state.elements,
        canvasBackground: state.canvasBackground,
        canvasBackgroundVisible: state.canvasBackgroundVisible,
      });
      saveTimeout = null;
    }, DEBOUNCE_MS);
  }
});
