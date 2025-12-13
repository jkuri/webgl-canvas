// SVG-style color types
export type Fill = string | null; // CSS color or null for no fill
export type Stroke = {
  color: string;
  width: number;
  dashArray?: number[]; // e.g., [5, 5]
  lineCap?: "butt" | "round" | "square";
} | null;

// Base properties shared by all elements
interface BaseElement {
  id: string;
  name: string;
  rotation: number; // radians
  fill: Fill;
  stroke: Stroke;
  opacity: number; // 0-1
  locked?: boolean;
  visible?: boolean;
  parentId?: string; // Reference to parent group
}

// Rectangle shape (SVG rect)
export interface RectElement extends BaseElement {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number; // corner radius x
  ry?: number; // corner radius y
}

// Ellipse/Circle shape (SVG ellipse)
export interface EllipseElement extends BaseElement {
  type: "ellipse";
  cx: number; // center x
  cy: number; // center y
  rx: number; // radius x
  ry: number; // radius y
}

// Line shape (SVG line)
export interface LineElement extends BaseElement {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  markerStart?: "none" | "arrow" | "triangle" | "reversed_triangle" | "circle" | "diamond" | "round" | "square";
  markerEnd?: "none" | "arrow" | "triangle" | "reversed_triangle" | "circle" | "diamond" | "round" | "square";
}

// Path shape (SVG path with d attribute)
export interface PathElement extends BaseElement {
  type: "path";
  d: string; // SVG path data
  // Bounding box for hit testing and selection
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Group container (SVG g)
export interface GroupElement extends Omit<BaseElement, "fill" | "stroke"> {
  type: "group";
  childIds: string[]; // Ordered list of child element IDs
  expanded?: boolean; // UI state for layers panel
}

// Union types
export type Shape = RectElement | EllipseElement | LineElement | PathElement;
export type CanvasElement = Shape | GroupElement;
export type ElementType = CanvasElement["type"];

// Selection and interaction types
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

export type Tool = "select" | "pan" | "rect" | "ellipse" | "line";
export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null;

// Smart Guide
export interface SmartGuide {
  type: "x" | "y" | "distance";
  x?: number; // For vertical line (x-axis alignment)
  y?: number; // For horizontal line (y-axis alignment)
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  label?: string; // For distance
}

// Helper to get bounding box for any element
export function getElementBounds(element: CanvasElement): BoundingBox {
  switch (element.type) {
    case "rect":
      return { x: element.x, y: element.y, width: element.width, height: element.height };
    case "ellipse":
      return {
        x: element.cx - element.rx,
        y: element.cy - element.ry,
        width: element.rx * 2,
        height: element.ry * 2,
      };
    case "line": {
      const minX = Math.min(element.x1, element.x2);
      const minY = Math.min(element.y1, element.y2);
      const maxX = Math.max(element.x1, element.x2);
      const maxY = Math.max(element.y1, element.y2);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    case "path":
      return element.bounds;
    case "group":
      // Groups don't have intrinsic bounds - computed from children
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

// Helper to get element center
export function getElementCenter(element: CanvasElement): { x: number; y: number } {
  const bounds = getElementBounds(element);
  if (element.type === "ellipse") {
    return { x: element.cx, y: element.cy };
  }
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}
