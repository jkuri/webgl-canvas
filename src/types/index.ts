// SVG Gradient Stop
export interface GradientStop {
  offset: number; // 0-1
  color: string;
  opacity?: number;
}

// SVG Linear Gradient
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

// SVG Radial Gradient
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

// SVG Pattern
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
  // Pattern content stored as raw SVG for now
  content?: string;
}

// SVG Filter (stored for export fidelity)
export interface SVGFilter {
  type: "filter";
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  filterUnits?: "userSpaceOnUse" | "objectBoundingBox";
  // Raw SVG content for filters (too complex to fully parse)
  content: string;
}

// SVG ClipPath
export interface SVGClipPath {
  type: "clipPath";
  id: string;
  clipPathUnits?: "userSpaceOnUse" | "objectBoundingBox";
  // Raw SVG content
  content: string;
}

// SVG Mask
export interface SVGMask {
  type: "mask";
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  maskUnits?: "userSpaceOnUse" | "objectBoundingBox";
  maskContentUnits?: "userSpaceOnUse" | "objectBoundingBox";
  // Raw SVG content
  content: string;
}

// SVG Symbol (for <use> references)
export interface SVGSymbol {
  type: "symbol";
  id: string;
  viewBox?: string;
  // Raw SVG content
  content: string;
}

// SVG Definitions Registry
export interface SVGDefs {
  gradients: Map<string, LinearGradient | RadialGradient>;
  patterns: Map<string, SVGPattern>;
  filters: Map<string, SVGFilter>;
  clipPaths: Map<string, SVGClipPath>;
  masks: Map<string, SVGMask>;
  symbols: Map<string, SVGSymbol>;
}

// SVG-style color types - can reference gradient/pattern by ID
export type Fill = string | { ref: string; type: "gradient" | "pattern" } | null;
export type Stroke = {
  color: string | { ref: string; type: "gradient" };
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
  // Cached parsed path commands and vertices for rendering
  _cachedVertices?: Float32Array;
  _cachedFillVertices?: Float32Array;
}

// Text element (SVG text)
export interface TextElement extends BaseElement {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight?: "normal" | "bold" | number;
  textAnchor?: "start" | "middle" | "end";
  // Computed bounds for hit testing (updated when text changes)
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Polygon shape (SVG polygon - closed path)
export interface PolygonElement extends BaseElement {
  type: "polygon";
  points: { x: number; y: number }[];
  // Cached bounds for hit testing
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Polyline shape (SVG polyline - open path)
export interface PolylineElement extends BaseElement {
  type: "polyline";
  points: { x: number; y: number }[];
  // Cached bounds for hit testing
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Image element (SVG image)
export interface ImageElement extends BaseElement {
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  href: string; // data URL or external URL
  preserveAspectRatio?: "none" | "xMidYMid" | "xMinYMin" | "xMaxYMax";
  // Cached texture for WebGL rendering
  _texture?: WebGLTexture;
}

// Group container (SVG g)
export interface GroupElement extends Omit<BaseElement, "fill" | "stroke"> {
  type: "group";
  childIds: string[]; // Ordered list of child element IDs
  expanded?: boolean; // UI state for layers panel
}

// Union types
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

export type Tool = "select" | "pan" | "rect" | "ellipse" | "line" | "text";
export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null;

// Smart Guide - Figma-style visual indicators
export interface SmartGuide {
  type: "alignment" | "spacing" | "center";
  // For alignment guides (edge/center lines)
  axis?: "x" | "y"; // x = vertical line, y = horizontal line
  position?: number; // x or y coordinate of the line
  // Line endpoints
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // For spacing/distance guides
  label?: string; // Distance in pixels
  // For center snap indicators
  cx?: number;
  cy?: number;
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
    case "text":
      // Use cached bounds or estimate from font size
      if (element.bounds) return element.bounds;
      return {
        x: element.x,
        y: element.y - element.fontSize,
        width: element.text.length * element.fontSize * 0.6, // Rough estimate
        height: element.fontSize * 1.2,
      };
    case "polygon":
    case "polyline": {
      // Use cached bounds or calculate from points
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

/**
 * Extract a color string from a Fill value.
 * Returns the color string if it's a simple color, or a default if it's a gradient/pattern reference.
 */
export function getFillColor(fill: Fill, defaultColor = "#000000"): string | null {
  if (fill === null) return null;
  if (typeof fill === "string") return fill;
  // Gradient/pattern reference - return default for now (renderer doesn't support gradients yet)
  return defaultColor;
}

/**
 * Extract a color string from a Stroke's color value.
 * Returns the color string if it's a simple color, or a default if it's a gradient reference.
 */
export function getStrokeColor(color: string | { ref: string; type: "gradient" }, defaultColor = "#000000"): string {
  if (typeof color === "string") return color;
  // Gradient reference - return default for now
  return defaultColor;
}

/**
 * Check if a Fill is a gradient/pattern reference
 */
export function isFillReference(fill: Fill): fill is { ref: string; type: "gradient" | "pattern" } {
  return fill !== null && typeof fill === "object" && "ref" in fill;
}

/**
 * Check if a stroke color is a gradient reference
 */
export function isStrokeColorReference(
  color: string | { ref: string; type: "gradient" },
): color is { ref: string; type: "gradient" } {
  return typeof color === "object" && "ref" in color;
}
