/**
 * SVG Path Parser and Tessellation
 *
 * Uses svg-pathdata npm package for robust SVG path parsing.
 * Tessellates bezier curves into line segments for WebGL rendering.
 */

import earcut from "earcut";
import polygonClipping from "polygon-clipping";
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
          // Typically close path returns to subpath start, but SVGPathData handles geometric closure.
          // We track positions for consecutive commands.
          lastX = subPathStartX;
          lastY = subPathStartY;
          break;
      }
    }
  } catch (e) {
    console.error("Failed to parse path:", e);
  }

  return commands;
}

// Check if point P is inside Polygon Ring
// Ray-casting algorithm
function isPointInRing(p: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  // Loop through edges
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersect = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

// Check if Ring A is fully inside Ring B
// By checking if a point of A is inside B
// (Assuming rings don't intersect, which tessellation should handle, or we approximate)
function isRingInside(inner: [number, number][], outer: [number, number][]): boolean {
  // Use first point of inner ring
  if (inner.length === 0) return false;
  return isPointInRing(inner[0], outer);
}

// Get area of ring (shoelace formula) - strictly for checking size/sorting
function getRingArea(ring: [number, number][]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(area / 2);
}

// Ensure ring is CCW (Positive Area in Shoelace usually)
// Note: polygon-clipping expects standard GeoJSON winding:
// Exterior: CCW
// Holes: CW
function enforceWinding(ring: [number, number][], desiredCCW: boolean): [number, number][] {
  // Compute Signed Area using standard formula:
  // sum (x_i * y_{i+1} - x_{i+1} * y_i)
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    area += ring[i][0] * ring[j][1];
    area -= ring[j][0] * ring[i][1];
  }
  area /= 2;

  // In standard cartesian (Y up): Area > 0 is CCW.
  // In screen coords (Y down): Y is negative relative to up.
  // Area > 0 in screen coords usually means CW?
  // Let's just fix it relative to polygon-clipping.
  // polygon-clipping treats input as:
  // "The library assumes ... rings are not self-intersecting ... and have correct winding order... if they are part of MultiPolygon?"
  // Actually PC is robust to input winding usually.

  // BUT: Earcut strictly requires holes to differ.
  // Let's force Area > 0 -> CCW?
  // We will assume:
  // Exteriors should be CCW.
  // Holes should be CW.

  // Let's verify: (0,0) -> (1,0) -> (1,1) -> (0,1).
  // x*y_next: 0*0 + 1*1 + 1*1 + 0*0 = 2
  // x_next*y: 1*0 + 1*0 + 0*1 + 0*0 = 0
  // Area = 2/2 = 1. Positive.
  // This path is: Right, Down, Left. That is CW in screen coords.
  // So Positive Area = CW in Y-down.

  // So:
  // Ext (CCW) should have Negative Area?
  // Holes (CW) should have Positive Area.

  const currentIsCCW = area < 0; // Area < 0 is CCW in Screen Coords.

  if (desiredCCW !== currentIsCCW) {
    return [...ring].reverse();
  }
  return ring;
}

// --- Bezier Helpers ---

function arcToBeziers(
  _lastX: number,
  _lastY: number,
  _x: number,
  _y: number,
  _rx: number,
  _ry: number,
  _angle: number,
  _largeArc: boolean,
  _sweep: boolean,
): number[][] {
  // Use a library or standard formula to approximate arc with beziers
  // Minimal implementation or placeholder if not strictly needed for fonts (OpenType uses quadratic/cubic primarily)
  // But SVG paths explicitly support ARC.
  // Converting ARC to BEZIER is complex.
  // For now, assume common font paths from OpenType.js don't output 'A' commands (they usually convert to bezier).
  return [];
}

