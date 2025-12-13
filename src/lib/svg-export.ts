import type { CanvasElement, Shape } from "@/types";

// Calculate bounding box for elements
function calculateBounds(
  elements: CanvasElement[],
  allElements: CanvasElement[],
): { x: number; y: number; width: number; height: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const processElement = (element: CanvasElement) => {
    switch (element.type) {
      case "rect": {
        minX = Math.min(minX, element.x);
        minY = Math.min(minY, element.y);
        maxX = Math.max(maxX, element.x + element.width);
        maxY = Math.max(maxY, element.y + element.height);
        break;
      }
      case "ellipse": {
        minX = Math.min(minX, element.cx - element.rx);
        minY = Math.min(minY, element.cy - element.ry);
        maxX = Math.max(maxX, element.cx + element.rx);
        maxY = Math.max(maxY, element.cy + element.ry);
        break;
      }
      case "line": {
        minX = Math.min(minX, element.x1, element.x2);
        minY = Math.min(minY, element.y1, element.y2);
        maxX = Math.max(maxX, element.x1, element.x2);
        maxY = Math.max(maxY, element.y1, element.y2);
        break;
      }
      case "path": {
        minX = Math.min(minX, element.bounds.x);
        minY = Math.min(minY, element.bounds.y);
        maxX = Math.max(maxX, element.bounds.x + element.bounds.width);
        maxY = Math.max(maxY, element.bounds.y + element.bounds.height);
        break;
      }
      case "group": {
        for (const childId of element.childIds) {
          const child = allElements.find((e) => e.id === childId);
          if (child) processElement(child);
        }
        break;
      }
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
