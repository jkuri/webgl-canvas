import type { SmartGuide } from "@/types";

export type SnapLineType = "start" | "center" | "end";
export type SnapAxis = "x" | "y";

export interface SnapLine {
  value: number;
  type: SnapLineType;
  origin: number;
  range: [number, number];
  elementId: string;
}

export interface SnapState {
  verticalLines: SnapLine[];
  horizontalLines: SnapLine[];
  xSortedBounds: Bounds[];
  ySortedBounds: Bounds[];
  points: Point[];
}

export interface Bounds {
  id?: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SmartGuide[];
}
