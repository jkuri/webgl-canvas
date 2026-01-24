import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "@/store";
import type { CanvasElement } from "@/types";
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
    // Initial State: Group at (100, 100)
    // Child 1: Rect at (100, 100) size 100x100
    // Group Rotation: 0 (initially, but we will set it)

    // Let's manually rotate the children around (150, 150) by 45 degrees
    // Center: 150, 150.
    // Rect Center: 150, 150.
    // Unrotated Rect: x:100, y:100, w:100, h:100 (Corners: 100,100 -> 200,200)

    // Rotated 45 degrees.
    // Let's just trust our helpers for construction.
    // Actually we can just define the group as already rotated logic for the "startResize" call.

    // Mock Elements
    const group = {
      id: "group1",
      type: "group",
      childIds: ["rect1"],
      rotation: Math.PI / 4, // 45 degrees
    };

    // The rect should be positioned as if it was transformed.
    // For simplicity, let's say the group was formed around a rect at 0,0 100x100.
    // Center 50,50.
    // Rotation 45deg around 50,50.
    // getElementById needs to return these.

    const rect = {
      id: "rect1",
      type: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: Math.PI / 4, // Rect also rotated
      parentId: "group1",
    };

    // Store state
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

    // Start Resize on "East" handle of the rotated group.
    // Group OBB Center: 50,50. Width 100, Height 100. Rotation 45.
    // "East" handle in local space is at (100, 50).
    // In world space (rotated 45 around 50,50):
    // dx = 50, dy = 0.
    // worldX = 50 + 50 * cos45 - 0 * sin45 = 50 + 35.35 = 85.35
    // worldY = 50 + 50 * sin45 + 0 * cos45 = 50 + 35.35 = 85.35

    const startX = 50 + 50 * Math.cos(Math.PI / 4);
    const startY = 50 + 50 * Math.sin(Math.PI / 4);

    act(() => {
      // mock calculateGroupOBB to return expected OBB so startResize works without full geometry engine
      // Actually startResize calls calculateGroupOBB from core. We might need to mock core or ensure it works.
      // Since we are running in vitest environment, core logic should work if imports are correct.
      // calculateGroupOBB relies on getRotatedCorners.

      result.current.startResize(
        startX,
        startY,
        "e", // East handle
        [group as CanvasElement],
        setIsResizing,
      );
    });

    // Move East handle by 10 units along the local X axis (which is diagonal in world).
    // An extension of 10 units width.
    // World delta?
    // 10 units along 45 degrees.
    // dx = 10 * cos45 = 7.07
    // dy = 10 * sin45 = 7.07

    act(() => {
      result.current.updateResize(startX + 7.071, startY + 7.071, false);
    });

    // Check results
    // The rect width should increase by 10.
    // original width 100 -> 110.

    // We need to inspect the STORE updates.
    // We can spy on updateElements
    const updatedElements = useCanvasStore.getState().elements;
    const updatedRect = updatedElements.find((e) => e.id === "rect1");

    // Since we are checking if the rect width scaled:
    expect(updatedRect?.width).toBeCloseTo(110, 0);
    // And rotation should persist
    expect(updatedRect?.rotation).toBeCloseTo(Math.PI / 4);
  });

  it("should resize a rotated group with aspect ratio lock (Shift) correctly", () => {
    // Initial State: Group at (100, 100)
    // Child 1: Rect at (100, 100) size 100x100
    // Group Rotation: 0 (initially, but we will set it)

    // Mock Elements
    const group = {
      id: "group1",
      type: "group",
      childIds: ["rect1"],
      rotation: Math.PI / 4, // 45 degrees
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

    // Store state
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

    // Start Resize on "South-East" handle of the rotated group.
    // Group OBB Center: 50,50. Width 100, Height 100. Rotation 45.
    // "South-East" handle in local space is at (100, 100).
    // In world space (rotated 45 around 50,50):
    // dx = 50, dy = 50.
    // worldX = 50 + 50 * cos45 - 50 * sin45 = 50 + 35.35 - 35.35 = 50
    // worldY = 50 + 50 * sin45 + 50 * cos45 = 50 + 35.35 + 35.35 = 120.71

    const startX = 50;
    const startY = 50 + 100 * Math.sin(Math.PI / 4); // approx 120.71

    act(() => {
      result.current.startResize(
        startX,
        startY,
        "se", // South-East handle
        [group as CanvasElement],
        setIsResizing,
      );
    });

    // Move handle by 10 units diagonally.
    // If we move along local X+ and Y+ by 10.
    // Local Delta x=10, y=10.
    // World Delta?
    // dx = 10 * cos45 - 10 * sin45 = 0
    // dy = 10 * sin45 + 10 * cos45 = 14.14

    // So if we move mouse by (0, 14.14), we extend width by 10 and height by 10.
    // If shift key is pressed, it should enforce ratio 1:1.
    // But if we move mouse differently, say dx=20 (local), dy=10 (local).
    // World for local(20, 10):
    // dx_world = 20 * .707 - 10 * .707 = 7.07
    // dy_world = 20 * .707 + 10 * .707 = 21.21

    // Let's simulate a non-uniform local drag and check if Shift enforces uniformity.
    const deltaWorldX = 7.07;
    const deltaWorldY = 21.21;

    act(() => {
      result.current.updateResize(startX + deltaWorldX, startY + deltaWorldY, true); // true = Shift Key
    });

    // Ratio is 1:1.
    // Local delta X was 20. Local delta Y was 10.
    // Max is 20. So both should become +20?
    // Or logic drives by larger axis.

    // Group size was 100x100.
    // New size should probably be 120x120.

    const updatedElements = useCanvasStore.getState().elements;
    const updatedRect = updatedElements.find((e) => e.id === "rect1");

    expect(updatedRect?.width).toBeCloseTo(120, 0);
    expect(updatedRect?.height).toBeCloseTo(120, 0);
    expect(updatedRect?.rotation).toBeCloseTo(Math.PI / 4);
  });
});
