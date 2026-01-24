import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useResizeInteraction } from "../use-resize-interaction";
import { useRotateInteraction } from "../use-rotate-interaction";
import { createGetElementById, createRect, createScreenToWorld, resetIdCounter } from "./test-utils";

const mockUpdateElement = vi.fn();
const mockUpdateElements = vi.fn();

vi.mock("@/store", () => ({
  useCanvasStore: {
    getState: () => ({
      snapToGrid: false,
      snapToObjects: false,
      snapToGeometry: false,
      smartGuides: [],
      updateElement: mockUpdateElement,
      updateElements: mockUpdateElements,
    }),
  },
}));

vi.mock("@/lib/svg-import", () => ({
  resizePath: vi.fn((d) => d),
}));

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
});

describe("Rotated Element Canvas Interactions - Integration Tests", () => {
  const screenToWorld = createScreenToWorld();

  describe("Resize of pre-rotated elements", () => {
    it("should correctly resize a 45-degree rotated rect from SE corner", () => {
      const rect = createRect({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: Math.PI / 4,
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useResizeInteraction(screenToWorld, getElementById));

      const setIsResizing = vi.fn();

      act(() => {
        const success = result.current.startResize(200, 200, "se", [rect], setIsResizing);
        expect(success).toBe(true);
      });

      expect(result.current.resizeStartRef.current).not.toBeNull();
      expect(result.current.resizeStartRef.current?.isSingleRotatedElement).toBe(true);
      expect(result.current.resizeStartRef.current?.elementRotation).toBe(Math.PI / 4);

      const originalData = result.current.resizeStartRef.current?.originalElements.get(rect.id);
      expect(originalData).toBeDefined();
      expect(originalData?.width).toBe(100);
      expect(originalData?.height).toBe(100);
      expect(originalData?.x).toBe(100);
      expect(originalData?.y).toBe(100);

      act(() => {
        result.current.updateResize(250, 250, false);
      });

      expect(mockUpdateElement).toHaveBeenCalled();
      const [id, data] = mockUpdateElement.mock.calls[0];

      expect(id).toBe(rect.id);
      expect(typeof data.x).toBe("number");
      expect(typeof data.y).toBe("number");
      expect(typeof data.width).toBe("number");
      expect(typeof data.height).toBe("number");

      expect(Number.isFinite(data.x)).toBe(true);
      expect(Number.isFinite(data.y)).toBe(true);
      expect(Number.isFinite(data.width)).toBe(true);
      expect(Number.isFinite(data.height)).toBe(true);

      expect(data.width).toBeGreaterThan(100);

      expect(data.height).toBe(100);
    });

    it("should correctly resize a 90-degree rotated rect from NW corner", () => {
      const rect = createRect({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: Math.PI / 2,
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useResizeInteraction(screenToWorld, getElementById));

      const setIsResizing = vi.fn();

      act(() => {
        result.current.startResize(100, 100, "nw", [rect], setIsResizing);
      });

      act(() => {
        result.current.updateResize(80, 80, false);
      });

      expect(mockUpdateElement).toHaveBeenCalled();
      const [, data] = mockUpdateElement.mock.calls[0];
      expect(Number.isFinite(data.width)).toBe(true);
      expect(Number.isFinite(data.height)).toBe(true);
    });

    it("should maintain aspect ratio when shift is held during resize of rotated element", () => {
      const rect = createRect({
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        rotation: Math.PI / 6,
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useResizeInteraction(screenToWorld, getElementById));

      const setIsResizing = vi.fn();

      act(() => {
        result.current.startResize(200, 100, "se", [rect], setIsResizing);
      });

      act(() => {
        result.current.updateResize(300, 200, true);
      });

      expect(mockUpdateElement).toHaveBeenCalled();
      const [, data] = mockUpdateElement.mock.calls[0];

      const aspectRatio = data.width / data.height;
      expect(Math.abs(aspectRatio - 2)).toBeLessThan(0.01);
    });
  });

  describe("Rotation of pre-rotated elements", () => {
    it("should correctly rotate a 45-degree pre-rotated rect", () => {
      const rect = createRect({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: Math.PI / 4,
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();

      act(() => {
        result.current.startRotate(200, 200, "se", [rect], setIsRotating);
      });

      expect(result.current.rotateStartRef.current?.originalRotations.get(rect.id)).toBe(Math.PI / 4);

      act(() => {
        result.current.updateRotate(100, 200);
      });

      expect(mockUpdateElements).toHaveBeenCalled();
      const updates = mockUpdateElements.mock.calls[0][0];
      const update = updates.get(rect.id);

      expect(update).toBeDefined();
      expect(update?.rotation).toBeDefined();
      expect(typeof update?.rotation).toBe("number");
      expect(Number.isFinite(update?.rotation)).toBe(true);

      expect(update?.rotation).not.toBe(Math.PI / 4);
    });

    it("should correctly rotate a 180-degree pre-rotated rect", () => {
      const rect = createRect({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: Math.PI,
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();

      act(() => {
        result.current.startRotate(200, 200, "ne", [rect], setIsRotating);
      });

      act(() => {
        result.current.updateRotate(250, 150);
      });

      expect(mockUpdateElements).toHaveBeenCalled();
      const updates = mockUpdateElements.mock.calls[0][0];
      const update = updates.get(rect.id);

      expect(update?.rotation).toBeDefined();
      expect(Number.isFinite(update?.rotation)).toBe(true);
    });

    it("should handle multiple small rotations without losing state", () => {
      const rect = createRect({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: Math.PI / 3,
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();

      act(() => {
        result.current.startRotate(200, 200, "se", [rect], setIsRotating);
      });

      for (let i = 1; i <= 5; i++) {
        act(() => {
          result.current.updateRotate(200 + i, 200 + i);
        });
      }

      expect(mockUpdateElements).toHaveBeenCalledTimes(5);

      for (let i = 0; i < 5; i++) {
        const updates = mockUpdateElements.mock.calls[i][0];
        const update = updates.get(rect.id);
        expect(update?.rotation).toBeDefined();
        expect(Number.isFinite(update?.rotation)).toBe(true);
      }
    });
  });

  describe("Edge cases for rotated elements", () => {
    it("should handle element with rotation very close to 0 but not exactly 0", () => {
      const rect = createRect({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: 0.0001,
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useResizeInteraction(screenToWorld, getElementById));

      const setIsResizing = vi.fn();

      act(() => {
        result.current.startResize(200, 200, "se", [rect], setIsResizing);
      });

      expect(result.current.resizeStartRef.current?.isSingleRotatedElement).toBe(true);

      act(() => {
        result.current.updateResize(250, 250, false);
      });

      expect(mockUpdateElement).toHaveBeenCalled();
      const [, data] = mockUpdateElement.mock.calls[0];
      expect(Number.isFinite(data.width)).toBe(true);
      expect(Number.isFinite(data.height)).toBe(true);
    });

    it("should handle element with full circle rotation (2π)", () => {
      const rect = createRect({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: Math.PI * 2,
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useResizeInteraction(screenToWorld, getElementById));

      const setIsResizing = vi.fn();

      act(() => {
        result.current.startResize(200, 200, "se", [rect], setIsResizing);
      });

      act(() => {
        result.current.updateResize(250, 250, false);
      });

      expect(mockUpdateElement).toHaveBeenCalled();
    });

    it("should handle negative rotation values", () => {
      const rect = createRect({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: -Math.PI / 4,
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useResizeInteraction(screenToWorld, getElementById));

      const setIsResizing = vi.fn();

      act(() => {
        result.current.startResize(200, 200, "se", [rect], setIsResizing);
      });

      expect(result.current.resizeStartRef.current?.isSingleRotatedElement).toBe(true);
      expect(result.current.resizeStartRef.current?.elementRotation).toBe(-Math.PI / 4);

      act(() => {
        result.current.updateResize(250, 250, false);
      });

      expect(mockUpdateElement).toHaveBeenCalled();
      const [, data] = mockUpdateElement.mock.calls[0];
      expect(Number.isFinite(data.width)).toBe(true);
      expect(Number.isFinite(data.height)).toBe(true);
    });
  });
});
