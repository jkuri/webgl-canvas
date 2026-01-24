import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDragInteraction } from "../use-drag-interaction";
import {
  createEllipse,
  createGetElementById,
  createGroup,
  createLine,
  createPath,
  createRect,
  createScreenToWorld,
  createText,
  resetIdCounter,
} from "./test-utils";

const mockUpdateElements = vi.fn();
const mockSetSmartGuides = vi.fn();

vi.mock("@/store", () => ({
  useCanvasStore: {
    getState: () => ({
      snapToGrid: false,
      snapToObjects: false,
      snapToGeometry: false,
      gridSize: 10,
      smartGuides: [],
      setSmartGuides: mockSetSmartGuides,
      updateElements: mockUpdateElements,
    }),
  },
}));

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
});

describe("useDragInteraction", () => {
  const screenToWorld = createScreenToWorld();

  describe("startDrag", () => {
    it("should initialize drag state for a rect", () => {
      const rect = createRect({ x: 50, y: 50, width: 100, height: 100 });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDrag(75, 75, [rect.id], [rect], setIsDragging);
      });

      expect(setIsDragging).toHaveBeenCalledWith(true);
      expect(result.current.dragStartRef.current).not.toBeNull();
      expect(result.current.dragStartRef.current?.worldX).toBe(75);
      expect(result.current.dragStartRef.current?.worldY).toBe(75);
    });

    it("should collect positions for multiple elements", () => {
      const rect1 = createRect({ x: 0, y: 0 });
      const rect2 = createRect({ x: 100, y: 100 });
      const elements = [rect1, rect2];
      const getElementById = createGetElementById(elements);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDrag(50, 50, [rect1.id, rect2.id], elements, setIsDragging);
      });

      expect(result.current.dragStartRef.current?.elements.size).toBe(2);
    });

    it("should flatten group and collect children", () => {
      const rect = createRect({ x: 10, y: 20 });
      const group = createGroup([rect]);
      const elements = [rect, group];
      const getElementById = createGetElementById(elements);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDrag(50, 50, [group.id], elements, setIsDragging);
      });

      // Should contain the rect (child), not the group
      expect(result.current.dragStartRef.current?.elements.has(rect.id)).toBe(true);
    });
  });

  describe("startDragForElement", () => {
    it("should initialize drag for single rect", () => {
      const rect = createRect({ x: 25, y: 35 });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDragForElement(50, 50, rect, [rect], setIsDragging);
      });

      expect(setIsDragging).toHaveBeenCalledWith(true);
      const elementsMap = result.current.dragStartRef.current?.elements;
      expect(elementsMap?.get(rect.id)).toEqual({ x: 25, y: 35 });
    });

    it("should initialize drag for ellipse with center", () => {
      const ellipse = createEllipse({ cx: 100, cy: 100 });
      const getElementById = createGetElementById([ellipse]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDragForElement(100, 100, ellipse, [ellipse], setIsDragging);
      });

      const elementsMap = result.current.dragStartRef.current?.elements;
      expect(elementsMap?.get(ellipse.id)?.cx).toBe(100);
      expect(elementsMap?.get(ellipse.id)?.cy).toBe(100);
    });

    it("should initialize drag for line with endpoints", () => {
      const line = createLine({ x1: 10, y1: 20, x2: 110, y2: 120 });
      const getElementById = createGetElementById([line]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDragForElement(60, 70, line, [line], setIsDragging);
      });

      const elementsMap = result.current.dragStartRef.current?.elements;
      expect(elementsMap?.get(line.id)?.x1).toBe(10);
      expect(elementsMap?.get(line.id)?.y1).toBe(20);
      expect(elementsMap?.get(line.id)?.x2).toBe(110);
      expect(elementsMap?.get(line.id)?.y2).toBe(120);
    });

    it("should initialize drag for path with bounds", () => {
      const path = createPath({ bounds: { x: 15, y: 25, width: 100, height: 100 } });
      const getElementById = createGetElementById([path]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDragForElement(50, 50, path, [path], setIsDragging);
      });

      const elementsMap = result.current.dragStartRef.current?.elements;
      expect(elementsMap?.get(path.id)?.x).toBe(15);
      expect(elementsMap?.get(path.id)?.y).toBe(25);
    });

    it("should initialize drag for text", () => {
      const text = createText({ x: 40, y: 60 });
      const getElementById = createGetElementById([text]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDragForElement(45, 65, text, [text], setIsDragging);
      });

      const elementsMap = result.current.dragStartRef.current?.elements;
      expect(elementsMap?.get(text.id)).toEqual({ x: 40, y: 60 });
    });
  });

  describe("updateDrag", () => {
    it("should not update when not started", () => {
      const getElementById = createGetElementById([]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      act(() => {
        result.current.updateDrag(100, 100, 1);
      });

      expect(mockUpdateElements).not.toHaveBeenCalled();
    });

    it("should update rect position", () => {
      const rect = createRect({ x: 0, y: 0 });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDragForElement(50, 50, rect, [rect], setIsDragging);
      });

      act(() => {
        result.current.updateDrag(100, 150, 1); // Move by (50, 100)
      });

      expect(mockUpdateElements).toHaveBeenCalled();
      const updates = mockUpdateElements.mock.calls[0][0];
      const update = updates.get(rect.id);
      expect(update?.x).toBe(50);
      expect(update?.y).toBe(100);
    });

    it("should update ellipse center", () => {
      const ellipse = createEllipse({ cx: 50, cy: 50 });
      const getElementById = createGetElementById([ellipse]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDragForElement(50, 50, ellipse, [ellipse], setIsDragging);
      });

      act(() => {
        result.current.updateDrag(80, 90, 1);
      });

      const updates = mockUpdateElements.mock.calls[0][0];
      const update = updates.get(ellipse.id);
      expect(update?.cx).toBe(80);
      expect(update?.cy).toBe(90);
    });

    it("should update line endpoints", () => {
      const line = createLine({ x1: 0, y1: 0, x2: 100, y2: 100 });
      const getElementById = createGetElementById([line]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDragForElement(50, 50, line, [line], setIsDragging);
      });

      act(() => {
        result.current.updateDrag(70, 60, 1); // Delta: (20, 10)
      });

      const updates = mockUpdateElements.mock.calls[0][0];
      const update = updates.get(line.id);
      expect(update?.x1).toBe(20);
      expect(update?.y1).toBe(10);
      expect(update?.x2).toBe(120);
      expect(update?.y2).toBe(110);
    });

    it("should update path bounds", () => {
      const path = createPath({ bounds: { x: 10, y: 20, width: 100, height: 100 } });
      const getElementById = createGetElementById([path]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDragForElement(50, 50, path, [path], setIsDragging);
      });

      act(() => {
        result.current.updateDrag(80, 90, 1); // Delta: (30, 40)
      });

      const updates = mockUpdateElements.mock.calls[0][0];
      const update = updates.get(path.id);
      expect(update?.bounds).toEqual({
        x: 40,
        y: 60,
        width: 100,
        height: 100,
      });
    });

    it("should update text position", () => {
      const text = createText({ x: 10, y: 20 });
      const getElementById = createGetElementById([text]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDragForElement(15, 25, text, [text], setIsDragging);
      });

      act(() => {
        result.current.updateDrag(50, 75, 1); // Delta: (35, 50)
      });

      const updates = mockUpdateElements.mock.calls[0][0];
      const update = updates.get(text.id);
      expect(update?.x).toBe(45);
      expect(update?.y).toBe(70);
    });
  });

  describe("endDrag", () => {
    it("should clear state", () => {
      const rect = createRect();
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDragForElement(50, 50, rect, [rect], setIsDragging);
      });

      expect(result.current.dragStartRef.current).not.toBeNull();

      act(() => {
        result.current.endDrag();
      });

      expect(result.current.dragStartRef.current).toBeNull();
    });
  });

  describe("isDragging", () => {
    it("should return false when not dragging", () => {
      const getElementById = createGetElementById([]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      expect(result.current.isDragging()).toBe(false);
    });

    it("should return true when dragging", () => {
      const rect = createRect();
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useDragInteraction(screenToWorld, getElementById));

      const setIsDragging = vi.fn();
      act(() => {
        result.current.startDragForElement(50, 50, rect, [rect], setIsDragging);
      });

      expect(result.current.isDragging()).toBe(true);
    });
  });
});
