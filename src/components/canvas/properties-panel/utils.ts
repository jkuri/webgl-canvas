import type { CanvasElement, EllipseElement, LineElement } from "@/types";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

// Helper to get bounds from element
export function getElementBounds(element: CanvasElement): Bounds {
  if (element.type === "rect") {
    return {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation || 0,
    };
  }
  if (element.type === "ellipse") {
    const el = element as EllipseElement;
    return {
      x: el.cx - el.rx,
      y: el.cy - el.ry,
      width: el.rx * 2,
      height: el.ry * 2,
      rotation: el.rotation || 0,
    };
  }
  if (element.type === "line") {
    const el = element as LineElement;
    const dx = el.x2 - el.x1;
    const dy = el.y2 - el.y1;
    return {
      x: (el.x1 + el.x2) / 2,
      y: (el.y1 + el.y2) / 2,
      width: Math.sqrt(dx * dx + dy * dy),
      height: 0,
      rotation: Math.atan2(dy, dx),
    };
  }
  if (element.type === "image") {
    return {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation || 0,
    };
  }
  return { x: 0, y: 0, width: 0, height: 0, rotation: element.rotation || 0 };
}
