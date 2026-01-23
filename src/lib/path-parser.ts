import earcut from "earcut";
import polygonClipping from "polygon-clipping";
import { SVGPathData } from "svg-pathdata";

export type PathCommandType = "M" | "L" | "C" | "Q" | "Z";

export interface PathCommand {
  type: PathCommandType;
  args: number[];
}

export function parsePath(d: string): PathCommand[] {
  const commands: PathCommand[] = [];
  if (!d) return commands;

  try {
    const pathData = new SVGPathData(d).toAbs().normalizeHVZ().normalizeST();

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

function isPointInRing(p: [number, number], ring: [number, number][]): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersect = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

function isRingInside(inner: [number, number][], outer: [number, number][]): boolean {
  if (inner.length === 0) return false;
  return isPointInRing(inner[0], outer);
}

function getRingArea(ring: [number, number][]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(area / 2);
}

function enforceWinding(ring: [number, number][], desiredCCW: boolean): [number, number][] {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    area += ring[i][0] * ring[j][1];
    area -= ring[j][0] * ring[i][1];
  }
  area /= 2;

  const currentIsCCW = area < 0;

  if (desiredCCW !== currentIsCCW) {
    return [...ring].reverse();
  }
  return ring;
}

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
        break;
    }
  }
  return vertices;
}

export function pathToFillVertices(commands: PathCommand[], segmentsPerCurve = 16): number[] {
  const rings: [number, number][][] = [];
  let currentRing: [number, number][] = [];
  let currentX = 0;
  let currentY = 0;

  const closeRing = () => {
    if (currentRing.length > 2) {
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

  rings.sort((a, b) => getRingArea(b) - getRingArea(a));

  const polygons: [number, number][][][] = [];

  for (const ring of rings) {
    let placed = false;

    for (const poly of polygons) {
      const exterior = poly[0];

      if (isRingInside(ring, exterior)) {
        poly.push(enforceWinding(ring, false));
        placed = true;
        break;
      }
    }

    if (!placed) {
      polygons.push([enforceWinding(ring, true)]);
    }
  }

  let unioned: polygonClipping.MultiPolygon;
  try {
    unioned = polygonClipping.union(polygons);
  } catch {
    console.warn("polygon-clipping union failed, using original polygons");
    unioned = polygons;
  }

  const allVertices: number[] = [];

  for (const poly of unioned) {
    const flatCoords: number[] = [];
    const holeIndices: number[] = [];
    let _startIndex = 0;

    for (let i = 0; i < poly.length; i++) {
      const ring = poly[i];
      if (i > 0) {
        holeIndices.push(flatCoords.length / 2);
      }

      for (const [x, y] of ring) {
        flatCoords.push(x, y);
      }

      _startIndex += ring.length;
    }

    if (flatCoords.length > 0) {
      const indices = earcut(flatCoords, holeIndices, 2);
      for (const i of indices) {
        allVertices.push(flatCoords[i * 2], flatCoords[i * 2 + 1]);
      }
    }
  }

  return allVertices;
}
