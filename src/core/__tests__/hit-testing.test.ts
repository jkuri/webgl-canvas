import { beforeEach, describe, expect, it } from "vitest";
import { calculateBoundingBox, getRotatedCorners, hitTestBoundsHandle, hitTestElement } from "@/core/hit-testing";
import {
  createEllipse,
  createLine,
  createPath,
  createRect,
  createText,
  resetIdCounter,
} from "@/hooks/canvas-interactions/__tests__/test-utils";

beforeEach(() => {
  resetIdCounter();
});

describe("getRotatedCorners", () => {
  describe("rect", () => {
    it("should return corners at correct positions for unrotated rect", () => {
      const rect = createRect({ x: 0, y: 0, width: 100, height: 100, rotation: 0 });
      const corners = getRotatedCorners(rect);

      expect(corners).toHaveLength(4);
      expect(corners[0]).toEqual({ x: 0, y: 0 });
      expect(corners[1]).toEqual({ x: 100, y: 0 });
      expect(corners[2]).toEqual({ x: 100, y: 100 });
      expect(corners[3]).toEqual({ x: 0, y: 100 });
    });

    it("should return rotated corners for 90 degree rotation", () => {
      const rect = createRect({ x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 });
      const corners = getRotatedCorners(rect);

      expect(corners).toHaveLength(4);

      expect(corners[0].x).toBeCloseTo(100, 5);
      expect(corners[0].y).toBeCloseTo(0, 5);
    });
  });

  describe("ellipse", () => {
    it("should return bounding box corners for unrotated ellipse", () => {
      const ellipse = createEllipse({ cx: 50, cy: 50, rx: 50, ry: 50, rotation: 0 });
      const corners = getRotatedCorners(ellipse);

      expect(corners).toHaveLength(4);
      expect(corners[0]).toEqual({ x: 0, y: 0 });
      expect(corners[1]).toEqual({ x: 100, y: 0 });
      expect(corners[2]).toEqual({ x: 100, y: 100 });
      expect(corners[3]).toEqual({ x: 0, y: 100 });
    });
  });

  describe("line", () => {
    it("should return line endpoints", () => {
      const line = createLine({ x1: 10, y1: 20, x2: 110, y2: 120 });
      const corners = getRotatedCorners(line);

      expect(corners).toHaveLength(2);
      expect(corners[0]).toEqual({ x: 10, y: 20 });
      expect(corners[1]).toEqual({ x: 110, y: 120 });
    });
  });

  describe("path", () => {
    it("should return rotated bounds corners", () => {
      const path = createPath({ bounds: { x: 0, y: 0, width: 100, height: 100 }, rotation: 0 });
      const corners = getRotatedCorners(path);

      expect(corners).toHaveLength(4);
      expect(corners[0]).toEqual({ x: 0, y: 0 });
      expect(corners[1]).toEqual({ x: 100, y: 0 });
      expect(corners[2]).toEqual({ x: 100, y: 100 });
      expect(corners[3]).toEqual({ x: 0, y: 100 });
    });
  });

  describe("text", () => {
    it("should return bounds corners for text with bounds", () => {
      const text = createText({
        x: 10,
        y: 20,
        bounds: { x: 0, y: 0, width: 50, height: 20 },
        rotation: 0,
      });
      const corners = getRotatedCorners(text);

      expect(corners).toHaveLength(4);

      expect(corners[0]).toEqual({ x: 10, y: 20 });
      expect(corners[1]).toEqual({ x: 60, y: 20 });
      expect(corners[2]).toEqual({ x: 60, y: 40 });
      expect(corners[3]).toEqual({ x: 10, y: 40 });
    });
  });
});

