import { describe, expect, it } from "vitest";
import { cssToRGBA, getRandomShapeColorCSS, TAILWIND_COLORS } from "../colors";

describe("lib/colors", () => {
  describe("cssToRGBA", () => {
    it("should parse 6-digit hex", () => {
      const rgba = cssToRGBA("#ff0000");
      expect(rgba).toEqual([1, 0, 0, 1]);
    });

    it("should parse 3-digit hex", () => {
      const rgba = cssToRGBA("#0f0");
      expect(rgba).toEqual([0, 1, 0, 1]);
    });

    it("should parse 8-digit hex (with alpha)", () => {
      const rgba = cssToRGBA("#ff000080");
      expect(rgba[0]).toBe(1);
      expect(rgba[1]).toBe(0);
      expect(rgba[2]).toBe(0);
      expect(rgba[3]).toBeCloseTo(128 / 255);
    });

    it("should parse rgb() string", () => {
      const rgba = cssToRGBA("rgb(255, 0, 0)");
      expect(rgba).toEqual([1, 0, 0, 1]);
    });

    it("should parse rgba() string", () => {
      const rgba = cssToRGBA("rgba(0, 0, 255, 0.5)");
      expect(rgba).toEqual([0, 0, 1, 0.5]);
    });

    it("should return default grey for invalid input", () => {
      const rgba = cssToRGBA("invalid");
      expect(rgba).toEqual([0.5, 0.5, 0.5, 1]);
    });
  });

  describe("getRandomShapeColorCSS", () => {
    it("should return a color from TAILWIND_COLORS", () => {
      const color = getRandomShapeColorCSS();
      const validColors = Object.values(TAILWIND_COLORS);
      expect(validColors).toContain(color);
    });
  });
});
