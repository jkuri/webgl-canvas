import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useResizeInteraction } from "../use-resize-interaction";
import {
  createGetElementById,
  createGroup,
  createRect,
  createScreenToWorld,
  createText,
  resetIdCounter,
} from "./test-utils";

const mockUpdateElements = vi.fn();

vi.mock("@/store", () => ({
  useCanvasStore: {
    getState: () => ({
      snapToGrid: false,
      snapToObjects: false,
      snapToGeometry: false,
      smartGuides: [],
      updateElement: vi.fn(),
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

describe("Detailed Group Resizing Tests", () => {
  const screenToWorld = createScreenToWorld();

  it("should resize a group containing text correctly", () => {
    // Text element at 0,0. FontSize 20.
    // Bounds: 0,0 100x20.
    const text = createText({ x: 0, y: 20, fontSize: 20, bounds: { x: 0, y: -20, width: 100, height: 20 } });
    const group = createGroup([text]);

    const elements = [text, group];
    const getElementById = createGetElementById(elements);

    const { result } = renderHook(() => useResizeInteraction(screenToWorld, getElementById));
    const setIsResizing = vi.fn();

    // Start Resize. Bounds 0,0 100x20.
    // Drag e handle (+100 width -> 200).
    result.current.startResize(100, 10, "e", [group], setIsResizing);

    act(() => {
      result.current.updateResize(200, 10, false);
    });

    expect(mockUpdateElements).toHaveBeenCalled();
    const updates = mockUpdateElements.mock.calls[0][0];
    const uText = updates.get(text.id);

    expect(uText).toBeDefined();
    // Width doubled. Height same. Avg scale = 1.5.
    // FontSize 20 * 1.5 = 30.
    expect(uText.fontSize).toBeCloseTo(30);
  });

  it("should resize a nested group structure", () => {
    // Group A -> Group B -> Rect
    const rect = createRect({ x: 0, y: 0, width: 10, height: 10 });
    const groupB = createGroup([rect]);
    const groupA = createGroup([groupB]);

    const elements = [rect, groupB, groupA];
    const getElementById = createGetElementById(elements);

    const { result } = renderHook(() => useResizeInteraction(screenToWorld, getElementById));
    const setIsResizing = vi.fn();

    // Bounds 0,0 10x10.
    result.current.startResize(10, 10, "se", [groupA], setIsResizing);

    // Resize to 20x20.
    act(() => {
      result.current.updateResize(20, 20, false);
    });

    const updates = mockUpdateElements.mock.calls[0][0];
    const uRect = updates.get(rect.id);

    expect(uRect.width).toBeCloseTo(20);
    expect(uRect.height).toBeCloseTo(20);
  });

  it("should resize group with multiple elements maintaining relationships", () => {
    // Rect 1 at 0,0. 10x10.
    // Rect 2 at 10,0. 10x10.
    const rect1 = createRect({ x: 0, y: 0, width: 10, height: 10 });
    const rect2 = createRect({ x: 10, y: 0, width: 10, height: 10 });
    const group = createGroup([rect1, rect2]);

    const elements = [rect1, rect2, group];
    const getElementById = createGetElementById(elements);

    const { result } = renderHook(() => useResizeInteraction(screenToWorld, getElementById));
    const setIsResizing = vi.fn();

    // Bounds 0,0 20x10.
    // Resize width to 40 (2x).
    result.current.startResize(20, 5, "e", [group], setIsResizing);

    act(() => {
      result.current.updateResize(40, 5, false);
    });

    const updates = mockUpdateElements.mock.calls[0][0];
    const u1 = updates.get(rect1.id);
    const u2 = updates.get(rect2.id);

    // Rect 1: x=0*2=0. w=10*2=20.
    expect(u1.x).toBeCloseTo(0);
    expect(u1.width).toBeCloseTo(20);

    // Rect 2: x=10*2=20. w=10*2=20.
    expect(u2.x).toBeCloseTo(20);
    expect(u2.width).toBeCloseTo(20);
  });
});
