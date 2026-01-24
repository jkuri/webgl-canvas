import { renderHook } from "@testing-library/react";
// We need to mock the store for this test
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasElement } from "@/types";
import { createGroup, createRect, resetIdCounter } from "../canvas-interactions/__tests__/test-utils";

// Mock the store
let mockElements: CanvasElement[] = [];
let mockSelectedIds: string[] = [];

vi.mock("@/store", () => ({
  useCanvasStore: (selector: (state: { elements: CanvasElement[]; selectedIds: string[] }) => unknown) => {
    const state = {
      elements: mockElements,
      selectedIds: mockSelectedIds,
    };
    return selector(state);
  },
}));

// Import after mocking
import { useSelectionBounds } from "../use-selection-bounds";

beforeEach(() => {
  resetIdCounter();
  mockElements = [];
  mockSelectedIds = [];
});

describe("useSelectionBounds", () => {
  describe("single element", () => {
    it("should return element rotation for single non-group element", () => {
      const rect = createRect({ rotation: Math.PI / 4 });
      mockElements = [rect];
      mockSelectedIds = [rect.id];

      const { result } = renderHook(() => useSelectionBounds());

      expect(result.current?.rotation).toBe(Math.PI / 4);
    });
  });

  describe("single group - axis-aligned bounds", () => {
    it("should return group rotation for single group", () => {
      const rect = createRect({ x: 0, y: 0, width: 100, height: 100 });
      const group = createGroup([rect], { rotation: Math.PI / 2 });
      mockElements = [rect, group];
      mockSelectedIds = [group.id];

      const { result } = renderHook(() => useSelectionBounds());

      // Should return group rotation
      expect(result.current?.rotation).toBe(Math.PI / 2);
    });

    it("should return non-zero bounds for group", () => {
      const rect = createRect({ x: 0, y: 0, width: 100, height: 100 });
      const group = createGroup([rect], { rotation: Math.PI / 4 });
      mockElements = [rect, group];
      mockSelectedIds = [group.id];

      const { result } = renderHook(() => useSelectionBounds());

      expect(result.current?.bounds).toBeDefined();
      expect(result.current?.bounds.width).toBeGreaterThan(0);
      expect(result.current?.bounds.height).toBeGreaterThan(0);
    });

    it("should return group rotation for group with nested rotated children", () => {
      const rect = createRect({ x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 4 });
      const group = createGroup([rect], { rotation: Math.PI / 2 });
      mockElements = [rect, group];
      mockSelectedIds = [group.id];

      const { result } = renderHook(() => useSelectionBounds());

      // Should return group rotation
      expect(result.current?.rotation).toBe(Math.PI / 2);
    });
  });

  describe("multiple elements", () => {
    it("should return rotation 0 for multiple elements", () => {
      const rect1 = createRect();
      const rect2 = createRect({ x: 100, y: 100 });
      mockElements = [rect1, rect2];
      mockSelectedIds = [rect1.id, rect2.id];

      const { result } = renderHook(() => useSelectionBounds());

      // Multiple elements should have axis-aligned selection box
      expect(result.current?.rotation).toBe(0);
    });
  });
});
