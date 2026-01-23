import { SVGPathData } from "svg-pathdata";
import { type INode, parse as parseSvgson } from "svgson";
import type {
  CanvasElement,
  EllipseElement,
  Fill,
  GradientStop,
  ImageElement,
  LinearGradient,
  LineElement,
  PathElement,
  PolygonElement,
  PolylineElement,
  RadialGradient,
  RectElement,
  Stroke,
  SVGClipPath,
  SVGDefs,
  SVGFilter,
  SVGMask,
  SVGPattern,
  SVGSymbol,
  TextElement,
} from "@/types";
import { type PathCommand, parsePath } from "./path-parser";

export interface SVGParseResult {
  elements: CanvasElement[];
  defs: SVGDefs;
}

function createEmptyDefs(): SVGDefs {
  return {
    gradients: new Map(),
    patterns: new Map(),
    filters: new Map(),
    clipPaths: new Map(),
    masks: new Map(),
    symbols: new Map(),
  };
}

function attr(node: INode, name: string, fallback = ""): string {
  return node.attributes?.[name] ?? fallback;
}

function numAttr(node: INode, name: string, fallback = 0): number {
  const val = node.attributes?.[name];
  return val ? Number.parseFloat(val) : fallback;
}

function parseUrlRef(value: string): string | null {
  const match = value?.match(/url\(#([^)]+)\)/);
  return match ? match[1] : null;
}

export function parseSVG(svgContent: string): CanvasElement[] {
  const result = parseSVGWithDefsSync(svgContent);
  return result.elements;
}

function parseSVGWithDefsSync(svgContent: string): SVGParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");

  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    console.error("SVG parsing error:", parserError.textContent);
    return { elements: [], defs: createEmptyDefs() };
  }

  const svgRoot = doc.querySelector("svg");
  if (!svgRoot) {
    console.error("No SVG root element found");
    return { elements: [], defs: createEmptyDefs() };
  }

  const container = document.createElement("div");
  container.style.cssText = "position:absolute;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;";
  document.body.appendChild(container);

  const clonedSvg = svgRoot.cloneNode(true) as Element;
  container.appendChild(clonedSvg);

  try {
    const rootNode = domToNode(clonedSvg);
    return processNode(rootNode);
  } finally {
    document.body.removeChild(container);
  }
}

function domToNode(element: Element): INode {
  const attributes: Record<string, string> = {};
  for (const attr of element.attributes) {
    attributes[attr.name] = attr.value;
  }

  if (element.tagName.toLowerCase() === "path" && element instanceof SVGGraphicsElement) {
    try {
      const bbox = element.getBBox();
      attributes["data-bbox-x"] = bbox.x.toString();
      attributes["data-bbox-y"] = bbox.y.toString();
      attributes["data-bbox-width"] = bbox.width.toString();
      attributes["data-bbox-height"] = bbox.height.toString();
    } catch (_e) {}
  }

  const children: INode[] = [];
  for (const child of element.children) {
    children.push(domToNode(child));
  }

  return {
    name: element.tagName.toLowerCase(),
    type: "element",
    value: element.textContent || "",
    attributes,
    children,
  };
}

