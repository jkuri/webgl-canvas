import { create } from "zustand";
import { canvasHistory } from "@/lib/canvas-history";
import type { CanvasElement, GroupElement, ResizeHandle, SmartGuide, Tool, Transform } from "@/types";

let isRestoringFromHistory = false;

interface CanvasState {
  elements: CanvasElement[];
  selectedIds: string[];
  expandedGroupIds: string[];

  clipboard: CanvasElement[];

  transform: Transform;

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

  contextMenuTarget: CanvasElement | null;

  isExporting: boolean;

  selectionBox: { startX: number; startY: number; endX: number; endY: number } | null;

  canvasBackground: string;
  canvasBackgroundVisible: boolean;

  snapToGrid: boolean;
  snapToObjects: boolean;
  snapToGeometry: boolean;
  gridSize: number;
  smartGuides: SmartGuide[];

  isViewMode: boolean;
}

interface CanvasActions {
  setSnapToGrid: (enabled: boolean) => void;
  setSnapToObjects: (enabled: boolean) => void;
  setSnapToGeometry: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setSmartGuides: (guides: SmartGuide[]) => void;

  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, updates: Record<string, unknown>) => void;
  updateElements: (updates: Map<string, Record<string, unknown>>) => void;
  deleteElement: (id: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => string[];
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;

  groupSelected: () => string | null;
  ungroupSelected: () => void;

  copySelected: () => void;
  paste: () => void;

  flipHorizontal: () => void;
  flipVertical: () => void;

  toggleLock: () => void;

  setElementVisibility: (id: string, visible: boolean) => void;

  toggleGroupExpanded: (groupId: string) => void;
  renameElement: (id: string, name: string) => void;

  importElements: (elements: CanvasElement[]) => void;

  setSelectedIds: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  toggleSelection: (id: string) => void;

  setTransform: (transform: Partial<Transform>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (scale: number) => void;
  resetView: () => void;
  panToCenter: (scale?: number, center?: { x: number; y: number }) => void;

  setActiveTool: (tool: Tool) => void;
  setIsSpaceHeld: (held: boolean) => void;

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

  getElementById: (id: string) => CanvasElement | undefined;
  getSelectedElements: () => CanvasElement[];
  getRenderOrder: () => CanvasElement[];
  getTopLevelElements: () => CanvasElement[];
  getChildrenOfGroup: (groupId: string) => CanvasElement[];
  getParentGroup: (elementId: string) => GroupElement | undefined;

  setCanvasBackground: (color: string) => void;
  setCanvasBackgroundVisible: (visible: boolean) => void;

  setViewMode: (viewMode: boolean) => void;

  moveElement: (elementId: string, targetId: string | null, position: "before" | "after" | "inside") => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  loadFromStorage: () => Promise<void>;

  newProject: () => void;
  exportProject: () => void;
  openProject: () => void;
}

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

let elementIndexMap: Map<string, number> | null = null;
let lastElements: CanvasElement[] | null = null;

function getElementIndex(elements: CanvasElement[], id: string): number {
  if (elements !== lastElements) {
    elementIndexMap = new Map();
    for (let i = 0; i < elements.length; i++) {
      elementIndexMap.set(elements[i].id, i);
    }
    lastElements = elements;
  }
  return elementIndexMap?.get(id) ?? -1;
}

export const useCanvasStore = create<CanvasState & CanvasActions>((set, get) => ({
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

  addElement: (element) => set((state) => ({ elements: [...state.elements, element], selectedIds: [element.id] })),

  updateElement: (id, updates) =>
    set((state) => {
      const index = getElementIndex(state.elements, id);
      if (index === -1) return state;

      const newElements = [...state.elements];
      newElements[index] = { ...newElements[index], ...updates } as CanvasElement;
      return { elements: newElements };
    }),

  updateElements: (updates) =>
    set((state) => {
      if (updates.size === 0) return state;

      const newElements = [...state.elements];
      let hasChanges = false;

      for (const [id, update] of updates) {
        const index = getElementIndex(state.elements, id);
        if (index !== -1) {
          newElements[index] = { ...newElements[index], ...update } as CanvasElement;
          hasChanges = true;
        }
      }

      return hasChanges ? { elements: newElements } : state;
    }),

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
    const idMap = new Map<string, string>();

    const topLevelSelected = state.selectedIds.filter((id) => {
      const element = state.elements.find((e) => e.id === id);
      if (!element) return false;

      if (element.parentId && state.selectedIds.includes(element.parentId)) {
        return false;
      }
      return true;
    });

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

    for (const element of elementsToClone) {
      const newId = crypto.randomUUID();
      idMap.set(element.id, newId);
    }

    for (const element of elementsToClone) {
      const newId = idMap.get(element.id)!;

      const newElement = cloneElement(element, newId, 20);

      if (newElement.parentId && idMap.has(newElement.parentId)) {
        newElement.parentId = idMap.get(newElement.parentId);
      } else {
        newElement.parentId = element.parentId;
      }

      if (newElement.type === "group") {
        newElement.childIds = newElement.childIds.map((cid) => idMap.get(cid)).filter(Boolean) as string[];
      }

      newElements.push(newElement);

      if (topLevelSelected.includes(element.id)) {
        newSelectedIds.push(newId);
      }
    }

    const updatedState = [...state.elements, ...newElements];

    const elementsWithNonClonedParents = newElements.filter((e) => e.parentId && !idMap.has(e.parentId));

    for (const newEl of elementsWithNonClonedParents) {
      const parentIdx = updatedState.findIndex((e) => e.id === newEl.parentId);
      if (parentIdx !== -1) {
        const parent = updatedState[parentIdx] as GroupElement;

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

  groupSelected: () => {
    const state = get();
    if (state.selectedIds.length < 2) return null;

    const groupId = crypto.randomUUID();
    const groupName = generateElementName("group", state.elements);

    const selectedTopLevel = state.selectedIds.filter((id) => {
      const element = state.elements.find((e) => e.id === id);
      return element && !element.parentId;
    });

    if (selectedTopLevel.length < 2) return null;

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

  copySelected: () => {
    const state = get();

    const topLevelSelected = state.selectedIds.filter((id) => {
      const element = state.elements.find((e) => e.id === id);
      if (!element) return false;
      if (element.parentId && state.selectedIds.includes(element.parentId)) {
        return false;
      }
      return true;
    });

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
    const idMap = new Map<string, string>();

    for (const element of state.clipboard) {
      const newId = crypto.randomUUID();
      idMap.set(element.id, newId);
    }

    const topLevelInClipboard = state.clipboard.filter((e) => !e.parentId || !idMap.has(e.parentId));

    for (const element of state.clipboard) {
      const newId = idMap.get(element.id)!;

      const newElement = cloneElement(element, newId, 20);

      if (newElement.parentId && idMap.has(newElement.parentId)) {
        newElement.parentId = idMap.get(newElement.parentId);
      } else {
        newElement.parentId = undefined;
      }

      if (newElement.type === "group") {
        newElement.childIds = newElement.childIds.map((cid) => idMap.get(cid)).filter(Boolean) as string[];
      }

      newElements.push(newElement);

      if (topLevelInClipboard.find((pl) => pl.id === element.id)) {
        newSelectedIds.push(newId);
      }
    }

    set((s) => ({
      elements: [...s.elements, ...newElements],
      selectedIds: newSelectedIds,
    }));
  },

  flipHorizontal: () =>
    set((state) => {
      if (state.selectedIds.length === 0) return state;

      const selectedElements = state.elements.filter((e) => state.selectedIds.includes(e.id) && e.type !== "group");
      if (selectedElements.length === 0) return state;

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

  setElementVisibility: (id, visible) =>
    set((state) => ({
      elements: state.elements.map((e) => (e.id === id ? { ...e, visible } : e)),
    })),

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

  importElements: (newElements) =>
    set((state) => {
      if (newElements.length > 1) {
        const groupId = crypto.randomUUID();
        const groupName = generateElementName("group", state.elements);

        const group: GroupElement = {
          id: groupId,
          type: "group",
          name: groupName,
          rotation: 0,
          opacity: 1,
          childIds: newElements.map((e) => e.id),
          expanded: false,
        };

        const groupedElements = newElements.map((e) => ({
          ...e,
          parentId: groupId,
        }));

        const updatedElements = [...state.elements, ...groupedElements, group];

        return {
          elements: updatedElements,
          selectedIds: [groupId],
        };
      }

      const updatedElements = [...state.elements, ...newElements];
      const newIds = newElements.map((e) => e.id);
      return {
        elements: updatedElements,
        selectedIds: newIds,
      };
    }),

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
          minY = Math.min(minY, el.y - el.fontSize);
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

  setActiveTool: (tool) => set({ activeTool: tool }),
  setIsSpaceHeld: (held) => set({ isSpaceHeld: held }),

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

  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setSnapToObjects: (snap) => set({ snapToObjects: snap }),
  setSnapToGeometry: (snap) => set({ snapToGeometry: snap }),
  setGridSize: (size) => set({ gridSize: Math.max(1, size) }),
  setSmartGuides: (guides) => set({ smartGuides: guides }),

  getElementById: (id) => {
    const elements = get().elements;
    const index = getElementIndex(elements, id);
    return index >= 0 ? elements[index] : undefined;
  },

  getSelectedElements: () => {
    const state = get();
    return state.elements.filter((e) => state.selectedIds.includes(e.id));
  },

  getRenderOrder: () => {
    const state = get();

    const result: CanvasElement[] = [];

    const addElement = (element: CanvasElement) => {
      if (element.visible === false) return;
      if (element.type === "group") {
        for (const childId of element.childIds) {
          const child = state.elements.find((e) => e.id === childId);
          if (child) addElement(child);
        }
      } else {
        result.push(element);
      }
    };

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

      const currentIndex = newElements.findIndex((e) => e.id === elementId);
      newElements.splice(currentIndex, 1);

      let newParentId: string | undefined;

      if (position === "inside" && targetId) {
        newParentId = targetId;
      } else if (targetId) {
        const targetElement = state.elements.find((e) => e.id === targetId);
        newParentId = targetElement?.parentId;
      }

      const updatedElement = { ...element, parentId: newParentId };

      if (position === "inside" && targetId) {
        const groupIndex = newElements.findIndex((e) => e.id === targetId);
        if (groupIndex !== -1) {
          const group = newElements[groupIndex] as GroupElement;
          newElements[groupIndex] = {
            ...group,
            childIds: [...group.childIds, elementId],
          };

          newElements.push(updatedElement);
        } else {
          newElements.push(updatedElement);
        }
      } else if (targetId) {
        const targetIndex = newElements.findIndex((e) => e.id === targetId);

        if (newParentId) {
          const parentGroupIndex = newElements.findIndex((e) => e.id === newParentId);
          if (parentGroupIndex !== -1) {
            const parentGroup = newElements[parentGroupIndex] as GroupElement;
            const siblingIndex = parentGroup.childIds.indexOf(targetId);
            const newChildIds = [...parentGroup.childIds];
            if (position === "before") {
              newChildIds.splice(siblingIndex, 0, elementId);
            } else {
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
        newElements.push(updatedElement);
      }

      return { elements: newElements };
    }),

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

let saveTimeout: number | null = null;
const DEBOUNCE_MS = 500;

useCanvasStore.subscribe((state, prevState) => {
  if (state.elements !== prevState.elements && !isRestoringFromHistory) {
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