function cubicBezierPoint(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function quadraticBezierPoint(t: number, p0: number, p1: number, p2: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

// --- Tessellation & Triangulation ---

// Convert Path Commands to a list of vertices for STROKE (Line Strip)
export function pathToStrokeVertices(commands: PathCommand[], segmentsPerCurve = 16): number[] {
  const vertices: number[] = [];
  let currentX = 0;
  let currentY = 0;

  for (const cmd of commands) {
    switch (cmd.type) {
      case "M":
        currentX = cmd.args[0];
        currentY = cmd.args[1];
        vertices.push(currentX, currentY);
        break;
      case "L":
        currentX = cmd.args[0];
        currentY = cmd.args[1];
        vertices.push(currentX, currentY);
        break;
      case "C":
        for (let i = 1; i <= segmentsPerCurve; i++) {
          const t = i / segmentsPerCurve;
          const x = cubicBezierPoint(t, currentX, cmd.args[0], cmd.args[2], cmd.args[4]);
          const y = cubicBezierPoint(t, currentY, cmd.args[1], cmd.args[3], cmd.args[5]);
          vertices.push(x, y);
        }
        currentX = cmd.args[4];
        currentY = cmd.args[5];
        break;
      case "Q":
        for (let i = 1; i <= segmentsPerCurve; i++) {
          const t = i / segmentsPerCurve;
          const x = quadraticBezierPoint(t, currentX, cmd.args[0], cmd.args[2]);
          const y = quadraticBezierPoint(t, currentY, cmd.args[1], cmd.args[3]);
          vertices.push(x, y);
        }
        currentX = cmd.args[2];
        currentY = cmd.args[3];
        break;
      case "Z":
        // Close path (line to start) - handled by rendering loop usually
        break;
    }
  }
  return vertices;
}

// Tessellate path into Vertices for FILL (Triangles) using polygon-clipping and earcut
export function pathToFillVertices(commands: PathCommand[], segmentsPerCurve = 16): number[] {
  // 1. Tessellate path commands into separate rings (contours)
  const rings: [number, number][][] = [];
  let currentRing: [number, number][] = [];
  let currentX = 0;
  let currentY = 0;

  // Helper to finish ring
  const closeRing = () => {
    if (currentRing.length > 2) {
      // Ensure closure (first point equals last point) for polygon-clipping
      const first = currentRing[0];
      const last = currentRing[currentRing.length - 1];
      if (Math.abs(first[0] - last[0]) > 0.001 || Math.abs(first[1] - last[1]) > 0.001) {
        currentRing.push(first);
      }
      rings.push(currentRing);
    }
    currentRing = [];
  };

  for (const cmd of commands) {
    switch (cmd.type) {
      case "M":
        closeRing();
        currentX = cmd.args[0];
        currentY = cmd.args[1];
        currentRing.push([currentX, currentY]);
        break;
      case "L":
        currentX = cmd.args[0];
        currentY = cmd.args[1];
        currentRing.push([currentX, currentY]);
        break;
      case "C":
        for (let i = 1; i <= segmentsPerCurve; i++) {
          const t = i / segmentsPerCurve;
          const x = cubicBezierPoint(t, currentX, cmd.args[0], cmd.args[2], cmd.args[4]);
          const y = cubicBezierPoint(t, currentY, cmd.args[1], cmd.args[3], cmd.args[5]);
          currentRing.push([x, y]);
        }
        currentX = cmd.args[4];
        currentY = cmd.args[5];
        break;
      case "Q":
        for (let i = 1; i <= segmentsPerCurve; i++) {
          const t = i / segmentsPerCurve;
          const x = quadraticBezierPoint(t, currentX, cmd.args[0], cmd.args[2]);
          const y = quadraticBezierPoint(t, currentY, cmd.args[1], cmd.args[3]);
          currentRing.push([x, y]);
        }
        currentX = cmd.args[2];
        currentY = cmd.args[3];
        break;
      case "Z":
        closeRing();
        break;
    }
  }
  closeRing();

  if (rings.length === 0) return [];

  // 2. Identify Polygons and Holes
  // We need to group rings into Polygons [Exterior, Hole, Hole...]
  // Algorithm: Sorting + Containment + Winding Enforcement

  // Sort by area descending
  rings.sort((a, b) => getRingArea(b) - getRingArea(a));

  // Structure: [Exterior, Hole, Hole...]
  const polygons: [number, number][][][] = [];

  for (const ring of rings) {
    let placed = false;

    // Check against existing Polygons
    for (const poly of polygons) {
      const exterior = poly[0];

      // Check if inside the exterior of this polygon
      if (isRingInside(ring, exterior)) {
        // It is inside the exterior.
        // Is it inside any hole? (Island).
        // Simplified: If inside Ext, assume it is a Hole for this font glyph case.
        // (Font glyphs usually don't have overlapping bodies unless unioned).

        // Force Winding: Hole must be CW (Positive Area in Screen Coords).
        // enforceWinding(ring, false); // false = CW

        poly.push(enforceWinding(ring, false));
        placed = true;
        break;
      }
    }

    if (!placed) {
      // It is a new Exterior.
      // Force Winding: Ext must be CCW (Negative Area in Screen Coords).
      polygons.push([enforceWinding(ring, true)]);
    }
  }

  // 3. Compute Union of all polygons using polygon-clipping
  // This resolves overlaps between adjacent characters (if any) and cleans up geometry.
  const unioned = polygonClipping.union(polygons);

  // 4. Triangulate the result
  const allVertices: number[] = [];

  for (const poly of unioned) {
    // poly is [Exterior, Hole, Hole...]
    // Flatten for earcut
    const flatCoords: number[] = [];
    const holeIndices: number[] = [];
    let _startIndex = 0;

    for (let i = 0; i < poly.length; i++) {
      const ring = poly[i];
      if (i > 0) {
        holeIndices.push(flatCoords.length / 2); // earcut takes index in vertex count? No, index in input array (scalar count or vertex count?)
        // earcut docs: "holeIndices is an array of the start indexes... in the input array"
        // If input array is [x0, y0, x1, y1...], index is index in that array.
        // So it is flatCoords.length.
        // Wait, earcut checks "dim". If dim=2:
        // "outer ring is [0...holeIndices[0]]..."
        // It refers to index in the array.
      }

      for (const [x, y] of ring) {
        flatCoords.push(x, y);
      }
      // polygon-clipping rings are closed.
      _startIndex += ring.length;
    }

    // Adjust holeIndices to correct type (earcut expects number[])
    // Earcut also requires correctness in holeIndices.
    // If flatCoords is empty? (degenerate).
    if (flatCoords.length > 0) {
      const indices = earcut(flatCoords, holeIndices, 2);
      for (const i of indices) {
        allVertices.push(flatCoords[i * 2], flatCoords[i * 2 + 1]);
      }
    }
  }

  return allVertices;
}
