import { describe, expect, it } from "vitest";
import type { CanvasElement } from "@/types";
import { calculateSnaps, createSnapState, getBounds } from "../snapping-engine";

describe("getBounds", () => {
  it("should calculate bounds for a rectangle", () => {
    const rect: CanvasElement = {
      id: "1",
      type: "rect",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fill: "red",
      opacity: 1,
      rotation: 0,
      name: "Rect",
      stroke: null,
    };
    const bounds = getBounds(rect, []);
    expect(bounds).toEqual({
      minX: 10,
      minY: 20,
      maxX: 110,
      maxY: 70,
      centerX: 60,
      centerY: 45,
    });
  });

  it("should calculate bounds for an ellipse", () => {
    const ellipse: CanvasElement = {
      id: "2",
      type: "ellipse",
      cx: 100,
      cy: 100,
      rx: 50,
      ry: 30,
      fill: "blue",
      opacity: 1,
      rotation: 0,
      name: "Ellipse",
      stroke: null,
    };
    const bounds = getBounds(ellipse, []);
    expect(bounds).toEqual({
      minX: 50,
      minY: 70,
      maxX: 150,
      maxY: 130,
      centerX: 100,
      centerY: 100,
    });
  });

  it("should calculate bounds for a line", () => {
    const line: CanvasElement = {
      id: "3",
      type: "line",
      x1: 10,
      y1: 10,
      x2: 100,
      y2: 100,
      opacity: 1,
      rotation: 0,
      name: "Line",
      fill: null,
      stroke: { color: "black", width: 1 },
    };
    const bounds = getBounds(line, []);
    expect(bounds).toEqual({
      minX: 10,
      minY: 10,
      maxX: 100,
      maxY: 100,
      centerX: 55,
      centerY: 55,
    });
  });

  it("should calculate bounds for a path", () => {
    const path: CanvasElement = {
      id: "4",
      type: "path",
      d: "M 0 0 L 10 0 L 10 10 Z",
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      opacity: 1,
      rotation: 0,
      name: "Path",
      fill: "black",
      stroke: null,
    };
    const bounds = getBounds(path, []);
    expect(bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 10,
      centerX: 5,
      centerY: 5,
    });
  });

  it("should calculate bounds for text", () => {
    const text: CanvasElement = {
      id: "5",
      type: "text",
      x: 10,
      y: 20,
      text: "Hello",
      fontSize: 16,
      fontFamily: "Arial",
      opacity: 1,
      rotation: 0,
      name: "Text",
      fill: "black",
      stroke: null,
      bounds: { x: 0, y: 0, width: 40, height: 20 },
    };
    const bounds = getBounds(text, []);
    expect(bounds).toEqual({
      minX: 10,
      minY: 20,
      maxX: 50,
      maxY: 40,
      centerX: 30,
      centerY: 30,
    });
  });

  it("should calculate bounds for a group", () => {
    const r1: CanvasElement = {
      id: "c1",
      type: "rect",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fill: "red",
      opacity: 1,
      rotation: 0,
      stroke: null,
      name: "R1",
      parentId: "g1",
    };
    const r2: CanvasElement = {
      id: "c2",
      type: "rect",
      x: 20,
      y: 20,
      width: 10,
      height: 10,
      fill: "blue",
      opacity: 1,
      rotation: 0,
      stroke: null,
      name: "R2",
      parentId: "g1",
    };
    const group: CanvasElement = {
      id: "g1",
      type: "group",
      childIds: ["c1", "c2"],
      opacity: 1,
      rotation: 0,
      name: "Group",
    };

    const bounds = getBounds(group, [r1, r2, group]);
    expect(bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 30,
      maxY: 30,
      centerX: 15,
      centerY: 15,
    });
  });

  it("should calculate bounds for a rotated group", () => {
    const r1: CanvasElement = {
      id: "c1",
      type: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fill: "red",
      opacity: 1,
      rotation: 0,
      stroke: null,
      name: "R1",
      parentId: "g1",
    };

    const group: CanvasElement = {
      id: "g1",
      type: "group",
      childIds: ["c1"],
      opacity: 1,
      rotation: Math.PI / 2,
      name: "Group",
    };

    const bounds = getBounds(group, [r1, group]);

    expect(bounds.minX).toBeCloseTo(25);
    expect(bounds.maxX).toBeCloseTo(75);
    expect(bounds.minY).toBeCloseTo(-25);
    expect(bounds.maxY).toBeCloseTo(75);
    expect(bounds.centerX).toBeCloseTo(50);
    expect(bounds.centerY).toBeCloseTo(25);
  });
});

