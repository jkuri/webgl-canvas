import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "@/store";
import type { CanvasElement, RectElement } from "@/types";
import { useResizeInteraction } from "../canvas-interactions/use-resize-interaction";

describe("useResizeInteraction - Rotated Group", () => {
  const mockScreenToWorld = vi.fn((x, y) => ({ x, y }));
  const mockGetElementById = vi.fn();

  beforeEach(() => {
    useCanvasStore.setState({
      elements: [],
      selectedIds: [],
    });
    vi.clearAllMocks();
  });

  it("should resize a rotated group correctly along its local axis", () => {
    const group = {
      id: "group1",
      type: "group",
      childIds: ["rect1"],
      rotation: Math.PI / 4,
    };

    const rect = {
      id: "rect1",
      type: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: Math.PI / 4,
      parentId: "group1",
    };

    useCanvasStore.setState({
      elements: [group, rect] as CanvasElement[],
      selectedIds: ["group1"],
    });

    mockGetElementById.mockImplementation((id) => {
      if (id === "group1") return group;
      if (id === "rect1") return rect;
      return undefined;
    });

    const { result } = renderHook(() => useResizeInteraction(mockScreenToWorld, mockGetElementById));

    const setIsResizing = vi.fn();

    const startX = 50 + 50 * Math.cos(Math.PI / 4);
    const startY = 50 + 50 * Math.sin(Math.PI / 4);

    act(() => {
      result.current.startResize(startX, startY, "e", [group as CanvasElement], setIsResizing);
    });

    act(() => {
      result.current.updateResize(startX + 7.071, startY + 7.071, false);
    });

    const updatedElements = useCanvasStore.getState().elements;
    const updatedRect = updatedElements.find((e) => e.id === "rect1") as RectElement;

    expect(updatedRect?.width).toBeCloseTo(110, 0);

    expect(updatedRect?.rotation).toBeCloseTo(Math.PI / 4);
  });

  it("should resize a rotated group with aspect ratio lock (Shift) correctly", () => {
    const group = {
      id: "group1",
      type: "group",
      childIds: ["rect1"],
      rotation: Math.PI / 4,
    };

    const rect = {
      id: "rect1",
      type: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: Math.PI / 4,
      parentId: "group1",
    };

    useCanvasStore.setState({
      elements: [group, rect] as CanvasElement[],
      selectedIds: ["group1"],
    });

    mockGetElementById.mockImplementation((id) => {
      if (id === "group1") return group;
      if (id === "rect1") return rect;
      return undefined;
    });

    const { result } = renderHook(() => useResizeInteraction(mockScreenToWorld, mockGetElementById));

    const setIsResizing = vi.fn();

    const startX = 50;
    const startY = 50 + 100 * Math.sin(Math.PI / 4);

    act(() => {
      result.current.startResize(startX, startY, "se", [group as CanvasElement], setIsResizing);
    });

    const deltaWorldX = 7.07;
    const deltaWorldY = 21.21;

    act(() => {
      result.current.updateResize(startX + deltaWorldX, startY + deltaWorldY, true);
    });

    const updatedElements = useCanvasStore.getState().elements;
    const updatedRect = updatedElements.find((e) => e.id === "rect1") as RectElement;

    expect(updatedRect?.width).toBeCloseTo(120, 0);
    expect(updatedRect?.height).toBeCloseTo(120, 0);
    expect(updatedRect?.rotation).toBeCloseTo(Math.PI / 4);
  });
});