function processNode(rootNode: INode): SVGParseResult {
  const elements: CanvasElement[] = [];
  const defs = createEmptyDefs();
  let elementIndex = 0;

  const viewBox = rootNode.attributes?.viewBox;
  let offsetX = 0;
  let offsetY = 0;
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    offsetX = -parts[0] || 0;
    offsetY = -parts[1] || 0;
  }

  function generateId(): string {
    return `imported-${Date.now()}-${elementIndex++}`;
  }

  interface Transform {
    rotation: number;
    translateX: number;
    translateY: number;
    scaleX: number;
    scaleY: number;
  }

  const defaultTransform: Transform = {
    rotation: 0,
    translateX: 0,
    translateY: 0,
    scaleX: 1,
    scaleY: 1,
  };

  function parseTransform(transformStr: string | undefined): Transform {
    const result = { ...defaultTransform };
    if (!transformStr) return result;

    const rotateMatch = transformStr.match(/rotate\(\s*([^,)]+)(?:,\s*([^,)]+),\s*([^)]+))?\s*\)/);
    if (rotateMatch) {
      result.rotation = (Number.parseFloat(rotateMatch[1]) * Math.PI) / 180;
    }

    const translateMatch = transformStr.match(/translate\(\s*([^,)]+)(?:,\s*([^)]+))?\s*\)/);
    if (translateMatch) {
      result.translateX = Number.parseFloat(translateMatch[1]) || 0;
      result.translateY = Number.parseFloat(translateMatch[2] || "0") || 0;
    }

    const scaleMatch = transformStr.match(/scale\(\s*([^,)]+)(?:,\s*([^)]+))?\s*\)/);
    if (scaleMatch) {
      result.scaleX = Number.parseFloat(scaleMatch[1]) || 1;
      result.scaleY = Number.parseFloat(scaleMatch[2] || scaleMatch[1]) || 1;
    }

    return result;
  }

  function combineTransforms(parent: Transform, child: Transform): Transform {
    return {
      rotation: parent.rotation + child.rotation,
      translateX: parent.translateX + child.translateX,
      translateY: parent.translateY + child.translateY,
      scaleX: parent.scaleX * child.scaleX,
      scaleY: parent.scaleY * child.scaleY,
    };
  }

  function parseOpacity(node: INode): number {
    const opacity = numAttr(node, "opacity", 1);
    const fillOpacity = numAttr(node, "fill-opacity", 1);
    return Math.max(0, Math.min(1, opacity * fillOpacity));
  }

  function parseFill(node: INode): Fill {
    const fill = attr(node, "fill");
    if (fill === "none") return null;
    if (!fill) return "#000000";

    const refId = parseUrlRef(fill);
    if (refId) {
      if (defs.gradients.has(refId)) {
        return { ref: refId, type: "gradient" };
      }
      if (defs.patterns.has(refId)) {
        return { ref: refId, type: "pattern" };
      }
    }

    return fill || "#000000";
  }

  function parseStroke(node: INode): Stroke {
    const strokeColor = attr(node, "stroke");
    if (!strokeColor || strokeColor === "none") return null;

    const width = numAttr(node, "stroke-width", 1);
    const dashArrayStr = attr(node, "stroke-dasharray");
    const lineCap = attr(node, "stroke-linecap") as "butt" | "round" | "square" | "";

    const refId = parseUrlRef(strokeColor);
    let color: string | { ref: string; type: "gradient" } = strokeColor;
    if (refId && defs.gradients.has(refId)) {
      color = { ref: refId, type: "gradient" };
    }

    const stroke: Stroke = { color, width };

    if (dashArrayStr && dashArrayStr !== "none") {
      stroke.dashArray = dashArrayStr
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => !Number.isNaN(n));
    }

    if (lineCap && ["butt", "round", "square"].includes(lineCap)) {
      stroke.lineCap = lineCap as "butt" | "round" | "square";
    }

    return stroke;
  }

  function parseGradientStops(node: INode): GradientStop[] {
    return node.children
      .filter((child) => child.name === "stop")
      .map((stop) => {
        let offset = numAttr(stop, "offset", 0);
        if (offset > 1) offset /= 100;

        const style = attr(stop, "style");
        let color = attr(stop, "stop-color", "#000000");
        let opacity = numAttr(stop, "stop-opacity", 1);

        const colorMatch = style.match(/stop-color:\s*([^;]+)/);
        if (colorMatch) color = colorMatch[1].trim();
        const opacityMatch = style.match(/stop-opacity:\s*([^;]+)/);
        if (opacityMatch) opacity = Number.parseFloat(opacityMatch[1]);

        return { offset, color, opacity };
      });
  }

  function parseLinearGradient(node: INode): LinearGradient | null {
    const id = attr(node, "id");
    if (!id) return null;

    return {
      type: "linearGradient",
      id,
      x1: numAttr(node, "x1", 0),
      y1: numAttr(node, "y1", 0),
      x2: numAttr(node, "x2", 1),
      y2: numAttr(node, "y2", 0),
      stops: parseGradientStops(node),
      gradientUnits: attr(node, "gradientUnits") as "userSpaceOnUse" | "objectBoundingBox" | undefined,
      gradientTransform: attr(node, "gradientTransform") || undefined,
    };
  }

  function parseRadialGradient(node: INode): RadialGradient | null {
    const id = attr(node, "id");
    if (!id) return null;

    return {
      type: "radialGradient",
      id,
      cx: numAttr(node, "cx", 0.5),
      cy: numAttr(node, "cy", 0.5),
      r: numAttr(node, "r", 0.5),
      fx: attr(node, "fx") ? numAttr(node, "fx") : undefined,
      fy: attr(node, "fy") ? numAttr(node, "fy") : undefined,
      stops: parseGradientStops(node),
      gradientUnits: attr(node, "gradientUnits") as "userSpaceOnUse" | "objectBoundingBox" | undefined,
      gradientTransform: attr(node, "gradientTransform") || undefined,
    };
  }

  function parsePattern(node: INode): SVGPattern | null {
    const id = attr(node, "id");
    if (!id) return null;

    return {
      type: "pattern",
      id,
      x: numAttr(node, "x", 0),
      y: numAttr(node, "y", 0),
      width: numAttr(node, "width", 0),
      height: numAttr(node, "height", 0),
      patternUnits: attr(node, "patternUnits") as "userSpaceOnUse" | "objectBoundingBox" | undefined,
      viewBox: attr(node, "viewBox") || undefined,
      content: nodeToSvgString(node),
    };
  }

  function parseSymbol(node: INode): SVGSymbol | null {
    const id = attr(node, "id");
    if (!id) return null;

    return {
      type: "symbol",
      id,
      viewBox: attr(node, "viewBox") || undefined,
      content: node.children.map(nodeToSvgString).join(""),
    };
  }

  function parseClipPath(node: INode): SVGClipPath | null {
    const id = attr(node, "id");
    if (!id) return null;

    return {
      type: "clipPath",
      id,
      clipPathUnits: attr(node, "clipPathUnits") as "userSpaceOnUse" | "objectBoundingBox" | undefined,
      content: node.children.map(nodeToSvgString).join(""),
    };
  }

  function parseMask(node: INode): SVGMask | null {
    const id = attr(node, "id");
    if (!id) return null;

    return {
      type: "mask",
      id,
      x: attr(node, "x") ? numAttr(node, "x") : undefined,
      y: attr(node, "y") ? numAttr(node, "y") : undefined,
      width: attr(node, "width") ? numAttr(node, "width") : undefined,
      height: attr(node, "height") ? numAttr(node, "height") : undefined,
      content: node.children.map(nodeToSvgString).join(""),
    };
  }

  function parseFilter(node: INode): SVGFilter | null {
    const id = attr(node, "id");
    if (!id) return null;

    return {
      type: "filter",
      id,
      x: attr(node, "x") ? numAttr(node, "x") : undefined,
      y: attr(node, "y") ? numAttr(node, "y") : undefined,
      width: attr(node, "width") ? numAttr(node, "width") : undefined,
      height: attr(node, "height") ? numAttr(node, "height") : undefined,
      content: node.children.map(nodeToSvgString).join(""),
    };
  }

  function nodeToSvgString(node: INode): string {
    const attrs = Object.entries(node.attributes || {})
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ");
    const childStr = node.children?.map(nodeToSvgString).join("") || "";
    const content = node.value || childStr;

    if (node.children?.length) {
      return `<${node.name}${attrs ? ` ${attrs}` : ""}>${content}</${node.name}>`;
    }
    return `<${node.name}${attrs ? ` ${attrs}` : ""}/>`;
  }

  function parseDefs(node: INode): void {
    for (const child of node.children || []) {
      switch (child.name) {
        case "linearGradient": {
          const g = parseLinearGradient(child);
          if (g) defs.gradients.set(g.id, g);
          break;
        }
        case "radialGradient": {
          const g = parseRadialGradient(child);
          if (g) defs.gradients.set(g.id, g);
          break;
        }
        case "pattern": {
          const p = parsePattern(child);
          if (p) defs.patterns.set(p.id, p);
          break;
        }
        case "symbol": {
          const s = parseSymbol(child);
          if (s) defs.symbols.set(s.id, s);
          break;
        }
        case "clipPath": {
          const c = parseClipPath(child);
          if (c) defs.clipPaths.set(c.id, c);
          break;
        }
        case "mask": {
          const m = parseMask(child);
          if (m) defs.masks.set(m.id, m);
          break;
        }
        case "filter": {
          const f = parseFilter(child);
          if (f) defs.filters.set(f.id, f);
          break;
        }
        case "g":
          parseDefs(child);
          break;
      }
    }
  }

  function calculatePathBounds(d: string): { x: number; y: number; width: number; height: number } {
    try {
      const pathData = new SVGPathData(d).toAbs();
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      for (const cmd of pathData.commands) {
        if ("x" in cmd && typeof cmd.x === "number") {
          minX = Math.min(minX, cmd.x);
          maxX = Math.max(maxX, cmd.x);
        }
        if ("y" in cmd && typeof cmd.y === "number") {
          minY = Math.min(minY, cmd.y);
          maxY = Math.max(maxY, cmd.y);
        }
        if ("x1" in cmd) {
          minX = Math.min(minX, cmd.x1);
          maxX = Math.max(maxX, cmd.x1);
        }
        if ("y1" in cmd) {
          minY = Math.min(minY, cmd.y1);
          maxY = Math.max(maxY, cmd.y1);
        }
        if ("x2" in cmd) {
          minX = Math.min(minX, cmd.x2);
          maxX = Math.max(maxX, cmd.x2);
        }
        if ("y2" in cmd) {
          minY = Math.min(minY, cmd.y2);
          maxY = Math.max(maxY, cmd.y2);
        }
      }

      return Number.isFinite(minX)
        ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
        : { x: 0, y: 0, width: 0, height: 0 };
    } catch {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
  }

  function parsePoints(pointsStr: string, tx: number, ty: number): { x: number; y: number }[] {
    const coords = pointsStr
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < coords.length - 1; i += 2) {
      if (!Number.isNaN(coords[i]) && !Number.isNaN(coords[i + 1])) {
        points.push({ x: coords[i] + tx, y: coords[i + 1] + ty });
      }
    }
    return points;
  }

  function processElement(node: INode, parentTransform: Transform = defaultTransform): void {
    const transform = parseTransform(attr(node, "transform"));
    const combined = combineTransforms(parentTransform, transform);
    const tx = offsetX + combined.translateX;
    const ty = offsetY + combined.translateY;
    const baseName = attr(node, "id") || attr(node, "class") || node.name;

    switch (node.name) {
      case "rect": {
        const x = numAttr(node, "x", 0) + tx;
        const y = numAttr(node, "y", 0) + ty;
        const width = numAttr(node, "width", 0) * combined.scaleX;
        const height = numAttr(node, "height", 0) * combined.scaleY;
        const rx = numAttr(node, "rx") || undefined;
        const ry = numAttr(node, "ry") || undefined;

        if (width > 0 && height > 0) {
          elements.push({
            id: generateId(),
            type: "rect",
            name: `${baseName} ${elementIndex}`,
            x,
            y,
            width,
            height,
            rx,
            ry,
            fill: parseFill(node),
            stroke: parseStroke(node),
            opacity: parseOpacity(node),
            rotation: combined.rotation,
          } as RectElement);
        }
        break;
      }

      case "circle": {
        const cx = numAttr(node, "cx", 0) + tx;
        const cy = numAttr(node, "cy", 0) + ty;
        const r = numAttr(node, "r", 0);

        if (r > 0) {
          elements.push({
            id: generateId(),
            type: "ellipse",
            name: `Circle ${elementIndex}`,
            cx,
            cy,
            rx: r * combined.scaleX,
            ry: r * combined.scaleY,
            fill: parseFill(node),
            stroke: parseStroke(node),
            opacity: parseOpacity(node),
            rotation: combined.rotation,
          } as EllipseElement);
        }
        break;
      }

      case "ellipse": {
        const cx = numAttr(node, "cx", 0) + tx;
        const cy = numAttr(node, "cy", 0) + ty;
        const rx = numAttr(node, "rx", 0) * combined.scaleX;
        const ry = numAttr(node, "ry", 0) * combined.scaleY;

        if (rx > 0 && ry > 0) {
          elements.push({
            id: generateId(),
            type: "ellipse",
            name: `${baseName} ${elementIndex}`,
            cx,
            cy,
            rx,
            ry,
            fill: parseFill(node),
            stroke: parseStroke(node),
            opacity: parseOpacity(node),
            rotation: combined.rotation,
          } as EllipseElement);
        }
        break;
      }

      case "line": {
        elements.push({
          id: generateId(),
          type: "line",
          name: `${baseName} ${elementIndex}`,
          x1: numAttr(node, "x1", 0) + tx,
          y1: numAttr(node, "y1", 0) + ty,
          x2: numAttr(node, "x2", 0) + tx,
          y2: numAttr(node, "y2", 0) + ty,
          fill: null,
          stroke: parseStroke(node) || { color: "#000000", width: 1 },
          opacity: parseOpacity(node),
          rotation: 0,
        } as LineElement);
        break;
      }

      case "path": {
        const dStr = attr(node, "d");
        if (dStr) {
          const transformedD = new SVGPathData(dStr).scale(combined.scaleX, combined.scaleY).translate(tx, ty).encode();

          let bounds: { x: number; y: number; width: number; height: number };

          if (combined.rotation === 0 && node.attributes && "data-bbox-x" in node.attributes) {
            const bx = Number.parseFloat(node.attributes["data-bbox-x"]);
            const by = Number.parseFloat(node.attributes["data-bbox-y"]);
            const bw = Number.parseFloat(node.attributes["data-bbox-width"]);
            const bh = Number.parseFloat(node.attributes["data-bbox-height"]);

            bounds = {
              x: bx * combined.scaleX + tx,
              y: by * combined.scaleY + ty,
              width: bw * combined.scaleX,
              height: bh * combined.scaleY,
            };
          } else {
            bounds = calculatePathBounds(transformedD);
          }

          elements.push({
            id: generateId(),
            type: "path",
            name: `${baseName} ${elementIndex}`,
            d: transformedD,
            bounds: bounds,
            fill: parseFill(node),
            stroke: parseStroke(node),
            opacity: parseOpacity(node),
            rotation: combined.rotation,
          } as PathElement);
        }
        break;
      }

      case "polygon": {
        const pointsStr = attr(node, "points");
        if (pointsStr) {
          const points = parsePoints(pointsStr, tx, ty);
          if (points.length >= 3) {
            elements.push({
              id: generateId(),
              type: "polygon",
              name: `${baseName} ${elementIndex}`,
              points,
              fill: parseFill(node),
              stroke: parseStroke(node),
              opacity: parseOpacity(node),
              rotation: combined.rotation,
            } as PolygonElement);
          }
        }
        break;
      }

      case "polyline": {
        const pointsStr = attr(node, "points");
        if (pointsStr) {
          const points = parsePoints(pointsStr, tx, ty);
          if (points.length >= 2) {
            elements.push({
              id: generateId(),
              type: "polyline",
              name: `${baseName} ${elementIndex}`,
              points,
              fill: null,
              stroke: parseStroke(node) || { color: "#000000", width: 1 },
              opacity: parseOpacity(node),
              rotation: combined.rotation,
            } as PolylineElement);
          }
        }
        break;
      }

      case "text": {
        const textContent = node.value || node.children?.map((c) => c.value).join("") || "";
        if (textContent.trim()) {
          elements.push({
            id: generateId(),
            type: "text",
            name: `Text ${elementIndex}`,
            x: numAttr(node, "x", 0) + tx,
            y: numAttr(node, "y", 0) + ty,
            text: textContent.trim(),
            fontSize: numAttr(node, "font-size", 16) * combined.scaleX,
            fontFamily: attr(node, "font-family", "sans-serif"),
            fontWeight: attr(node, "font-weight", "normal") as TextElement["fontWeight"],
            textAnchor: attr(node, "text-anchor", "start") as TextElement["textAnchor"],
            fill: parseFill(node),
            stroke: parseStroke(node),
            opacity: parseOpacity(node),
            rotation: combined.rotation,
          } as TextElement);
        }
        break;
      }

      case "image": {
        const href = attr(node, "href") || attr(node, "xlink:href");
        const width = numAttr(node, "width", 0) * combined.scaleX;
        const height = numAttr(node, "height", 0) * combined.scaleY;

        if (width > 0 && height > 0 && href) {
          elements.push({
            id: generateId(),
            type: "image",
            name: `Image ${elementIndex}`,
            x: numAttr(node, "x", 0) + tx,
            y: numAttr(node, "y", 0) + ty,
            width,
            height,
            href,
            preserveAspectRatio: attr(node, "preserveAspectRatio", "xMidYMid") as ImageElement["preserveAspectRatio"],
            fill: null,
            stroke: null,
            opacity: parseOpacity(node),
            rotation: combined.rotation,
          } as ImageElement);
        }
        break;
      }

      case "use": {
        const href = attr(node, "href") || attr(node, "xlink:href");
        const refId = href?.replace(/^#/, "");
        const symbol = refId ? defs.symbols.get(refId) : null;

        if (symbol) {
          const tempSvg = `<svg xmlns="http://www.w3.org/2000/svg">${symbol.content}</svg>`;
          const symbolElements = parseSVG(tempSvg);
          const useX = numAttr(node, "x", 0);
          const useY = numAttr(node, "y", 0);

          for (const el of symbolElements) {
            if ("x" in el) el.x += useX + tx;
            if ("y" in el) el.y += useY + ty;
            if ("cx" in el) {
              el.cx += useX + tx;
              el.cy += useY + ty;
            }
            if ("x1" in el) {
              el.x1 += useX + tx;
              el.y1 += useY + ty;
              el.x2 += useX + tx;
              el.y2 += useY + ty;
            }
            if ("points" in el) {
              el.points = el.points.map((p) => ({ x: p.x + useX + tx, y: p.y + useY + ty }));
            }
            el.id = generateId();
            elements.push(el);
          }
        }
        break;
      }

      case "g":
      case "svg": {
        for (const child of node.children || []) {
          processElement(child, combined);
        }
        break;
      }

      case "defs":
        parseDefs(node);
        break;

      case "symbol": {
        const s = parseSymbol(node);
        if (s) defs.symbols.set(s.id, s);
        break;
      }

      case "linearGradient": {
        const g = parseLinearGradient(node);
        if (g) defs.gradients.set(g.id, g);
        break;
      }

      case "radialGradient": {
        const g = parseRadialGradient(node);
        if (g) defs.gradients.set(g.id, g);
        break;
      }

      case "pattern": {
        const p = parsePattern(node);
        if (p) defs.patterns.set(p.id, p);
        break;
      }

      case "clipPath": {
        const c = parseClipPath(node);
        if (c) defs.clipPaths.set(c.id, c);
        break;
      }

      case "mask": {
        const m = parseMask(node);
        if (m) defs.masks.set(m.id, m);
        break;
      }

      case "filter": {
        const f = parseFilter(node);
        if (f) defs.filters.set(f.id, f);
        break;
      }

      default:
        for (const child of node.children || []) {
          processElement(child, combined);
        }
    }
  }

  processElement(rootNode);

  return { elements, defs };
}

