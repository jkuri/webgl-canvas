import type { Bounds, SnapState } from "@/core/snapping";
import type { BoundingBox, ResizeHandle, SmartGuide } from "@/types";

export interface PendingUpdate {
  type: "drag" | "resize" | "rotate" | "marquee";
  updates?: Map<string, Record<string, unknown>>;
  singleUpdate?: { id: string; data: Record<string, unknown> };
  selectionBox?: { startX: number; startY: number; endX: number; endY: number } | null;
  selectedIds?: string[];
  smartGuides?: SmartGuide[];
}

export interface ElementData {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  type?: string;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  d?: string;
  bounds?: { x: number; y: number; width: number; height: number; rotation?: number };
  parentId?: string;
  aspectRatioLocked?: boolean;
  anchorX?: number;
  anchorY?: number;
}

export interface DragStartState {
  worldX: number;
  worldY: number;
  elements: Map<
    string,
    { x: number; y: number; cx?: number; cy?: number; x1?: number; y1?: number; x2?: number; y2?: number }
  >;
  snapState: SnapState;
  originalBounds: Bounds;
}

export interface ResizeStartState {
  worldX: number;
  worldY: number;
  handle: ResizeHandle;
  originalBounds: BoundingBox;
  originalElements: Map<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      type: string;
      cx?: number;
      cy?: number;
      rx?: number;
      ry?: number;
      x1?: number;
      y1?: number;
      x2?: number;
      y2?: number;
      bounds?: { x: number; y: number; width: number; height: number; rotation?: number };
      aspectRatioLocked?: boolean;
      d?: string;
    }
  >;
  isSingleRotatedElement: boolean;
  elementRotation: number;
}

export interface RotateStartState {
  startAngle: number;
  centerX: number;
  centerY: number;
  originalRotations: Map<string, number>;
  originalElements: Map<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      type: string;
      cx?: number;
      cy?: number;
      rx?: number;
      ry?: number;
      x1?: number;
      y1?: number;
      x2?: number;
      y2?: number;
      d?: string;
      bounds?: { x: number; y: number; width: number; height: number };
      anchorX?: number;
      anchorY?: number;
    }
  >;
  handle: ResizeHandle;
}

export interface MarqueeStartState {
  worldX: number;
  worldY: number;
}