describe("createSnapState", () => {
  it("should create empty state if no elements", () => {
    const state = createSnapState([], new Set());
    expect(state.verticalLines).toEqual([]);
    expect(state.horizontalLines).toEqual([]);
    expect(state.xSortedBounds).toEqual([]);
    expect(state.ySortedBounds).toEqual([]);
    expect(state.points).toEqual([]);
  });

  it("should create snap state for a single element", () => {
    const rect: CanvasElement = {
      id: "1",
      type: "rect",
      x: 10,
      y: 10,
      width: 100,
      height: 100,
      fill: "red",
      opacity: 1,
      rotation: 0,
      name: "R1",
      stroke: null,
    };
    const state = createSnapState([rect], new Set());

    expect(state.xSortedBounds).toHaveLength(1);
    expect(state.ySortedBounds).toHaveLength(1);

    expect(state.verticalLines).toHaveLength(3);
    expect(state.verticalLines.map((l) => l.value)).toEqual([10, 60, 110]);

    expect(state.horizontalLines).toHaveLength(3);
    expect(state.horizontalLines.map((l) => l.value)).toEqual([10, 60, 110]);

    expect(state.points).toHaveLength(5);
  });

  it("should exclude specified elements", () => {
    const r1: CanvasElement = {
      id: "1",
      type: "rect",
      x: 10,
      y: 10,
      width: 100,
      height: 100,
      fill: "red",
      opacity: 1,
      rotation: 0,
      name: "R1",
      stroke: null,
    };
    const r2: CanvasElement = {
      id: "2",
      type: "rect",
      x: 200,
      y: 10,
      width: 100,
      height: 100,
      fill: "blue",
      opacity: 1,
      rotation: 0,
      name: "R2",
      stroke: null,
    };
    const state = createSnapState([r1, r2], new Set(["2"]));

    expect(state.xSortedBounds).toHaveLength(1);
    expect(state.xSortedBounds[0].id).toBe("1");
  });

  it("should exclude child elements (if parentId is present, logic might filter them)", () => {
    const parent: CanvasElement = {
      id: "p1",
      type: "group",
      childIds: ["c1"],
      opacity: 1,
      rotation: 0,
      name: "P1",
    };
    const child: CanvasElement = {
      id: "c1",
      type: "rect",
      x: 10,
      y: 10,
      width: 10,
      height: 10,
      fill: "red",
      opacity: 1,
      rotation: 0,
      name: "C1",
      stroke: null,
      parentId: "p1",
    };

    const state = createSnapState([parent, child], new Set());

    expect(state.xSortedBounds).toHaveLength(1);
    expect(state.xSortedBounds[0].id).toBe("p1");
  });
});

describe("calculateSnaps", () => {
  const config = {
    snapToGrid: true,
    snapToObjects: true,
    snapToGeometry: false,
    gridSize: 10,
    threshold: 5,
    scale: 1,
  };

  it("should return no snaps if nothing matches", () => {
    const state = createSnapState([], new Set());
    const projected = { minX: 12, minY: 12, maxX: 22, maxY: 22, centerX: 17, centerY: 17 };

    const result = calculateSnaps(projected, state, { ...config, snapToGrid: false });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.guides).toEqual([]);
  });

  it("should snap to grid if enabled and close enough", () => {
    const state = createSnapState([], new Set());

    const projected = { minX: 12, minY: 18, maxX: 22, maxY: 28, centerX: 17, centerY: 23 };
    const result = calculateSnaps(projected, state, config);

    expect(result.x).toBe(-2);
    expect(result.y).toBe(2);
    expect(result.guides).toEqual([]);
  });

  it("should prioritize object alignment over grid", () => {
    const r2: CanvasElement = {
      id: "2",
      type: "rect",
      x: 103,
      y: 100,
      width: 50,
      height: 50,
      fill: "red",
      opacity: 1,
      rotation: 0,
      name: "R2",
      stroke: null,
    };
    const state2 = createSnapState([r2], new Set());

    const projected = { minX: 104, minY: 200, maxX: 154, maxY: 250, centerX: 129, centerY: 225 };

    const result = calculateSnaps(projected, state2, config);

    expect(result.x).toBe(-1);
    expect(result.guides.length).toBeGreaterThan(0);
    expect(result.guides[0].type).toBe("alignment");
  });

  it("should snap to object edges (start, center, end)", () => {
    const target: CanvasElement = {
      id: "1",
      type: "rect",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fill: "red",
      opacity: 1,
      rotation: 0,
      name: "Target",
      stroke: null,
    };
    const state = createSnapState([target], new Set());

    let projected = { minX: 102, minY: 300, maxX: 152, maxY: 350, centerX: 127, centerY: 325 };
    let result = calculateSnaps(projected, state, config);
    expect(result.x).toBe(-2);

    projected = { minX: 127, minY: 300, maxX: 177, maxY: 350, centerX: 152, centerY: 325 };
    result = calculateSnaps(projected, state, config);
    expect(result.x).toBe(-2);

    projected = { minX: 153, minY: 300, maxX: 203, maxY: 350, centerX: 178, centerY: 325 };
    result = calculateSnaps(projected, state, config);
    expect(result.x).toBe(-3);
  });

  it("should snap to equal spacing", () => {
    const left: CanvasElement = {
      id: "1",
      type: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: "red",
      opacity: 1,
      rotation: 0,
      name: "L",
      stroke: null,
    };

    const right: CanvasElement = {
      id: "2",
      type: "rect",
      x: 300,
      y: 0,
      width: 100,
      height: 100,
      fill: "blue",
      opacity: 1,
      rotation: 0,
      name: "R",
      stroke: null,
    };

    const state = createSnapState([left, right], new Set());

    const projected = { minX: 152, minY: 0, maxX: 252, maxY: 100, centerX: 202, centerY: 50 };

    const result = calculateSnaps(projected, state, { ...config, snapToGrid: false });

    expect(result.x).toBe(-2);
    expect(result.guides.length).toBeGreaterThan(0);
    expect(result.guides[0].type).toBe("spacing");
  });

  it("should snap to geometry points if enabled", () => {
    const polygon: CanvasElement = {
      id: "1",
      type: "polygon",
      points: [
        { x: 200, y: 200 },
        { x: 250, y: 250 },
        { x: 150, y: 250 },
      ],
      fill: "red",
      opacity: 1,
      rotation: 0,
      name: "Poly",
      stroke: null,
    };
    const state = createSnapState([polygon], new Set());

    const projected = { minX: 202, minY: 202, maxX: 212, maxY: 212, centerX: 207, centerY: 207 };

    const result = calculateSnaps(projected, state, { ...config, snapToGeometry: true, snapToGrid: false });

    expect(result.x).toBe(-2);
    expect(result.y).toBe(-2);
  });
});
