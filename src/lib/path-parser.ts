/**
 * SVG Path Parser and Tessellation
 *
 * Uses svg-pathdata npm package for robust SVG path parsing.
 * Tessellates bezier curves into line segments for WebGL rendering.
 */

import earcut from "earcut";
import { SVGPathData } from "svg-pathdata";

// Re-export our simplified command types for internal use
export type PathCommandType = "M" | "L" | "C" | "Q" | "Z";

export interface PathCommand {
  type: PathCommandType;
  args: number[];
}

/**
 * Parse SVG path `d` attribute into normalized absolute commands
 * All commands are converted to: M (moveto), L (lineto), C (cubic bezier), Q (quadratic bezier), Z (close)
 */
export function parsePath(d: string): PathCommand[] {
  const commands: PathCommand[] = [];
  if (!d) return commands;

  try {
    // Parse the path and convert to absolute coordinates
    const pathData = new SVGPathData(d)
      .toAbs()
      .normalizeHVZ() // Convert H/V to L, and ensure Z returns to start
      .normalizeST(); // Convert S to C, T to Q

    let lastX = 0;
    let lastY = 0;
    let subPathStartX = 0;
    let subPathStartY = 0;

    for (const cmd of pathData.commands) {
      switch (cmd.type) {
        case SVGPathData.MOVE_TO:
          commands.push({ type: "M", args: [cmd.x, cmd.y] });
          lastX = cmd.x;
          lastY = cmd.y;
          subPathStartX = cmd.x;
          subPathStartY = cmd.y;
          break;
        case SVGPathData.LINE_TO:
          commands.push({ type: "L", args: [cmd.x, cmd.y] });
          lastX = cmd.x;
          lastY = cmd.y;
          break;
        case SVGPathData.HORIZ_LINE_TO:
          commands.push({ type: "L", args: [cmd.x, lastY] });
          lastX = cmd.x;
          break;
        case SVGPathData.VERT_LINE_TO:
          commands.push({ type: "L", args: [lastX, cmd.y] });
          lastY = cmd.y;
          break;
        case SVGPathData.CURVE_TO:
          commands.push({ type: "C", args: [cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y] });
          lastX = cmd.x;
          lastY = cmd.y;
          break;
        case SVGPathData.SMOOTH_CURVE_TO:
          // helper to calculate reflection control point would be needed for true S support if not normalized
          // but normalizeST converts this to C, so this might strictly not be hit if normalizeST works as expected.
          // However, if it IS hit, normalizeST converts S to C, so we should get CURVE_TO.
          // If we do get SMOOTH_CURVE_TO, it implies normalizeST didn't convert it or we have to handle it.
          // normalizeST docs say it converts S -> C.
          // Let's assume correct conversion or fall back to treating as C with implied control point?
          // Actually, svg-pathdata normalizeST() converts S to C. So we shouldn't see S here.
          // But to be safe, we push C.
          commands.push({ type: "C", args: [cmd.x2, cmd.y2, cmd.x2, cmd.y2, cmd.x, cmd.y] });
          lastX = cmd.x;
          lastY = cmd.y;
          break;
        case SVGPathData.QUAD_TO:
          commands.push({ type: "Q", args: [cmd.x1, cmd.y1, cmd.x, cmd.y] });
          lastX = cmd.x;
          lastY = cmd.y;
          break;
        case SVGPathData.SMOOTH_QUAD_TO:
          // Should be converted to Q by normalizeST
          commands.push({ type: "Q", args: [cmd.x, cmd.y, cmd.x, cmd.y] });
          lastX = cmd.x;
          lastY = cmd.y;
          break;
        case SVGPathData.ARC: {
          // Convert arc to cubic bezier approximation
          // Use lastX, lastY as start point
          const arcBeziers = arcToBeziers(
            lastX,
            lastY,
            cmd.x,
            cmd.y,
            cmd.rX,
            cmd.rY,
            cmd.xRot,
            cmd.lArcFlag !== 0,
            cmd.sweepFlag !== 0,
          );
          for (const bez of arcBeziers) {
            if (bez.length === 6) {
              commands.push({ type: "C", args: bez });
            }
          }
          lastX = cmd.x;
          lastY = cmd.y;
          break;
        }
        case SVGPathData.CLOSE_PATH:
          commands.push({ type: "Z", args: [] });
          // Z moves us back to subPathStart
          lastX = subPathStartX;
          lastY = subPathStartY;
          break;
      }
    }
  } catch (error) {
    console.error("Failed to parse SVG path:", error);
  }

  return commands;
}