export async function parseSVGAsync(svgContent: string): Promise<SVGParseResult> {
  try {
    const rootNode = await parseSvgson(svgContent);
    return processNode(rootNode);
  } catch (error) {
    console.error("SVG parsing error:", error);
    return { elements: [], defs: createEmptyDefs() };
  }
}

export async function importSVGFromFile(file: File): Promise<CanvasElement[]> {
  const content = await file.text();
  return parseSVG(content);
}

export async function importSVGFromFileWithDefs(file: File): Promise<SVGParseResult> {
  const content = await file.text();
  return parseSVGAsync(content);
}

export function resizePath(
  d: string,
  oldBounds: { x: number; y: number; width: number; height: number },
  newBounds: { x: number; y: number; width: number; height: number },
): string {
  if (!d) return d;

  if (!oldBounds.width || !oldBounds.height) {
    console.warn("resizePath: oldBounds has zero dimension, returning original path");
    return d;
  }

  try {
    const commands = parsePath(d);
    const normalizedD = commands
      .map((cmd: PathCommand) => {
        return `${cmd.type} ${cmd.args.join(" ")}`;
      })
      .join(" ");

    if (!normalizedD.trim()) {
      return d;
    }

    const scaleX = newBounds.width / oldBounds.width;
    const scaleY = newBounds.height / oldBounds.height;

    return new SVGPathData(normalizedD)
      .translate(-oldBounds.x, -oldBounds.y)
      .scale(scaleX, scaleY)
      .translate(newBounds.x, newBounds.y)
      .encode();
  } catch (error) {
    console.warn("resizePath: Failed to resize path, returning original:", error);
    return d;
  }
}

export function translatePath(d: string, x: number, y: number): string {
  if (!d) return d;
  return new SVGPathData(d).translate(x, y).encode();
}
