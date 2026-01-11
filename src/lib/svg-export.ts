import type { CanvasElement, Shape } from "@/types";

// Helper to rotate a point around a center
function rotatePoint(x: number, y: number, cx: number, cy: number, rotation: number): { x: number; y: number } {
  if (rotation === 0) return { x, y };
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

// Get the four corners of an element, accounting for rotation
function getRotatedCorners(element: CanvasElement): { x: number; y: number }[] {
  const rotation = element.rotation || 0;

  switch (element.type) {
    case "rect":
    case "image": {
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const corners = [
        { x: element.x, y: element.y },
        { x: element.x + element.width, y: element.y },
        { x: element.x + element.width, y: element.y + element.height },
        { x: element.x, y: element.y + element.height },
      ];
      return corners.map((c) => rotatePoint(c.x, c.y, cx, cy, rotation));
    }
    case "ellipse": {
      // For ellipse, use the bounding box corners
      const corners = [
        { x: element.cx - element.rx, y: element.cy - element.ry },
        { x: element.cx + element.rx, y: element.cy - element.ry },
        { x: element.cx + element.rx, y: element.cy + element.ry },
        { x: element.cx - element.rx, y: element.cy + element.ry },
      ];
      return corners.map((c) => rotatePoint(c.x, c.y, element.cx, element.cy, rotation));
    }
    case "line": {
      const cx = (element.x1 + element.x2) / 2;
      const cy = (element.y1 + element.y2) / 2;
      return [
        rotatePoint(element.x1, element.y1, cx, cy, rotation),
        rotatePoint(element.x2, element.y2, cx, cy, rotation),
      ];
    }
    case "path": {
      const cx = element.bounds.x + element.bounds.width / 2;
      const cy = element.bounds.y + element.bounds.height / 2;
      const corners = [
        { x: element.bounds.x, y: element.bounds.y },
        { x: element.bounds.x + element.bounds.width, y: element.bounds.y },
        { x: element.bounds.x + element.bounds.width, y: element.bounds.y + element.bounds.height },
        { x: element.bounds.x, y: element.bounds.y + element.bounds.height },
      ];
      return corners.map((c) => rotatePoint(c.x, c.y, cx, cy, rotation));
    }
    case "text": {
      // Use stored bounds if available
      if (element.bounds) {
        const absX = element.x + element.bounds.x;
        const absY = element.y + element.bounds.y;
        const cx = absX + element.bounds.width / 2;
        const cy = absY + element.bounds.height / 2;
        const corners = [
          { x: absX, y: absY },
          { x: absX + element.bounds.width, y: absY },
          { x: absX + element.bounds.width, y: absY + element.bounds.height },
          { x: absX, y: absY + element.bounds.height },
        ];
        return corners.map((c) => rotatePoint(c.x, c.y, cx, cy, rotation));
      }
      // Fallback estimation
      const w = element.text.length * element.fontSize * 0.6;
      const h = element.fontSize * 1.2;
      return [
        { x: element.x, y: element.y - h },
        { x: element.x + w, y: element.y },
      ];
    }
    case "polygon":
    case "polyline": {
      // For polygon/polyline, return all points (no rotation transform stored on type)
      return element.points.map((p) => ({ x: p.x, y: p.y }));
    }
    default:
      return [];
  }
}

// Calculate bounding box for elements, accounting for rotation
function calculateBounds(
  elements: CanvasElement[],
  allElements: CanvasElement[],
): { x: number; y: number; width: number; height: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const processElement = (element: CanvasElement) => {
    if (element.type === "group") {
      for (const childId of element.childIds) {
        const child = allElements.find((e) => e.id === childId);
        if (child) processElement(child);
      }
      return;
    }

    const corners = getRotatedCorners(element);
    for (const corner of corners) {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    }
  };

  for (const element of elements) {
    processElement(element);
  }

  // Add padding
  const padding = 10;
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

// Get fill and stroke attributes for SVG
function getFillStroke(element: Shape): string {
  const attrs: string[] = [];

  if (element.fill) {
    attrs.push(`fill="${element.fill}"`);
  } else {
    attrs.push('fill="none"');
  }

  if (element.stroke) {
    attrs.push(`stroke="${element.stroke.color}"`);
    attrs.push(`stroke-width="${element.stroke.width}"`);
  }

  if (element.opacity !== 1) {
    attrs.push(`opacity="${element.opacity}"`);
  }

  return attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
}

// Get transform attribute for rotation
function getTransform(element: CanvasElement): string {
  if (element.rotation === 0) return "";

  const degrees = (element.rotation * 180) / Math.PI;

  // Get center point for rotation
  let cx = 0;
  let cy = 0;

  switch (element.type) {
    case "rect":
      cx = element.x + element.width / 2;
      cy = element.y + element.height / 2;
      break;
    case "ellipse":
      cx = element.cx;
      cy = element.cy;
      break;
    case "line":
      cx = (element.x1 + element.x2) / 2;
      cy = (element.y1 + element.y2) / 2;
      break;
    case "path":
      cx = element.bounds.x + element.bounds.width / 2;
      cy = element.bounds.y + element.bounds.height / 2;
      break;
    case "group":
      return "";
  }

  return ` transform="rotate(${degrees.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})"`;
}

// Convert a single element to SVG
function elementToSVG(element: CanvasElement, allElements: CanvasElement[], indent = "  "): string {
  const transform = getTransform(element);

  switch (element.type) {
    case "rect": {
      const rx = element.rx ? ` rx="${element.rx}"` : "";
      const ry = element.ry ? ` ry="${element.ry}"` : "";
      return `${indent}<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}"${rx}${ry}${getFillStroke(element)}${transform}/>`;
    }
    case "ellipse":
      return `${indent}<ellipse cx="${element.cx}" cy="${element.cy}" rx="${element.rx}" ry="${element.ry}"${getFillStroke(element)}${transform}/>`;
    case "line":
      return `${indent}<line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}"${getFillStroke(element)}${transform}/>`;
    case "path":
      return `${indent}<path d="${element.d}"${getFillStroke(element)}${transform}/>`;
    case "text": {
      const fontWeight =
        element.fontWeight && element.fontWeight !== "normal" ? ` font-weight="${element.fontWeight}"` : "";
      const textAnchor =
        element.textAnchor && element.textAnchor !== "start" ? ` text-anchor="${element.textAnchor}"` : "";
      return `${indent}<text x="${element.x}" y="${element.y}" font-family="${element.fontFamily}" font-size="${element.fontSize}"${fontWeight}${textAnchor}${getFillStroke(element)}${transform}>${element.text}</text>`;
    }
    case "polygon": {
      const points = element.points.map((p) => `${p.x},${p.y}`).join(" ");
      return `${indent}<polygon points="${points}"${getFillStroke(element)}${transform}/>`;
    }
    case "polyline": {
      const points = element.points.map((p) => `${p.x},${p.y}`).join(" ");
      return `${indent}<polyline points="${points}"${getFillStroke(element)}${transform}/>`;
    }
    case "image": {
      const preserveAspect = element.preserveAspectRatio ? ` preserveAspectRatio="${element.preserveAspectRatio}"` : "";
      return `${indent}<image x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" href="${element.href}"${preserveAspect}${transform}/>`;
    }
    case "group": {
      const children = element.childIds
        .map((id) => allElements.find((e) => e.id === id))
        .filter(Boolean)
        .map((child) => elementToSVG(child!, allElements, `${indent}  `));
      const name = element.name ? ` id="${element.name.replace(/\s+/g, "-").toLowerCase()}"` : "";
      return `${indent}<g${name}${transform}>\n${children.join("\n")}\n${indent}</g>`;
    }
  }
}

/**
 * Export elements to SVG format
 */
export function exportToSVG(elements: CanvasElement[], allElements: CanvasElement[]): string {
  const bounds = calculateBounds(elements, allElements);

  const svgElements = elements.map((el) => elementToSVG(el, allElements)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="${bounds.x.toFixed(2)} ${bounds.y.toFixed(2)} ${bounds.width.toFixed(2)} ${bounds.height.toFixed(2)}"
     width="${bounds.width.toFixed(2)}"
     height="${bounds.height.toFixed(2)}">
${svgElements}
</svg>`;
}

/**
 * Download SVG content as a file
 */
export function downloadSVG(svgContent: string, filename = "export.svg"): void {
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
