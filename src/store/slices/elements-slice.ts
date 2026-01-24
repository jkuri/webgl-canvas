import type { StateCreator } from "zustand";
import { canvasHistory } from "@/lib/canvas-history";
import type { CanvasElement, GroupElement, Transform } from "@/types";
import { cloneElement, generateElementName, getDescendants, getElementIndex } from "../utils";

export interface ElementsSlice {
  elements: CanvasElement[];
  expandedGroupIds: string[];
  isRestoringFromHistory: boolean;

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

  toggleLock: () => void;
  setElementVisibility: (id: string, visible: boolean) => void;
  toggleGroupExpanded: (groupId: string) => void;
  renameElement: (id: string, name: string) => void;

  importElements: (elements: CanvasElement[]) => void;

  moveElement: (elementId: string, targetId: string | null, position: "before" | "after" | "inside") => void;

  getElementById: (id: string) => CanvasElement | undefined;
  getSelectedElements: () => CanvasElement[];
  getRenderOrder: () => CanvasElement[];
  getTopLevelElements: () => CanvasElement[];
  getChildrenOfGroup: (groupId: string) => CanvasElement[];
  getParentGroup: (elementId: string) => GroupElement | undefined;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  loadFromStorage: () => Promise<void>;

  newProject: () => void;
  exportProject: () => void;
  openProject: () => void;
}

interface StoreWithSelection {
  selectedIds: string[];
  canvasBackground: string;
  canvasBackgroundVisible: boolean;
  transform: Transform;
  panToCenter: () => void;
}

export const createElementsSlice: StateCreator<ElementsSlice & StoreWithSelection, [], [], ElementsSlice> = (set, get) => ({
  elements: [],
  expandedGroupIds: [],
  isRestoringFromHistory: false,

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

    const newElementIds = new Set(newElements.map((e) => e.id));
    const elementsWithNonClonedParents = newElements.filter((e) => e.parentId && !newElementIds.has(e.parentId));

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
      const groupsToUngroup = state.selectedIds.filter((id) => state.elements.find((e) => e.id === id)?.type === "group");

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
      set({ isRestoringFromHistory: true, ...snapshot });
      set({ isRestoringFromHistory: false });
    }
  },

  redo: () => {
    const snapshot = canvasHistory.redo();
    if (snapshot) {
      set({ isRestoringFromHistory: true, ...snapshot });
      set({ isRestoringFromHistory: false });
    }
  },

  loadFromStorage: async () => {
    const snapshot = await canvasHistory.loadFromIndexedDB();
    if (snapshot) {
      set({ ...snapshot });
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

          set({
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
});
