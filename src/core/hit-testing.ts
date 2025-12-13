import type {
  BoundingBox,
  CanvasElement,
  EllipseElement,
  LineElement,
  RectElement,
  ResizeHandle,
  Shape,
} from "@/types";

// Helper to get rotated corners of a rect element
function getRotatedCornersRect(element: RectElement): { x: number; y: number }[] {
  const { x, y, width, height, rotation } = element;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const corners = [
    { x: x, y: y },
    { x: x + width, y: y },
    { x: x + width, y: y + height },
    { x: x, y: y + height },
  ];

  return corners.map((corner) => {
    const dx = corner.x - centerX;
    const dy = corner.y - centerY;
    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos,
    };
  });
}

// Helper to get rotated corners of an ellipse (bounding box corners)
function getRotatedCornersEllipse(element: EllipseElement): { x: number; y: number }[] {
  const { cx, cy, rx, ry, rotation } = element;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const corners = [
    { x: cx - rx, y: cy - ry },
    { x: cx + rx, y: cy - ry },
    { x: cx + rx, y: cy + ry },
    { x: cx - rx, y: cy + ry },
  ];

  return corners.map((corner) => {
    const dx = corner.x - cx;
    const dy = corner.y - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  });
}

// Get rotated corners for any shape element
export function getRotatedCorners(element: Shape): { x: number; y: number }[] {
  switch (element.type) {
    case "rect":
      return getRotatedCornersRect(element);
    case "ellipse":
      return getRotatedCornersEllipse(element);
    case "line": {
      // Lines don't have corners, return endpoints
      const { x1, y1, x2, y2 } = element;
      return [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ];
    }
    case "path": {
      // Return bounding box corners
      const { x, y, width, height } = element.bounds;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const cos = Math.cos(element.rotation);
      const sin = Math.sin(element.rotation);
      return [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ].map((corner) => {
        const dx = corner.x - centerX;
        const dy = corner.y - centerY;
        return {
          x: centerX + dx * cos - dy * sin,
          y: centerY + dx * sin + dy * cos,
        };
      });
    }
  }
}

// Hit test a single rect element
function hitTestRect(worldX: number, worldY: number, element: RectElement): boolean {
  const { x, y, width, height, rotation } = element;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const dx = worldX - centerX;
  const dy = worldY - centerY;
  const localX = centerX + dx * cos - dy * sin;
  const localY = centerY + dx * sin + dy * cos;

  return localX >= x && localX <= x + width && localY >= y && localY <= y + height;
}

// Hit test a single ellipse element
function hitTestEllipse(worldX: number, worldY: number, element: EllipseElement): boolean {
  const { cx, cy, rx, ry, rotation } = element;
  const dx = worldX - cx;
  const dy = worldY - cy;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return (localX * localX) / (rx * rx) + (localY * localY) / (ry * ry) <= 1;
}

// Helper to check if point is near a line segment
function pointToLineDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { distance: number; t: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return { distance: Math.sqrt((px - x1) ** 2 + (py - y1) ** 2), t: 0 };
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;
  const distance = Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);

  return { distance, t };
}

// Hit test a single line element
function hitTestLine(worldX: number, worldY: number, element: LineElement): boolean {
  const strokeWidth = element.stroke?.width ?? 1;
  const hitDistance = Math.max(strokeWidth / 2, 5);
  const { distance } = pointToLineDistance(worldX, worldY, element.x1, element.y1, element.x2, element.y2);
  return distance <= hitDistance;
}

// Hit test an element (any type)
export function hitTestElement(worldX: number, worldY: number, element: CanvasElement): boolean {
  if (element.visible === false) return false;
  if (element.type === "group") return false; // Groups don't have hit areas, their children do

  switch (element.type) {
    case "rect":
      return hitTestRect(worldX, worldY, element);
    case "ellipse":
      return hitTestEllipse(worldX, worldY, element);
    case "line":
      return hitTestLine(worldX, worldY, element);
    case "path": {
      // Simple bounding box hit test for paths
      const { x, y, width, height } = element.bounds;
      return worldX >= x && worldX <= x + width && worldY >= y && worldY <= y + height;
    }
  }
}

// Hit test all elements, returns the topmost hit element
export function hitTestShape(worldX: number, worldY: number, elements: CanvasElement[]): CanvasElement | null {
  // Test in reverse order (top to bottom)
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];
    if (element.visible === false) continue;
    if (element.locked) continue;
    if (element.type === "group") continue; // Skip groups

    if (hitTestElement(worldX, worldY, element)) {
      // If element has a parent, return the parent group instead
      if (element.parentId) {
        const parent = elements.find((e) => e.id === element.parentId);
        if (parent) return parent;
      }
      return element;
    }
  }
  return null;
}

export function hitTestResizeHandle(worldX: number, worldY: number, element: CanvasElement, scale = 1): ResizeHandle {
  if (element.type === "group") {
    // For groups, compute bounds from children and use axis-aligned hit test
    return null; // Groups use bounding box handles
  }
  return hitTestRotatedElementHandle(worldX, worldY, element as Shape, scale);
}