/**
 * Convert arc to cubic bezier curves
 */
function arcToBeziers(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx: number,
  ry: number,
  phi: number,
  largeArc: boolean,
  sweep: boolean,
): number[][] {
  // Handle degenerate cases
  if (rx === 0 || ry === 0) {
    return [[x1, y1, x2, y2, x2, y2]];
  }

  const phiRad = (phi * Math.PI) / 180;
  const cosPhi = Math.cos(phiRad);
  const sinPhi = Math.sin(phiRad);

  // Step 1: Compute (x1', y1')
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Correct radii
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  const rxSq = rx * rx;
  const rySq = ry * ry;

  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const lambdaSqrt = Math.sqrt(lambda);
    rx *= lambdaSqrt;
    ry *= lambdaSqrt;
  }

  // Step 2: Compute (cx', cy')
  const rxSq2 = rx * rx;
  const rySq2 = ry * ry;
  const num = rxSq2 * rySq2 - rxSq2 * y1pSq - rySq2 * x1pSq;
  const den = rxSq2 * y1pSq + rySq2 * x1pSq;
  let sq = Math.max(0, num / den);
  sq = Math.sqrt(sq);
  if (largeArc === sweep) sq = -sq;

  const cxp = (sq * rx * y1p) / ry;
  const cyp = (-sq * ry * x1p) / rx;

  // Step 3: Compute (cx, cy) from (cx', cy')
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Step 4: Compute angles
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const sign = ux * vy - uy * vx < 0 ? -1 : 1;
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    return sign * Math.acos(Math.max(-1, Math.min(1, dot / len)));
  };

  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);

  if (!sweep && dtheta > 0) dtheta -= 2 * Math.PI;
  if (sweep && dtheta < 0) dtheta += 2 * Math.PI;

  // Split arc into segments
  const segments = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / 2)));
  const segmentAngle = dtheta / segments;
  const beziers: number[][] = [];

  for (let i = 0; i < segments; i++) {
    const start = theta1 + i * segmentAngle;
    const end = start + segmentAngle;

    // Convert arc segment to cubic bezier
    const alpha = (4 / 3) * Math.tan(segmentAngle / 4);

    const cosStart = Math.cos(start);
    const sinStart = Math.sin(start);
    const cosEnd = Math.cos(end);
    const sinEnd = Math.sin(end);

    const p0x = cx + rx * (cosPhi * cosStart - sinPhi * sinStart);
    const p0y = cy + rx * (sinPhi * cosStart + cosPhi * sinStart);
    const p3x = cx + rx * (cosPhi * cosEnd - sinPhi * sinEnd);
    const p3y = cy + rx * (sinPhi * cosEnd + cosPhi * sinEnd);

    const p1x = p0x - alpha * rx * (cosPhi * sinStart + sinPhi * cosStart);
    const p1y = p0y - alpha * rx * (sinPhi * sinStart - cosPhi * cosStart);
    const p2x = p3x + alpha * rx * (cosPhi * sinEnd + sinPhi * cosEnd);
    const p2y = p3y + alpha * rx * (sinPhi * sinEnd - cosPhi * cosEnd);

    beziers.push([p1x, p1y, p2x, p2y, p3x, p3y]);
  }

  return beziers;
}

// Cubic bezier point at t
function cubicBezierPoint(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  t: number,
): [number, number] {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3,
    mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3,
  ];
}

// Quadratic bezier point at t
function quadraticBezierPoint(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
): [number, number] {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return [mt2 * x0 + 2 * mt * t * x1 + t2 * x2, mt2 * y0 + 2 * mt * t * y1 + t2 * y2];
}

/**
 * Convert path commands to stroke vertices (line segments for outline)
 */
