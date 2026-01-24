import type { StateCreator } from "zustand";
import type { CanvasElement } from "@/types";
import { cloneElement, getDescendants } from "../utils";

export interface SelectionSlice {
  selectedIds: string[];
  clipboard: CanvasElement[];

  setSelectedIds: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  toggleSelection: (id: string) => void;
  copySelected: () => void;
  paste: () => void;
  flipHorizontal: () => void;
  flipVertical: () => void;
}

export const createSelectionSlice: StateCreator<SelectionSlice & { elements: CanvasElement[] }, [], [], SelectionSlice> = (set, get) => ({
  selectedIds: [],
  clipboard: [],

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  selectAll: () => set((state) => ({ selectedIds: state.elements.filter((e) => !e.parentId).map((e) => e.id) })),

  clearSelection: () => set({ selectedIds: [] }),

  toggleSelection: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id) ? state.selectedIds.filter((sid) => sid !== id) : [...state.selectedIds, id],
    })),

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
});
