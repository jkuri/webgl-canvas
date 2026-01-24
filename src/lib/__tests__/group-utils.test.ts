import { describe, expect, it } from "vitest";
import type { CanvasElement, GroupElement } from "@/types";
import { getGroupBounds, moveGroupChildren, rotateGroupChildren } from "../group-utils";

describe("lib/group-utils", () => {
  describe("getGroupBounds", () => {
    it("should return bounds enclosing all children", () => {
      const c1: CanvasElement = {
        id: "c1",
        type: "rect",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fill: "red",
        opacity: 1,
        rotation: 0,
        name: "C1",
        stroke: null,
        parentId: "g1",
      };
      const c2: CanvasElement = {
        id: "c2",
        type: "rect",
        x: 10,
        y: 10,
        width: 10,
        height: 10,
        fill: "red",
        opacity: 1,
        rotation: 0,
        name: "C2",
        stroke: null,
        parentId: "g1",
      };
      const group: GroupElement = {
        id: "g1",
        type: "group",
        childIds: ["c1", "c2"],
        opacity: 1,
        rotation: 0,
        name: "G1",
      };

      const bounds = getGroupBounds(group, [c1, c2, group]);
      expect(bounds).toEqual({ x: 0, y: 0, width: 20, height: 20 });
    });

    it("should handle nested groups", () => {
      const c1: CanvasElement = {
        id: "c1",
        type: "rect",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fill: "red",
        opacity: 1,
        rotation: 0,
        name: "C1",
        stroke: null,
        parentId: "g2",
      };
      const g2: GroupElement = {
        id: "g2",
        type: "group",
        childIds: ["c1"],
        opacity: 1,
        rotation: 0,
        name: "G2",
        parentId: "g1",
      };
      const g1: GroupElement = { id: "g1", type: "group", childIds: ["g2"], opacity: 1, rotation: 0, name: "G1" };

      const bounds = getGroupBounds(g1, [c1, g2, g1]);
      expect(bounds).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    });
  });

  describe("moveGroupChildren", () => {
    it("should move all children by delta", () => {
      const c1: CanvasElement = {
        id: "c1",
        type: "rect",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fill: "red",
        opacity: 1,
        rotation: 0,
        name: "C1",
        stroke: null,
        parentId: "g1",
      };
      const group: GroupElement = { id: "g1", type: "group", childIds: ["c1"], opacity: 1, rotation: 0, name: "G1" };

      const updates = moveGroupChildren(group, 10, 20, [c1, group]);

      expect(updates.has("c1")).toBe(true);
      const update = updates.get("c1") as { x: number; y: number };
      expect(update.x).toBe(10);
      expect(update.y).toBe(20);
    });
  });

  describe("rotateGroupChildren", () => {
    it("should rotate children around group center", () => {
      const c1: CanvasElement = {
        id: "c1",
        type: "rect",
        x: 40,
        y: 50,
        width: 0,
        height: 0,
        fill: "red",
        opacity: 1,
        rotation: 0,
        name: "C1",
        stroke: null,
        parentId: "g1",
      };
      const group: GroupElement = { id: "g1", type: "group", childIds: ["c1"], opacity: 1, rotation: 0, name: "G1" };

      const updates = rotateGroupChildren(group, Math.PI / 2, 50, 50, [c1, group]);

      const update = updates.get("c1") as { x: number; y: number; rotation: number };
      expect(update.x).toBeCloseTo(50);
      expect(update.y).toBeCloseTo(40);
      expect(update.rotation).toBeCloseTo(Math.PI / 2);
    });

    it("should handle nested recursion", () => {
      const c1: CanvasElement = {
        id: "c1",
        type: "rect",
        x: 40,
        y: 50,
        width: 0,
        height: 0,
        fill: "red",
        opacity: 1,
        rotation: 0,
        name: "C1",
        stroke: null,
        parentId: "g2",
      };
      const g2: GroupElement = {
        id: "g2",
        type: "group",
        childIds: ["c1"],
        opacity: 1,
        rotation: 0,
        name: "G2",
        parentId: "g1",
      };
      const g1: GroupElement = { id: "g1", type: "group", childIds: ["g2"], opacity: 1, rotation: 0, name: "G1" };

      const updates = rotateGroupChildren(g1, Math.PI / 2, 50, 50, [c1, g2, g1]);

      expect(updates.has("c1")).toBe(true);
    });
  });
});
