export interface GradientStop {
  offset: number;
  color: string;
  opacity?: number;
}

export interface LinearGradient {
  type: "linearGradient";
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: GradientStop[];
  gradientUnits?: "userSpaceOnUse" | "objectBoundingBox";
  gradientTransform?: string;
}

export interface RadialGradient {
  type: "radialGradient";
  id: string;
  cx: number;
  cy: number;
  r: number;
  fx?: number;
  fy?: number;
  stops: GradientStop[];
  gradientUnits?: "userSpaceOnUse" | "objectBoundingBox";
  gradientTransform?: string;
}

export interface SVGPattern {
  type: "pattern";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  patternUnits?: "userSpaceOnUse" | "objectBoundingBox";
  patternContentUnits?: "userSpaceOnUse" | "objectBoundingBox";
  patternTransform?: string;
  viewBox?: string;

  content?: string;
}

export interface SVGFilter {
  type: "filter";
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  filterUnits?: "userSpaceOnUse" | "objectBoundingBox";

  content: string;
}

export interface SVGClipPath {
  type: "clipPath";
  id: string;
  clipPathUnits?: "userSpaceOnUse" | "objectBoundingBox";

  content: string;
}

export interface SVGMask {
  type: "mask";
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  maskUnits?: "userSpaceOnUse" | "objectBoundingBox";
  maskContentUnits?: "userSpaceOnUse" | "objectBoundingBox";

  content: string;
}

export interface SVGSymbol {
  type: "symbol";
  id: string;
  viewBox?: string;

  content: string;
}

export interface SVGDefs {
  gradients: Map<string, LinearGradient | RadialGradient>;
  patterns: Map<string, SVGPattern>;
  filters: Map<string, SVGFilter>;
  clipPaths: Map<string, SVGClipPath>;
  masks: Map<string, SVGMask>;
  symbols: Map<string, SVGSymbol>;
}

export type Fill = string | { ref: string; type: "gradient" | "pattern" } | null;
export type Stroke = {
  color: string | { ref: string; type: "gradient" };
  width: number;
  opacity?: number;
  dashArray?: number[];
  lineCap?: "butt" | "round" | "square";
} | null;

interface BaseElement {
  id: string;
  name: string;
  rotation: number;
  fill: Fill;
  fillOpacity?: number;
  stroke: Stroke;
  opacity: number;
  locked?: boolean;
  visible?: boolean;
  parentId?: string;
  aspectRatioLocked?: boolean;
}

export interface RectElement extends BaseElement {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  ry?: number;
}

export interface EllipseElement extends BaseElement {
  type: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface LineElement extends BaseElement {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  markerStart?: "none" | "arrow" | "triangle" | "reversed_triangle" | "circle" | "diamond" | "round" | "square";
  markerEnd?: "none" | "arrow" | "triangle" | "reversed_triangle" | "circle" | "diamond" | "round" | "square";
}

export interface PathElement extends BaseElement {
  type: "path";
  d: string;

  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  _cachedVertices?: Float32Array;
  _cachedFillVertices?: Float32Array;
}

export interface TextElement extends BaseElement {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight?: "normal" | "bold" | number;
  textAnchor?: "start" | "middle" | "end";

  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PolygonElement extends BaseElement {
  type: "polygon";
  points: { x: number; y: number }[];

  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PolylineElement extends BaseElement {
  type: "polyline";
  points: { x: number; y: number }[];

  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ImageElement extends BaseElement {
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
  preserveAspectRatio?: "none" | "xMidYMid" | "xMinYMin" | "xMaxYMax";

  _texture?: WebGLTexture;
}

export interface GroupElement extends Omit<BaseElement, "fill" | "stroke"> {
  type: "group";
  childIds: string[];
  expanded?: boolean;
}

export type Shape =
  | RectElement
  | EllipseElement
  | LineElement
  | PathElement
  | TextElement
  | PolygonElement
  | PolylineElement
  | ImageElement;
export type CanvasElement = Shape | GroupElement;
export type ElementType = CanvasElement["type"];

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

export type Tool = "select" | "pan" | "rect" | "ellipse" | "line" | "text";
export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null;

export interface SmartGuide {
  type: "alignment" | "spacing" | "center";

  axis?: "x" | "y";
  position?: number;

  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;

  label?: string;

  cx?: number;
  cy?: number;
}

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
    case "text":
      if (element.bounds) {
        return {
          x: element.x + element.bounds.x,
          y: element.y + element.bounds.y,
          width: element.bounds.width,
          height: element.bounds.height,
        };
      }
      return {
        x: element.x,
        y: element.y - element.fontSize,
        width: element.text.length * element.fontSize * 0.6,
        height: element.fontSize * 1.2,
      };
    case "polygon":
    case "polyline": {
      if (element.bounds) return element.bounds;
      if (element.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
      let minX = element.points[0].x;
      let minY = element.points[0].y;
      let maxX = minX;
      let maxY = minY;
      for (const pt of element.points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    case "image":
      return { x: element.x, y: element.y, width: element.width, height: element.height };
    case "group":
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

export function getElementCenter(element: CanvasElement): { x: number; y: number } {
  const bounds = getElementBounds(element);
  if (element.type === "ellipse") {
    return { x: element.cx, y: element.cy };
  }
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function getFillColor(fill: Fill, defaultColor = "#000000"): string | null {
  if (fill === null) return null;
  if (typeof fill === "string") return fill;

  return defaultColor;
}

export function getStrokeColor(color: string | { ref: string; type: "gradient" }, defaultColor = "#000000"): string {
  if (typeof color === "string") return color;

  return defaultColor;
}

export function isFillReference(fill: Fill): fill is { ref: string; type: "gradient" | "pattern" } {
  return fill !== null && typeof fill === "object" && "ref" in fill;
}

export function isStrokeColorReference(color: string | { ref: string; type: "gradient" }): color is { ref: string; type: "gradient" } {
  return typeof color === "object" && "ref" in color;
}
