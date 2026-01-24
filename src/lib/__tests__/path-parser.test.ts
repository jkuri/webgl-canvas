import { describe, expect, it } from "vitest";
import { parsePath, pathToFillVertices, pathToStrokeVertices } from "../path-parser";

describe("lib/path-parser", () => {
  describe("parsePath", () => {
    it("should return empty array for empty string", () => {
      expect(parsePath("")).toEqual([]);
    });

    it("should parse simple M and L commands", () => {
      const cmds = parsePath("M 10 10 L 20 20 Z");
      expect(cmds).toHaveLength(3);
      expect(cmds[0]).toEqual({ type: "M", args: [10, 10] });
      expect(cmds[1]).toEqual({ type: "L", args: [20, 20] });
      expect(cmds[2]).toEqual({ type: "L", args: [10, 10] });
    });

    it("should handle relative coordinates by converting to absolute (via svg-pathdata logic)", () => {
      const cmds = parsePath("m 10 10 l 10 10");
      expect(cmds).toHaveLength(2);
      expect(cmds[0]).toEqual({ type: "M", args: [10, 10] });
      expect(cmds[1]).toEqual({ type: "L", args: [20, 20] });
    });
  });

  describe("pathToStrokeVertices", () => {
    it("should generate vertices for line segments", () => {
      const cmds = parsePath("M 0 0 L 10 10");
      const vertices = pathToStrokeVertices(cmds);

      expect(vertices).toEqual([0, 0, 10, 10]);
    });

    it("should generate vertices for curves (approximation)", () => {
      const cmds = parsePath("M 0 0 Q 10 0 10 10");
      const vertices = pathToStrokeVertices(cmds, 4);

      expect(vertices.length).toBe(10);
    });
  });

  describe("pathToFillVertices", () => {
    it("should generate triangulation for a triangle", () => {
      const cmds = parsePath("M 0 0 L 10 0 L 0 10 Z");
      const vertices = pathToFillVertices(cmds);

      expect(vertices.length).toBeGreaterThanOrEqual(6);
    });
  });
});
