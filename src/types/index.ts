export interface Shape {
  id: string;
  type: "rect" | "circle";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // in radians
  color: [number, number, number, number];
  locked?: boolean;
}

export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Tool = "select" | "pan";
export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null;
