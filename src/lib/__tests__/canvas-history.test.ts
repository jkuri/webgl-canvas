import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CanvasSnapshot, canvasHistory } from "../canvas-history";

vi.mock("idb-keyval", () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

describe("lib/canvas-history", () => {
  beforeEach(() => {
    canvasHistory.clear();
  });

  it("should verify empty state initially", () => {
    expect(canvasHistory.canUndo()).toBe(false);
    expect(canvasHistory.canRedo()).toBe(false);
    expect(canvasHistory.getCurrent()).toBeNull();
  });

  it("should push state and allow undo", () => {
    const state1: Omit<CanvasSnapshot, "timestamp"> = {
      elements: [],
      canvasBackground: "#fff",
      canvasBackgroundVisible: true,
    };
    canvasHistory.push(state1);

    expect(canvasHistory.getCurrent()?.canvasBackground).toBe("#fff");
    expect(canvasHistory.canUndo()).toBe(false);

    const state2: Omit<CanvasSnapshot, "timestamp"> = {
      elements: [],
      canvasBackground: "#000",
      canvasBackgroundVisible: true,
    };
    canvasHistory.push(state2);

    expect(canvasHistory.getCurrent()?.canvasBackground).toBe("#000");
    expect(canvasHistory.canUndo()).toBe(true);

    const undone = canvasHistory.undo();
    expect(undone?.canvasBackground).toBe("#fff");
    expect(canvasHistory.getCurrent()?.canvasBackground).toBe("#fff");
    expect(canvasHistory.canRedo()).toBe(true);
  });

  it("should redo", () => {
    const state1: Omit<CanvasSnapshot, "timestamp"> = {
      elements: [],
      canvasBackground: "1",
      canvasBackgroundVisible: true,
    };
    const state2: Omit<CanvasSnapshot, "timestamp"> = {
      elements: [],
      canvasBackground: "2",
      canvasBackgroundVisible: true,
    };

    canvasHistory.push(state1);
    canvasHistory.push(state2);

    canvasHistory.undo();
    expect(canvasHistory.getCurrent()?.canvasBackground).toBe("1");

    const redone = canvasHistory.redo();
    expect(redone?.canvasBackground).toBe("2");
    expect(canvasHistory.getCurrent()?.canvasBackground).toBe("2");
  });

  it("should clear redo stack on new push", () => {
    const state1: Omit<CanvasSnapshot, "timestamp"> = {
      elements: [],
      canvasBackground: "1",
      canvasBackgroundVisible: true,
    };
    const state2: Omit<CanvasSnapshot, "timestamp"> = {
      elements: [],
      canvasBackground: "2",
      canvasBackgroundVisible: true,
    };
    const state3: Omit<CanvasSnapshot, "timestamp"> = {
      elements: [],
      canvasBackground: "3",
      canvasBackgroundVisible: true,
    };

    canvasHistory.push(state1);
    canvasHistory.push(state2);
    canvasHistory.undo();

    canvasHistory.push(state3);
    expect(canvasHistory.canRedo()).toBe(false);
  });
});
