import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasElement } from "@/types";
import { createGroup, createRect, resetIdCounter } from "../canvas-interactions/__tests__/test-utils";

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

import { useSelectionBounds } from "../use-selection-bounds";

beforeEach(() => {
  resetIdCounter();
  mockElements = [];
  mockSelectedIds = [];
});

describe("useSelectionBounds - Rotated Groups", () => {
  it("should return correct rotation and OBB dimensions for a rotated group", () => {
    const rect = createRect({ x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 4 });

    const group = createGroup([rect], { rotation: Math.PI / 4 });

    mockElements = [rect, group];
    mockSelectedIds = [group.id];

    const { result } = renderHook(() => useSelectionBounds());

    expect(result.current?.rotation).toBeCloseTo(Math.PI / 4);
    expect(result.current?.bounds.width).toBeCloseTo(100);
    expect(result.current?.bounds.height).toBeCloseTo(100);
  });
});
