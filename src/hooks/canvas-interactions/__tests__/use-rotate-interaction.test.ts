import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRotateInteraction } from "../use-rotate-interaction";
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

vi.mock("@/store", () => ({
  useCanvasStore: {
    getState: () => ({
      updateElements: mockUpdateElements,
    }),
  },
}));

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
});

describe("useRotateInteraction", () => {
  const screenToWorld = createScreenToWorld();

  describe("startRotate", () => {
    it("should return false when no elements have bounds", () => {
      const getElementById = createGetElementById([]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      const success = result.current.startRotate(50, 50, "nw", [], setIsRotating);

      expect(success).toBe(false);
      expect(setIsRotating).not.toHaveBeenCalled();
    });

    it("should initialize rotation for a single rect", () => {
      const rect = createRect({ x: 0, y: 0, width: 100, height: 100, rotation: 0 });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      const success = result.current.startRotate(100, 50, "ne", [rect], setIsRotating);

      expect(success).toBe(true);
      expect(setIsRotating).toHaveBeenCalledWith(true);
      expect(result.current.rotateStartRef.current).not.toBeNull();
      expect(result.current.rotateStartRef.current?.centerX).toBe(50);
      expect(result.current.rotateStartRef.current?.centerY).toBe(50);
    });

    it("should store original rotations for elements", () => {
      const rect = createRect({ rotation: Math.PI / 4 });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      result.current.startRotate(100, 50, "ne", [rect], setIsRotating);

      const originalRotation = result.current.rotateStartRef.current?.originalRotations.get(rect.id);
      expect(originalRotation).toBe(Math.PI / 4);
    });

    it("should handle group rotation by storing group separately", () => {
      const rect = createRect();
      const group = createGroup([rect], { rotation: Math.PI / 2 });
      const elements = [rect, group];
      const getElementById = createGetElementById(elements);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      result.current.startRotate(100, 50, "ne", [group], setIsRotating);

      const groupEntry = result.current.rotateStartRef.current?.originalElements.get(group.id);
      expect(groupEntry?.type).toBe("group");
      expect(groupEntry?.rotation).toBe(Math.PI / 2);
    });

    it("should calculate center from multiple elements", () => {
      const rect1 = createRect({ x: 0, y: 0, width: 50, height: 50 });
      const rect2 = createRect({ x: 100, y: 100, width: 50, height: 50 });
      const elements = [rect1, rect2];
      const getElementById = createGetElementById(elements);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      result.current.startRotate(150, 150, "se", elements, setIsRotating);

      expect(result.current.rotateStartRef.current?.centerX).toBe(75);
      expect(result.current.rotateStartRef.current?.centerY).toBe(75);
    });
  });

  describe("updateRotate", () => {
    it("should not update when not started", () => {
      const getElementById = createGetElementById([]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      act(() => {
        result.current.updateRotate(100, 100);
      });

      expect(mockUpdateElements).not.toHaveBeenCalled();
    });

    it("should calculate new rotation for rect", () => {
      const rect = createRect({ x: 0, y: 0, width: 100, height: 100, rotation: 0 });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      act(() => {
        result.current.startRotate(100, 50, "e", [rect], setIsRotating);
      });

      act(() => {
        result.current.updateRotate(50, 100);
      });

      expect(mockUpdateElements).toHaveBeenCalled();
      const updates = mockUpdateElements.mock.calls[0][0];
      expect(updates.get(rect.id)?.rotation).toBeDefined();
    });

    it("should update group rotation only", () => {
      const rect = createRect({ x: 0, y: 0, width: 100, height: 100 });
      const group = createGroup([rect], { rotation: 0 });
      const elements = [rect, group];
      const getElementById = createGetElementById(elements);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      act(() => {
        result.current.startRotate(100, 50, "e", [group], setIsRotating);
      });

      act(() => {
        result.current.updateRotate(50, 100);
      });

      expect(mockUpdateElements).toHaveBeenCalled();
      const updates = mockUpdateElements.mock.calls[0][0];
      expect(updates.get(group.id)?.rotation).toBeDefined();
    });

    it("should handle line rotation by moving endpoints", () => {
      const line = createLine({ x1: 0, y1: 50, x2: 100, y2: 50 });
      const getElementById = createGetElementById([line]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      act(() => {
        result.current.startRotate(100, 50, "se", [line], setIsRotating);
      });

      act(() => {
        result.current.updateRotate(50, 100);
      });

      expect(mockUpdateElements).toHaveBeenCalled();
      const updates = mockUpdateElements.mock.calls[0][0];
      const update = updates.get(line.id);
      expect(update?.x1).toBeDefined();
      expect(update?.y1).toBeDefined();
      expect(update?.x2).toBeDefined();
      expect(update?.y2).toBeDefined();
    });

    it("should handle ellipse rotation", () => {
      const ellipse = createEllipse({ cx: 50, cy: 50, rx: 50, ry: 30, rotation: 0 });
      const getElementById = createGetElementById([ellipse]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      act(() => {
        result.current.startRotate(100, 50, "e", [ellipse], setIsRotating);
      });

      act(() => {
        result.current.updateRotate(50, 80);
      });

      expect(mockUpdateElements).toHaveBeenCalled();
      const updates = mockUpdateElements.mock.calls[0][0];
      const update = updates.get(ellipse.id);
      expect(update?.rotation).toBeDefined();
    });

    it("should handle path rotation", () => {
      const path = createPath({ bounds: { x: 0, y: 0, width: 100, height: 100 }, rotation: 0 });
      const getElementById = createGetElementById([path]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      act(() => {
        result.current.startRotate(100, 50, "e", [path], setIsRotating);
      });

      act(() => {
        result.current.updateRotate(50, 100);
      });

      expect(mockUpdateElements).toHaveBeenCalled();
      const updates = mockUpdateElements.mock.calls[0][0];
      const update = updates.get(path.id);
      expect(update?.bounds).toBeDefined();
      expect(update?.rotation).toBeDefined();
    });

    it("should handle text rotation", () => {
      const text = createText({ x: 0, y: 0, bounds: { x: 0, y: 0, width: 50, height: 20 }, rotation: 0 });
      const getElementById = createGetElementById([text]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      act(() => {
        result.current.startRotate(50, 10, "e", [text], setIsRotating);
      });

      act(() => {
        result.current.updateRotate(25, 30);
      });

      expect(mockUpdateElements).toHaveBeenCalled();
    });

    it("should rotate rect with existing rotation", () => {
      const rect = createRect({ x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 4 });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      act(() => {
        result.current.startRotate(100, 50, "se", [rect], setIsRotating);
      });

      expect(result.current.rotateStartRef.current?.originalRotations.get(rect.id)).toBe(Math.PI / 4);

      act(() => {
        result.current.updateRotate(50, 100);
      });

      expect(mockUpdateElements).toHaveBeenCalled();
      const updates = mockUpdateElements.mock.calls[0][0];
      const update = updates.get(rect.id);
      expect(update?.rotation).toBeDefined();

      expect(update?.rotation).not.toBe(Math.PI / 4);
    });

    it("should rotate ellipse with existing rotation", () => {
      const ellipse = createEllipse({ cx: 50, cy: 50, rx: 50, ry: 30, rotation: Math.PI / 6 });
      const getElementById = createGetElementById([ellipse]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      act(() => {
        result.current.startRotate(100, 50, "ne", [ellipse], setIsRotating);
      });

      expect(result.current.rotateStartRef.current?.originalRotations.get(ellipse.id)).toBe(Math.PI / 6);

      act(() => {
        result.current.updateRotate(50, 100);
      });

      expect(mockUpdateElements).toHaveBeenCalled();
      const updates = mockUpdateElements.mock.calls[0][0];
      expect(updates.get(ellipse.id)?.rotation).toBeDefined();
    });

    it("should accumulate rotation when rotating already-rotated element", () => {
      const rect = createRect({ x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      act(() => {
        result.current.startRotate(100, 50, "e", [rect], setIsRotating);
      });

      act(() => {
        result.current.updateRotate(50, 100);
      });

      expect(mockUpdateElements).toHaveBeenCalled();
      const updates = mockUpdateElements.mock.calls[0][0];
      const newRotation = updates.get(rect.id)?.rotation as number;
      expect(newRotation).toBeDefined();
      expect(typeof newRotation).toBe("number");
    });

    it("should not lose rotation when rotating by small amounts", () => {
      const rect = createRect({ x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 3 });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      act(() => {
        result.current.startRotate(100, 50, "se", [rect], setIsRotating);
      });

      act(() => {
        result.current.updateRotate(101, 51);
      });

      expect(mockUpdateElements).toHaveBeenCalled();

      mockUpdateElements.mockClear();

      act(() => {
        result.current.updateRotate(102, 52);
      });

      expect(mockUpdateElements).toHaveBeenCalled();
    });
  });

  describe("endRotate", () => {
    it("should clear state", () => {
      const rect = createRect();
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      act(() => {
        result.current.startRotate(100, 50, "ne", [rect], setIsRotating);
      });

      expect(result.current.rotateStartRef.current).not.toBeNull();

      act(() => {
        result.current.endRotate();
      });

      expect(result.current.rotateStartRef.current).toBeNull();
    });
  });

  describe("getActiveHandle", () => {
    it("should return handle during rotation", () => {
      const rect = createRect();
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();
      act(() => {
        result.current.startRotate(100, 50, "ne", [rect], setIsRotating);
      });

      expect(result.current.getActiveHandle()).toBe("ne");
    });

    it("should return null when not rotating", () => {
      const getElementById = createGetElementById([]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      expect(result.current.getActiveHandle()).toBeNull();
    });
  });
});