export function hitTestRotatedElementHandle(worldX: number, worldY: number, element: Shape, scale = 1): ResizeHandle {
  const handleScreenSize = 8;
  const hitScreenRadius = handleScreenSize / 2 + 4;
  const hitRadius = hitScreenRadius / scale;
  const edgeHitDistance = 6 / scale;

  const corners = getRotatedCorners(element);

  // For lines, only return endpoint handles
  if (element.type === "line") {
    const handles: { x: number; y: number; type: ResizeHandle }[] = [
      { x: corners[0].x, y: corners[0].y, type: "nw" }, // Start point
      { x: corners[1].x, y: corners[1].y, type: "se" }, // End point
    ];

    for (const handle of handles) {
      const dx = worldX - handle.x;
      const dy = worldY - handle.y;
      if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
        return handle.type;
      }
    }
    return null;
  }

  // For rect, ellipse, path: check corner handles
  const cornerHandles: { x: number; y: number; type: ResizeHandle }[] = [
    { x: corners[0].x, y: corners[0].y, type: "nw" },
    { x: corners[1].x, y: corners[1].y, type: "ne" },
    { x: corners[2].x, y: corners[2].y, type: "se" },
    { x: corners[3].x, y: corners[3].y, type: "sw" },
  ];

  for (const handle of cornerHandles) {
    const dx = worldX - handle.x;
    const dy = worldY - handle.y;
    if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
      return handle.type;
    }
  }

  // Check edges
  const edges: { p1: { x: number; y: number }; p2: { x: number; y: number }; type: ResizeHandle }[] = [
    { p1: corners[0], p2: corners[1], type: "n" },
    { p1: corners[1], p2: corners[2], type: "e" },
    { p1: corners[2], p2: corners[3], type: "s" },
    { p1: corners[3], p2: corners[0], type: "w" },
  ];

  for (const edge of edges) {
    const { distance, t } = pointToLineDistance(worldX, worldY, edge.p1.x, edge.p1.y, edge.p2.x, edge.p2.y);
    if (distance <= edgeHitDistance && t > 0.15 && t < 0.85) {
      return edge.type;
    }
  }

  return null;
}

export function hitTestBoundsHandle(worldX: number, worldY: number, bounds: BoundingBox, scale = 1): ResizeHandle {
  const handleScreenSize = 8;
  const hitScreenRadius = handleScreenSize / 2 + 4;
  const hitRadius = hitScreenRadius / scale;
  const edgeHitDistance = 6 / scale;

  const { x, y, width, height } = bounds;

  const corners = [
    { x: x, y: y, type: "nw" as ResizeHandle },
    { x: x + width, y: y, type: "ne" as ResizeHandle },
    { x: x + width, y: y + height, type: "se" as ResizeHandle },
    { x: x, y: y + height, type: "sw" as ResizeHandle },
  ];

  for (const corner of corners) {
    const dx = worldX - corner.x;
    const dy = worldY - corner.y;
    if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
      return corner.type;
    }
  }

  const edges: { p1: { x: number; y: number }; p2: { x: number; y: number }; type: ResizeHandle }[] = [
    { p1: { x, y }, p2: { x: x + width, y }, type: "n" },
    { p1: { x: x + width, y }, p2: { x: x + width, y: y + height }, type: "e" },
    { p1: { x: x + width, y: y + height }, p2: { x, y: y + height }, type: "s" },
    { p1: { x, y: y + height }, p2: { x, y }, type: "w" },
  ];

  for (const edge of edges) {
    const { distance, t } = pointToLineDistance(worldX, worldY, edge.p1.x, edge.p1.y, edge.p2.x, edge.p2.y);
    if (distance <= edgeHitDistance && t > 0.15 && t < 0.85) {
      return edge.type;
    }
  }

  return null;
}

export function calculateBoundingBox(elements: CanvasElement[]): BoundingBox | null {
  const shapes = elements.filter((e) => e.type !== "group" && e.visible !== false) as Shape[];
  if (shapes.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const shape of shapes) {
    const corners = getRotatedCorners(shape);
    for (const corner of corners) {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    }
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function getShapesInBox(
  box: { startX: number; startY: number; endX: number; endY: number },
  elements: CanvasElement[],
): CanvasElement[] {
  const minX = Math.min(box.startX, box.endX);
  const maxX = Math.max(box.startX, box.endX);
  const minY = Math.min(box.startY, box.endY);
  const maxY = Math.max(box.startY, box.endY);

  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  if (boxWidth < 3 && boxHeight < 3) return [];

  return elements.filter((element) => {
    if (element.visible === false) return false;
    if (element.type === "group") return false;
    if (element.parentId) return false; // Don't select children directly, select parent

    const shape = element as Shape;
    const corners = getRotatedCorners(shape);

    // Check if any corner is inside the selection box
    for (const corner of corners) {
      if (corner.x >= minX && corner.x <= maxX && corner.y >= minY && corner.y <= maxY) {
        return true;
      }
    }

    // Also check if the shape's bounding box overlaps
    const shapeBounds = calculateBoundingBox([shape]);
    if (!shapeBounds) return false;
    return (
      shapeBounds.x < maxX &&
      shapeBounds.x + shapeBounds.width > minX &&
      shapeBounds.y < maxY &&
      shapeBounds.y + shapeBounds.height > minY
    );
  });
}
