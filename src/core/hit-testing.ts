import type { BoundingBox, ResizeHandle, Shape } from "@/types";

// Helper to get rotated corners of a shape
function getRotatedCorners(shape: Shape): { x: number; y: number }[] {
  const { x, y, width, height, rotation } = shape;
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

export function hitTestShape(worldX: number, worldY: number, shapes: Shape[]): Shape | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    // Transform the point into the shape's local coordinate system (unrotated)
    const centerX = s.x + s.width / 2;
    const centerY = s.y + s.height / 2;
    const cos = Math.cos(-s.rotation);
    const sin = Math.sin(-s.rotation);
    const dx = worldX - centerX;
    const dy = worldY - centerY;
    const localX = centerX + dx * cos - dy * sin;
    const localY = centerY + dx * sin + dy * cos;

    if (localX >= s.x && localX <= s.x + s.width && localY >= s.y && localY <= s.y + s.height) {
      return s;
    }
  }
  return null;
}

export function hitTestResizeHandle(worldX: number, worldY: number, shape: Shape, scale = 1): ResizeHandle {
  return hitTestBoundsHandle(worldX, worldY, shape, scale);
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

  // Parameter t represents position along line (0 = start, 1 = end)
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;
  const distance = Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);

  return { distance, t };
}

export function hitTestRotatedShapeHandle(worldX: number, worldY: number, shape: Shape, scale = 1): ResizeHandle {
  const handleScreenSize = 8;
  const hitScreenRadius = handleScreenSize / 2 + 4;
  const hitRadius = hitScreenRadius / scale;
  const edgeHitDistance = 6 / scale; // Distance from edge to trigger edge resize

  const corners = getRotatedCorners(shape);
  // corners: [nw, ne, se, sw]

  // First check corner handles (they take priority)
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

  // Then check edges (click on the line itself)
  const edges: { p1: { x: number; y: number }; p2: { x: number; y: number }; type: ResizeHandle }[] = [
    { p1: corners[0], p2: corners[1], type: "n" }, // top edge
    { p1: corners[1], p2: corners[2], type: "e" }, // right edge
    { p1: corners[2], p2: corners[3], type: "s" }, // bottom edge
    { p1: corners[3], p2: corners[0], type: "w" }, // left edge
  ];

  for (const edge of edges) {
    const { distance, t } = pointToLineDistance(worldX, worldY, edge.p1.x, edge.p1.y, edge.p2.x, edge.p2.y);
    // Only trigger if not too close to corners (t between 0.15 and 0.85)
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

  // Corner positions
  const corners = [
    { x: x, y: y, type: "nw" as ResizeHandle },
    { x: x + width, y: y, type: "ne" as ResizeHandle },
    { x: x + width, y: y + height, type: "se" as ResizeHandle },
    { x: x, y: y + height, type: "sw" as ResizeHandle },
  ];

  // First check corner handles
  for (const corner of corners) {
    const dx = worldX - corner.x;
    const dy = worldY - corner.y;
    if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
      return corner.type;
    }
  }

  // Then check edges
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

export function calculateBoundingBox(shapes: Shape[]): BoundingBox | null {
  if (shapes.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const shape of shapes) {
    // Get all rotated corners and find the axis-aligned bounding box
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
  shapes: Shape[],
): Shape[] {
  const minX = Math.min(box.startX, box.endX);
  const maxX = Math.max(box.startX, box.endX);
  const minY = Math.min(box.startY, box.endY);
  const maxY = Math.max(box.startY, box.endY);

  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  if (boxWidth < 3 && boxHeight < 3) return [];

  return shapes.filter((s) => {
    // Check if any rotated corner is inside the selection box
    const corners = getRotatedCorners(s);
    for (const corner of corners) {
      if (corner.x >= minX && corner.x <= maxX && corner.y >= minY && corner.y <= maxY) {
        return true;
      }
    }
    // Also check if the shape's bounding box overlaps
    const shapeBounds = calculateBoundingBox([s]);
    if (!shapeBounds) return false;
    return (
      shapeBounds.x < maxX &&
      shapeBounds.x + shapeBounds.width > minX &&
      shapeBounds.y < maxY &&
      shapeBounds.y + shapeBounds.height > minY
    );
  });
}
