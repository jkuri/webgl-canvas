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
      // Create a rect with 45-degree rotation at position (100, 100) with size 100x100
      const rect = createRect({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: Math.PI / 4, // 45 degrees
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useResizeInteraction(screenToWorld, getElementById));

      const setIsResizing = vi.fn();

      // Start resize from the SE corner (at the rotated position)
      act(() => {
        const success = result.current.startResize(200, 200, "se", [rect], setIsResizing);
        expect(success).toBe(true);
      });

      // Verify initial state was captured correctly
      expect(result.current.resizeStartRef.current).not.toBeNull();
      expect(result.current.resizeStartRef.current?.isSingleRotatedElement).toBe(true);
      expect(result.current.resizeStartRef.current?.elementRotation).toBe(Math.PI / 4);

      // Original element data should be captured
      const originalData = result.current.resizeStartRef.current?.originalElements.get(rect.id);
      expect(originalData).toBeDefined();
      expect(originalData?.width).toBe(100);
      expect(originalData?.height).toBe(100);
      expect(originalData?.x).toBe(100);
      expect(originalData?.y).toBe(100);

      // Simulate mouse move to resize (drag SE corner out by 50 pixels diagonally)
      act(() => {
        result.current.updateResize(250, 250, false);
      });

      // Verify updateElement was called with valid values
      expect(mockUpdateElement).toHaveBeenCalled();
      const [id, data] = mockUpdateElement.mock.calls[0];

      expect(id).toBe(rect.id);
      expect(typeof data.x).toBe("number");
      expect(typeof data.y).toBe("number");
      expect(typeof data.width).toBe("number");
      expect(typeof data.height).toBe("number");

      // Values should be finite (not NaN or Infinity)
      expect(Number.isFinite(data.x)).toBe(true);
      expect(Number.isFinite(data.y)).toBe(true);
      expect(Number.isFinite(data.width)).toBe(true);
      expect(Number.isFinite(data.height)).toBe(true);

      // Width and height should be larger than the original
      // Width should be larger than the original (SE corner drag increases width)
      expect(data.width).toBeGreaterThan(100);
      // For a 45-degree rotated rect, dragging diagonally (50, 50) in screen coordinates
      // converts to local coords where localDeltaY ≈ 0 (because we're dragging parallel to one edge)
      // This is correct behavior - the height stays the same
      expect(data.height).toBe(100);
    });

    it("should correctly resize a 90-degree rotated rect from NW corner", () => {
      const rect = createRect({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: Math.PI / 2, // 90 degrees
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useResizeInteraction(screenToWorld, getElementById));

      const setIsResizing = vi.fn();

      // Start resize from NW corner
      act(() => {
        result.current.startResize(100, 100, "nw", [rect], setIsResizing);
      });

      // Update resize (move NW corner towards origin)
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
        height: 100, // 2:1 aspect ratio
        rotation: Math.PI / 6, // 30 degrees
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useResizeInteraction(screenToWorld, getElementById));

      const setIsResizing = vi.fn();

      act(() => {
        result.current.startResize(200, 100, "se", [rect], setIsResizing);
      });

      // Resize with shift key held (should maintain aspect ratio)
      act(() => {
        result.current.updateResize(300, 200, true); // shiftKey = true
      });

      expect(mockUpdateElement).toHaveBeenCalled();
      const [, data] = mockUpdateElement.mock.calls[0];

      // Check aspect ratio is maintained (approximately 2:1)
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
        rotation: Math.PI / 4, // Already rotated 45 degrees
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();

      // Start rotation from SE corner
      act(() => {
        result.current.startRotate(200, 200, "se", [rect], setIsRotating);
      });

      // Verify initial rotation was captured
      expect(result.current.rotateStartRef.current?.originalRotations.get(rect.id)).toBe(Math.PI / 4);

      // Rotate by moving mouse (simulating 45 degree additional rotation)
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

      // The new rotation should be different from original
      expect(update?.rotation).not.toBe(Math.PI / 4);
    });

    it("should correctly rotate a 180-degree pre-rotated rect", () => {
      const rect = createRect({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: Math.PI, // 180 degrees
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
        rotation: Math.PI / 3, // 60 degrees
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useRotateInteraction(screenToWorld, getElementById));

      const setIsRotating = vi.fn();

      act(() => {
        result.current.startRotate(200, 200, "se", [rect], setIsRotating);
      });

      // Simulate multiple small mouse movements (like real dragging)
      for (let i = 1; i <= 5; i++) {
        act(() => {
          result.current.updateRotate(200 + i, 200 + i);
        });
      }

      // Should have been called 5 times
      expect(mockUpdateElements).toHaveBeenCalledTimes(5);

      // All calls should have valid rotation values
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
        rotation: 0.0001, // Very small rotation
      });
      const getElementById = createGetElementById([rect]);
      const { result } = renderHook(() => useResizeInteraction(screenToWorld, getElementById));

      const setIsResizing = vi.fn();

      act(() => {
        result.current.startResize(200, 200, "se", [rect], setIsResizing);
      });

      // Should be treated as rotated element
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
        rotation: Math.PI * 2, // Full rotation = 0 degrees equivalent
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
        rotation: -Math.PI / 4, // -45 degrees
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
