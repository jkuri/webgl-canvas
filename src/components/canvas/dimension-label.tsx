import type { Transform } from "@/types";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DimensionLabelProps {
  bounds: BoundingBox;
  transform: Transform;
  rotation?: number;
}

export function DimensionLabel({ bounds, transform, rotation = 0 }: DimensionLabelProps) {
  // Calculate center of the shape in world coordinates
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  const halfW = bounds.width / 2;
  const halfH = bounds.height / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  // Calculate the 4 corners in world space
  const corners = [
    { x: -halfW, y: -halfH }, // top-left (index 0)
    { x: halfW, y: -halfH }, // top-right (index 1)
    { x: halfW, y: halfH }, // bottom-right (index 2)
    { x: -halfW, y: halfH }, // bottom-left (index 3)
  ].map((c) => ({
    x: centerX + c.x * cos - c.y * sin,
    y: centerY + c.x * sin + c.y * cos,
  }));

  // Find which edge is at the bottom by checking which edge's midpoint has the highest Y
  const edges = [
    { p1: corners[0], p2: corners[1] }, // top edge
    { p1: corners[1], p2: corners[2] }, // right edge
    { p1: corners[2], p2: corners[3] }, // bottom edge
    { p1: corners[3], p2: corners[0] }, // left edge
  ];

  // Find the edge with the highest midpoint Y (the visual bottom edge)
  let bottomEdge = edges[0];
  let maxMidY = -Infinity;

  for (const edge of edges) {
    const midY = (edge.p1.y + edge.p2.y) / 2;
    if (midY > maxMidY) {
      maxMidY = midY;
      bottomEdge = edge;
    }
  }

  // Calculate the center of the bottom edge
  const bottomEdgeCenterX = (bottomEdge.p1.x + bottomEdge.p2.x) / 2;
  const bottomEdgeCenterY = (bottomEdge.p1.y + bottomEdge.p2.y) / 2;

  // Calculate the angle of the bottom edge
  const edgeAngle = Math.atan2(bottomEdge.p2.y - bottomEdge.p1.y, bottomEdge.p2.x - bottomEdge.p1.x);

  // Convert bottom edge center to screen coordinates first
  const screenEdgeX = bottomEdgeCenterX * transform.scale + transform.x;
  const screenEdgeY = bottomEdgeCenterY * transform.scale + transform.y;

  // Calculate outward direction from shape center to edge midpoint
  const outwardX = bottomEdgeCenterX - centerX;
  const outwardY = bottomEdgeCenterY - centerY;
  const outwardLen = Math.sqrt(outwardX * outwardX + outwardY * outwardY);

  // Apply offset in screen space (constant 16px regardless of zoom)
  const offset = 16;
  const screenOffsetX = outwardLen > 0 ? (outwardX / outwardLen) * offset : 0;
  const screenOffsetY = outwardLen > 0 ? (outwardY / outwardLen) * offset : offset;

  const screenX = screenEdgeX + screenOffsetX;
  const screenY = screenEdgeY + screenOffsetY;

  // Convert edge angle to degrees for CSS rotation
  // Keep text readable (not upside down) - if angle would make text upside down, flip it
  let rotationDeg = (edgeAngle * 180) / Math.PI;
  if (rotationDeg > 90 || rotationDeg < -90) {
    rotationDeg += 180;
  }

  return (
    <div
      className="pointer-events-none absolute flex items-center justify-center"
      style={{
        left: screenX,
        top: screenY,
        transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
      }}
    >
      <span className="whitespace-nowrap rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground shadow-sm">
        {Math.round(bounds.width)} × {Math.round(bounds.height)}
      </span>
    </div>
  );
}