export function pathToStrokeVertices(commands: PathCommand[], segmentsPerCurve = 16): number[] {
  const vertices: number[] = [];
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;

  for (const cmd of commands) {
    switch (cmd.type) {
      case "M":
        currentX = cmd.args[0];
        currentY = cmd.args[1];
        startX = currentX;
        startY = currentY;
        break;
      case "L":
        vertices.push(currentX, currentY);
        currentX = cmd.args[0];
        currentY = cmd.args[1];
        vertices.push(currentX, currentY);
        break;
      case "C": {
        const [x1, y1, x2, y2, x, y] = cmd.args;
        for (let i = 0; i < segmentsPerCurve; i++) {
          const t1 = i / segmentsPerCurve;
          const t2 = (i + 1) / segmentsPerCurve;
          const [px1, py1] = cubicBezierPoint(currentX, currentY, x1, y1, x2, y2, x, y, t1);
          const [px2, py2] = cubicBezierPoint(currentX, currentY, x1, y1, x2, y2, x, y, t2);
          vertices.push(px1, py1);
          vertices.push(px2, py2);
        }
        currentX = x;
        currentY = y;
        break;
      }
      case "Q": {
        const [qx1, qy1, qx, qy] = cmd.args;
        for (let i = 0; i < segmentsPerCurve; i++) {
          const t1 = i / segmentsPerCurve;
          const t2 = (i + 1) / segmentsPerCurve;
          const [px1, py1] = quadraticBezierPoint(currentX, currentY, qx1, qy1, qx, qy, t1);
          const [px2, py2] = quadraticBezierPoint(currentX, currentY, qx1, qy1, qx, qy, t2);
          vertices.push(px1, py1);
          vertices.push(px2, py2);
        }
        currentX = qx;
        currentY = qy;
        break;
      }
      case "Z":
        if (currentX !== startX || currentY !== startY) {
          vertices.push(currentX, currentY);
          vertices.push(startX, startY);
        }
        currentX = startX;
        currentY = startY;
        break;
    }
  }

  return vertices;
}

/**
 * Tessellate path commands into triangulated vertices for WebGL fill rendering
 * Uses a simple polygon triangulation (earcut-like algorithm)
 */
export function pathToFillVertices(commands: PathCommand[], segmentsPerCurve = 16): number[] {
  // First, flatten the path to a polygon with proper hole detection
  const polygon: number[] = [];
  const holes: number[] = [];
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  let isFirstSubpath = true;

  for (const cmd of commands) {
    switch (cmd.type) {
      case "M":
        // Each M command after the first starts a new subpath (hole)
        if (!isFirstSubpath && polygon.length > 0) {
          // Register the start of this new subpath as a hole
          // The hole index is the number of vertices (polygon.length / 2) BEFORE adding the new point
          holes.push(polygon.length / 2);
        }
        isFirstSubpath = false;
        currentX = cmd.args[0];
        currentY = cmd.args[1];
        startX = currentX;
        startY = currentY;
        polygon.push(currentX, currentY);
        break;
      case "L":
        currentX = cmd.args[0];
        currentY = cmd.args[1];
        polygon.push(currentX, currentY);
        break;
      case "C": {
        const [x1, y1, x2, y2, x, y] = cmd.args;
        for (let i = 1; i <= segmentsPerCurve; i++) {
          const t = i / segmentsPerCurve;
          const [px, py] = cubicBezierPoint(currentX, currentY, x1, y1, x2, y2, x, y, t);
          polygon.push(px, py);
        }
        currentX = x;
        currentY = y;
        break;
      }
      case "Q": {
        const [qx1, qy1, qx, qy] = cmd.args;
        for (let i = 1; i <= segmentsPerCurve; i++) {
          const t = i / segmentsPerCurve;
          const [px, py] = quadraticBezierPoint(currentX, currentY, qx1, qy1, qx, qy, t);
          polygon.push(px, py);
        }
        currentX = qx;
        currentY = qy;
        break;
      }
      case "Z":
        // Close path - handled by triangulation
        currentX = startX;
        currentY = startY;
        break;
    }
  }

  // Triangulate using earcut (handles complex polygons and holes)
  if (polygon.length < 6) return [];

  // Use the collected hole indices directly - earcut expects indices of the first vertex of each hole
  const indices = earcut(polygon, holes.length > 0 ? holes : undefined);

  // Convert triangle indices to flat vertex array
  const vertices: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];
    vertices.push(
      polygon[i0 * 2],
      polygon[i0 * 2 + 1],
      polygon[i1 * 2],
      polygon[i1 * 2 + 1],
      polygon[i2 * 2],
      polygon[i2 * 2 + 1],
    );
  }

  return vertices;
}
