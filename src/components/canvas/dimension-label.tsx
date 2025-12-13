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
  isLine?: boolean;
}

export function DimensionLabel({ bounds, transform, rotation = 0, isLine = false }: DimensionLabelProps) {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  let labelX: number;
  let labelY: number;
  let rotationDeg: number;

  if (isLine) {
    // LINE LOGIC: Perpendicular offset from center
    const screenX = centerX * transform.scale + transform.x;
    const screenY = centerY * transform.scale + transform.y;
    const offsetDistance = (bounds.height / 2) * transform.scale + 16;

    const dx = -Math.sin(rotation) * offsetDistance;
    const dy = Math.cos(rotation) * offsetDistance;

    labelX = screenX + dx;
    labelY = screenY + dy;
    rotationDeg = (rotation * 180) / Math.PI;
  } else {
    // RECT LOGIC: Find visual bottom edge
    const halfW = bounds.width / 2;
    const halfH = bounds.height / 2;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH },
    ].map((c) => ({
      x: centerX + c.x * cos - c.y * sin,
      y: centerY + c.x * sin + c.y * cos,
    }));

    const edges = [
      { p1: corners[0], p2: corners[1] },
      { p1: corners[1], p2: corners[2] },
      { p1: corners[2], p2: corners[3] },
      { p1: corners[3], p2: corners[0] },
    ];

    let bottomEdge = edges[0];
    let maxMidY = -Infinity;

    for (const edge of edges) {
      const midY = (edge.p1.y + edge.p2.y) / 2;
      if (midY > maxMidY) {
        maxMidY = midY;
        bottomEdge = edge;
      }
    }

    const bottomEdgeCenterX = (bottomEdge.p1.x + bottomEdge.p2.x) / 2;
    const bottomEdgeCenterY = (bottomEdge.p1.y + bottomEdge.p2.y) / 2;
    const edgeAngle = Math.atan2(bottomEdge.p2.y - bottomEdge.p1.y, bottomEdge.p2.x - bottomEdge.p1.x);

    const screenEdgeX = bottomEdgeCenterX * transform.scale + transform.x;
    const screenEdgeY = bottomEdgeCenterY * transform.scale + transform.y;

    const outwardX = bottomEdgeCenterX - centerX;
    const outwardY = bottomEdgeCenterY - centerY;
    const outwardLen = Math.sqrt(outwardX * outwardX + outwardY * outwardY);

    const offset = 16;
    const screenOffsetX = outwardLen > 0 ? (outwardX / outwardLen) * offset : 0;
    const screenOffsetY = outwardLen > 0 ? (outwardY / outwardLen) * offset : offset;

    labelX = screenEdgeX + screenOffsetX;
    labelY = screenEdgeY + screenOffsetY;
    rotationDeg = (edgeAngle * 180) / Math.PI;
  }

  // Normalize and Flip for readability
  if (rotationDeg > 90 || rotationDeg < -90) {
    rotationDeg += 180;
  }
  rotationDeg = ((rotationDeg + 180) % 360) - 180;

  return (
    <div
      className="pointer-events-none absolute flex items-center justify-center"
      style={{
        left: labelX,
        top: labelY,
        transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
      }}
    >
      <span className="whitespace-nowrap rounded-sm bg-[#0099ff] px-1.5 py-0.5 font-medium text-[11px] text-white shadow-sm">
        {Math.round(bounds.width)} × {Math.round(bounds.height)}
      </span>
    </div>
  );
}