describe("calculateBoundingBox", () => {
  it("should return null for empty array", () => {
    const result = calculateBoundingBox([]);
    expect(result).toBeNull();
  });

  it("should return bounds for single rect", () => {
    const rect = createRect({ x: 10, y: 20, width: 100, height: 50 });
    const result = calculateBoundingBox([rect]);

    expect(result).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it("should return combined bounds for multiple rects", () => {
    const rect1 = createRect({ x: 0, y: 0, width: 50, height: 50 });
    const rect2 = createRect({ x: 100, y: 100, width: 50, height: 50 });
    const result = calculateBoundingBox([rect1, rect2]);

    expect(result).toEqual({ x: 0, y: 0, width: 150, height: 150 });
  });

  it("should handle rotated elements", () => {
    const rect = createRect({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: Math.PI / 4,
    });
    const result = calculateBoundingBox([rect]);

    expect(result).not.toBeNull();
    expect(result!.width).toBeGreaterThan(100);
    expect(result!.height).toBeGreaterThan(100);
  });

  it("should include ellipse bounding box", () => {
    const ellipse = createEllipse({ cx: 100, cy: 100, rx: 50, ry: 30 });
    const result = calculateBoundingBox([ellipse]);

    expect(result).toEqual({ x: 50, y: 70, width: 100, height: 60 });
  });

  it("should handle line elements", () => {
    const line = createLine({ x1: 10, y1: 20, x2: 110, y2: 120 });
    const result = calculateBoundingBox([line]);

    expect(result).toEqual({ x: 10, y: 20, width: 100, height: 100 });
  });

  it("should filter out invisible elements", () => {
    const visible = createRect({ x: 0, y: 0, width: 50, height: 50 });
    const invisible = createRect({ x: 200, y: 200, width: 50, height: 50, visible: false });
    const result = calculateBoundingBox([visible, invisible]);

    expect(result).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });

  it("should filter out group elements", () => {
    const rect = createRect({ x: 0, y: 0, width: 100, height: 100 });
    const group = {
      id: "group-1",
      type: "group" as const,
      childIds: [rect.id],
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      name: "Group",
      aspectRatioLocked: false,
    };
    rect.parentId = group.id;

    const result = calculateBoundingBox([rect, group]);

    expect(result).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });
});

describe("hitTestBoundsHandle", () => {
  it("should detect nw corner handle", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const result = hitTestBoundsHandle(0, 0, bounds, 1);
    expect(result).toBe("nw");
  });

  it("should detect ne corner handle", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const result = hitTestBoundsHandle(100, 0, bounds, 1);
    expect(result).toBe("ne");
  });

  it("should detect se corner handle", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const result = hitTestBoundsHandle(100, 100, bounds, 1);
    expect(result).toBe("se");
  });

  it("should detect sw corner handle", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const result = hitTestBoundsHandle(0, 100, bounds, 1);
    expect(result).toBe("sw");
  });

  it("should detect n edge handle", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const result = hitTestBoundsHandle(50, 0, bounds, 1);
    expect(result).toBe("n");
  });

  it("should detect e edge handle", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const result = hitTestBoundsHandle(100, 50, bounds, 1);
    expect(result).toBe("e");
  });

  it("should detect s edge handle", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const result = hitTestBoundsHandle(50, 100, bounds, 1);
    expect(result).toBe("s");
  });

  it("should detect w edge handle", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const result = hitTestBoundsHandle(0, 50, bounds, 1);
    expect(result).toBe("w");
  });

  it("should return null when not on any handle", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const result = hitTestBoundsHandle(50, 50, bounds, 1);
    expect(result).toBeNull();
  });

  it("should respect scale for hit radius", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };

    const result = hitTestBoundsHandle(10, 0, bounds, 0.5);
    expect(result).toBe("nw");
  });
});

describe("hitTestElement", () => {
  it("should hit test rect inside", () => {
    const rect = createRect({ x: 0, y: 0, width: 100, height: 100, rotation: 0 });
    expect(hitTestElement(50, 50, rect)).toBe(true);
    expect(hitTestElement(0, 0, rect)).toBe(true);
    expect(hitTestElement(100, 100, rect)).toBe(true);
  });

  it("should return false for point outside rect", () => {
    const rect = createRect({ x: 0, y: 0, width: 100, height: 100, rotation: 0 });
    expect(hitTestElement(150, 150, rect)).toBe(false);
    expect(hitTestElement(-50, -50, rect)).toBe(false);
  });

  it("should hit test ellipse inside", () => {
    const ellipse = createEllipse({ cx: 50, cy: 50, rx: 50, ry: 50, rotation: 0 });
    expect(hitTestElement(50, 50, ellipse)).toBe(true);
    expect(hitTestElement(50, 0, ellipse)).toBe(true);
    expect(hitTestElement(100, 50, ellipse)).toBe(true);
  });

  it("should return false for point outside ellipse", () => {
    const ellipse = createEllipse({ cx: 50, cy: 50, rx: 50, ry: 50, rotation: 0 });
    expect(hitTestElement(0, 0, ellipse)).toBe(false);
    expect(hitTestElement(100, 100, ellipse)).toBe(false);
  });

  it("should hit test rotated rect correctly", () => {
    const rect = createRect({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: Math.PI / 4,
    });

    expect(hitTestElement(50, 50, rect)).toBe(true);
  });

  it("should return false for invisible elements", () => {
    const rect = createRect({ x: 0, y: 0, width: 100, height: 100, visible: false });
    expect(hitTestElement(50, 50, rect)).toBe(false);
  });
});
