import { describe, expect, it } from "vitest";
import { getRotatedCursor, getRotatedRotationCursor } from "../cursor-utils";

describe("getRotatedCursor", () => {
  it("should return default for null handle", () => {
    const result = getRotatedCursor(null, 0);
    expect(result).toBe("default");
  });

  it("should return a cursor string for nw handle", () => {
    const result = getRotatedCursor("nw", 0);
    expect(result).toContain("data:image/svg+xml");
    expect(result).toContain("url(");
  });

  it("should return a cursor string for se handle", () => {
    const result = getRotatedCursor("se", 0);
    expect(result).toContain("data:image/svg+xml");
  });

  it("should return a cursor string for ne handle", () => {
    const result = getRotatedCursor("ne", 0);
    expect(result).toContain("data:image/svg+xml");
  });

  it("should return a cursor string for sw handle", () => {
    const result = getRotatedCursor("sw", 0);
    expect(result).toContain("data:image/svg+xml");
  });

  it("should return a cursor string for n handle", () => {
    const result = getRotatedCursor("n", 0);
    expect(result).toContain("data:image/svg+xml");
  });

  it("should return a cursor string for s handle", () => {
    const result = getRotatedCursor("s", 0);
    expect(result).toContain("data:image/svg+xml");
  });

  it("should return a cursor string for e handle", () => {
    const result = getRotatedCursor("e", 0);
    expect(result).toContain("data:image/svg+xml");
  });

  it("should return a cursor string for w handle", () => {
    const result = getRotatedCursor("w", 0);
    expect(result).toContain("data:image/svg+xml");
  });

  it("should apply rotation to cursor", () => {
    const cursor0 = getRotatedCursor("nw", 0);
    const cursorRotated = getRotatedCursor("nw", Math.PI / 2);

    expect(cursor0).toContain("data:image/svg+xml");
    expect(cursorRotated).toContain("data:image/svg+xml");
    expect(cursor0).not.toBe(cursorRotated);
  });

  it("should cache cursor for same angle", () => {
    const cursor1 = getRotatedCursor("nw", 0);
    const cursor2 = getRotatedCursor("nw", 0);
    expect(cursor1).toBe(cursor2);
  });
});

describe("getRotatedRotationCursor", () => {
  it("should return rotation cursor for nw handle", () => {
    const result = getRotatedRotationCursor("nw", 0);
    expect(result).toContain("data:image/svg+xml");
  });

  it("should return rotation cursor for ne handle", () => {
    const result = getRotatedRotationCursor("ne", 0);
    expect(result).toContain("data:image/svg+xml");
  });

  it("should return rotation cursor for se handle", () => {
    const result = getRotatedRotationCursor("se", 0);
    expect(result).toContain("data:image/svg+xml");
  });

  it("should return rotation cursor for sw handle", () => {
    const result = getRotatedRotationCursor("sw", 0);
    expect(result).toContain("data:image/svg+xml");
  });

  it("should return cursor for null handle", () => {
    const result = getRotatedRotationCursor(null, 0);
    expect(result).toContain("data:image/svg+xml");
  });

  it("should apply element rotation", () => {
    const cursor0 = getRotatedRotationCursor("nw", 0);
    const cursorRotated = getRotatedRotationCursor("nw", Math.PI / 2);
    expect(cursor0).not.toBe(cursorRotated);
  });

  it("should handle different corner handles with different base angles", () => {
    const nw = getRotatedRotationCursor("nw", 0);
    const ne = getRotatedRotationCursor("ne", 0);
    const se = getRotatedRotationCursor("se", 0);
    const sw = getRotatedRotationCursor("sw", 0);

    expect(nw).not.toBe(ne);
    expect(ne).not.toBe(se);
    expect(se).not.toBe(sw);
  });
});
