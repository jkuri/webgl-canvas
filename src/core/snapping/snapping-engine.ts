import type { CanvasElement, SmartGuide } from "@/types";
import type { Bounds, Point, SnapLine, SnapResult, SnapState } from "./types";

export function createSnapState(elements: CanvasElement[], excludeIds: Set<string>): SnapState {
  const eligible = elements.filter((e) => !excludeIds.has(e.id) && !e.parentId);

  const verticalLines: SnapLine[] = [];
  const horizontalLines: SnapLine[] = [];
  const boundsList: Bounds[] = [];
  const points: Point[] = [];

  for (const element of eligible) {
    const bounds = getBounds(element, elements);
    bounds.id = element.id;
    boundsList.push(bounds);

    verticalLines.push(
      {
        value: bounds.minX,
        type: "start",
        origin: bounds.minY,
        range: [bounds.minY, bounds.maxY],
        elementId: element.id,
      },
      {
        value: bounds.centerX,
        type: "center",
        origin: bounds.minY,
        range: [bounds.minY, bounds.maxY],
        elementId: element.id,
      },
      {
        value: bounds.maxX,
        type: "end",
        origin: bounds.minY,
        range: [bounds.minY, bounds.maxY],
        elementId: element.id,
      },
    );

    horizontalLines.push(
      {
        value: bounds.minY,
        type: "start",
        origin: bounds.minX,
        range: [bounds.minX, bounds.maxX],
        elementId: element.id,
      },
      {
        value: bounds.centerY,
        type: "center",
        origin: bounds.minX,
        range: [bounds.minX, bounds.maxX],
        elementId: element.id,
      },
      {
        value: bounds.maxY,
        type: "end",
        origin: bounds.minX,
        range: [bounds.minX, bounds.maxX],
        elementId: element.id,
      },
    );

    points.push(...getSnapPoints(element, bounds));
  }

  verticalLines.sort((a, b) => a.value - b.value);
  horizontalLines.sort((a, b) => a.value - b.value);

  const xSortedBounds = [...boundsList].sort((a, b) => a.minX - b.minX);
  const ySortedBounds = [...boundsList].sort((a, b) => a.minY - b.minY);

  return {
    verticalLines,
    horizontalLines,
    xSortedBounds,
    ySortedBounds,
    points,
  };
}

export function calculateSnaps(
  projected: Bounds,
  state: SnapState,
  config: {
    snapToGrid: boolean;
    snapToObjects: boolean;
    snapToGeometry: boolean;
    gridSize: number;
    threshold: number;
    scale: number;
  },
): SnapResult {
  const { snapToGrid, snapToObjects, snapToGeometry, gridSize, scale } = config;
  const threshold = config.threshold / scale;

  const result: SnapResult = { x: 0, y: 0, guides: [] };

  let alignX: { diff: number; guides: SmartGuide[]; dist: number } | null = null;
  let alignY: { diff: number; guides: SmartGuide[]; dist: number } | null = null;

  if (snapToObjects) {
    alignX = findBestAlignment(projected, state.verticalLines, "x", threshold);
    alignY = findBestAlignment(projected, state.horizontalLines, "y", threshold);
  }

  let spaceX: { diff: number; guides: SmartGuide[]; dist: number } | null = null;
  let spaceY: { diff: number; guides: SmartGuide[]; dist: number } | null = null;

  if (snapToObjects) {
    spaceX = findBestSpacing(projected, state.xSortedBounds, "x", threshold);
    spaceY = findBestSpacing(projected, state.ySortedBounds, "y", threshold);
  }

  let gridX = 0;
  let gridY = 0;
  let hasGridX = false;
  let hasGridY = false;

  if (snapToGrid) {
    const gx = Math.round(projected.minX / gridSize) * gridSize - projected.minX;
    const gy = Math.round(projected.minY / gridSize) * gridSize - projected.minY;

    if (Math.abs(gx) < threshold) {
      gridX = gx;
      hasGridX = true;
    }
    if (Math.abs(gy) < threshold) {
      gridY = gy;
      hasGridY = true;
    }
  }

  const candidatesX = [];
  if (alignX) candidatesX.push(alignX);
  if (spaceX) candidatesX.push(spaceX);

  let bestObjX = null;
  if (candidatesX.length > 0) {
    candidatesX.sort((a, b) => a.dist - b.dist);

    bestObjX = candidatesX[0];
  }

  if (bestObjX) {
    result.x = bestObjX.diff;
    result.guides.push(...bestObjX.guides);
  } else if (hasGridX) {
    result.x = gridX;
  }

  const candidatesY = [];
  if (alignY) candidatesY.push(alignY);
  if (spaceY) candidatesY.push(spaceY);

  let bestObjY = null;
  if (candidatesY.length > 0) {
    candidatesY.sort((a, b) => a.dist - b.dist);
    bestObjY = candidatesY[0];
  }

  if (bestObjY) {
    result.y = bestObjY.diff;
    result.guides.push(...bestObjY.guides);
  } else if (hasGridY) {
    result.y = gridY;
  }

  if (snapToGeometry && state.points.length > 0) {
    const geoSnap = findGeometrySnap(projected, state.points, threshold);
    if (geoSnap) {
      const currentDistX = bestObjX ? bestObjX.dist : hasGridX ? Math.abs(gridX) : Infinity;
      const currentDistY = bestObjY ? bestObjY.dist : hasGridY ? Math.abs(gridY) : Infinity;

      const geoDist = Math.sqrt(geoSnap.diffX * geoSnap.diffX + geoSnap.diffY * geoSnap.diffY);

      if (geoDist < threshold && geoDist < Math.min(currentDistX, currentDistY)) {
        result.x = geoSnap.diffX;
        result.y = geoSnap.diffY;
        result.guides.push(...geoSnap.guides);
      }
    }
  }

  return result;
}

function findBestAlignment(bounds: Bounds, lines: SnapLine[], axis: "x" | "y", threshold: number) {
  const targets = axis === "x" ? [bounds.minX, bounds.centerX, bounds.maxX] : [bounds.minY, bounds.centerY, bounds.maxY];

  let bestDiff = Infinity;
  let bestGuides: SmartGuide[] = [];

  for (let i = 0; i < targets.length; i++) {
    const val = targets[i];

    const minVal = val - threshold;
    const maxVal = val + threshold;

    let idx = lowerBound(lines, minVal);

    while (idx < lines.length && lines[idx].value <= maxVal) {
      const line = lines[idx];
      const diff = line.value - val;
      const dist = Math.abs(diff);

      if (dist < Math.abs(bestDiff)) {
        bestDiff = diff;

        const guides: SmartGuide[] = [];

        if (axis === "x") {
          const myMinY = bounds.minY;
          const myMaxY = bounds.maxY;
          const otherMinY = line.range[0];
          const otherMaxY = line.range[1];

          const y1 = Math.min(myMinY, otherMinY);
          const y2 = Math.max(myMaxY, otherMaxY);

          guides.push({
            type: "alignment",
            axis: "x",
            position: line.value,
            x1: line.value,
            y1: y1,
            x2: line.value,
            y2: y2,
          });
        } else {
          const myMinX = bounds.minX;
          const myMaxX = bounds.maxX;
          const otherMinX = line.range[0];
          const otherMaxX = line.range[1];

          const x1 = Math.min(myMinX, otherMinX);
          const x2 = Math.max(myMaxX, otherMaxX);

          guides.push({
            type: "alignment",
            axis: "y",
            position: line.value,
            x1: x1,
            y1: line.value,
            x2: x2,
            y2: line.value,
          });
        }
        bestGuides = guides;
      }
      idx++;
    }
  }

  if (bestDiff === Infinity) return null;
  return { diff: bestDiff, guides: bestGuides, dist: Math.abs(bestDiff) };
}

function lowerBound(lines: SnapLine[], value: number): number {
  let low = 0,
    high = lines.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (lines[mid].value < value) low = mid + 1;
    else high = mid;
  }
  return low;
}

function findBestSpacing(bounds: Bounds, sortedBounds: Bounds[], axis: "x" | "y", threshold: number) {
  const minVal = axis === "x" ? bounds.minX : bounds.minY;
  const maxVal = axis === "x" ? bounds.maxX : bounds.maxY;
  const size = maxVal - minVal;

  const centerIdx = lowerBoundBounds(sortedBounds, minVal, axis);

  let leftNeighbor: Bounds | null = null;
  let rightNeighbor: Bounds | null = null;

  for (let i = centerIdx - 1; i >= 0; i--) {
    const b = sortedBounds[i];
    const bMax = axis === "x" ? b.maxX : b.maxY;

    const overlaps = axis === "x" ? b.maxY > bounds.minY && b.minY < bounds.maxY : b.maxX > bounds.minX && b.minX < bounds.maxX;

    if (overlaps) {
      if (bMax < minVal) {
        if (!leftNeighbor) {
          leftNeighbor = b;
          break;
        }
      }
    }
  }

  for (let i = centerIdx; i < sortedBounds.length; i++) {
    const b = sortedBounds[i];
    const bMin = axis === "x" ? b.minX : b.minY;

    const overlaps = axis === "x" ? b.maxY > bounds.minY && b.minY < bounds.maxY : b.maxX > bounds.minX && b.minX < bounds.maxX;

    if (overlaps) {
      if (bMin > maxVal) {
        if (!rightNeighbor) {
          rightNeighbor = b;
          break;
        }
      }
    }
  }

  if (leftNeighbor && rightNeighbor) {
    const leftMax = axis === "x" ? leftNeighbor.maxX : leftNeighbor.maxY;
    const rightMin = axis === "x" ? rightNeighbor.minX : rightNeighbor.minY;

    const totalSpace = rightMin - leftMax;
    const targetGap = (totalSpace - size) / 2;
    const targetPos = leftMax + targetGap;

    const diff = targetPos - minVal;

    if (Math.abs(diff) < threshold) {
      const guides: SmartGuide[] = [];
      const gapSize = Math.round(targetGap);
      const otherCenter = axis === "x" ? (bounds.minY + bounds.maxY) / 2 : (bounds.minX + bounds.maxX) / 2;

      if (axis === "x") {
        guides.push(
          {
            type: "spacing",
            x1: leftMax,
            y1: otherCenter,
            x2: targetPos,
            y2: otherCenter,
            label: gapSize.toString(),
          },
          {
            type: "spacing",
            x1: targetPos + size,
            y1: otherCenter,
            x2: rightMin,
            y2: otherCenter,
            label: gapSize.toString(),
          },
        );
      } else {
        guides.push(
          {
            type: "spacing",
            x1: otherCenter,
            y1: leftMax,
            x2: otherCenter,
            y2: targetPos,
            label: gapSize.toString(),
          },
          {
            type: "spacing",
            x1: otherCenter,
            y1: targetPos + size,
            x2: otherCenter,
            y2: rightMin,
            label: gapSize.toString(),
          },
        );
      }

      return { diff, guides, dist: Math.abs(diff) };
    }
  }

  return null;
}

function lowerBoundBounds(bounds: Bounds[], value: number, axis: "x" | "y"): number {
  let low = 0,
    high = bounds.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    const v = axis === "x" ? bounds[mid].minX : bounds[mid].minY;
    if (v < value) low = mid + 1;
    else high = mid;
  }
  return low;
}

function findGeometrySnap(projected: Bounds, points: Point[], threshold: number) {
  const myPoints = [
    { x: projected.minX, y: projected.minY },
    { x: projected.maxX, y: projected.minY },
    { x: projected.maxX, y: projected.maxY },
    { x: projected.minX, y: projected.maxY },
    { x: projected.centerX, y: projected.centerY },
  ];

  let bestDist = threshold;
  let bestSnap: { diffX: number; diffY: number; guides: SmartGuide[] } | null = null;

  for (const myP of myPoints) {
    for (const otherP of points) {
      const dx = otherP.x - myP.x;
      const dy = otherP.y - myP.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDist) {
        bestDist = dist;
        bestSnap = {
          diffX: dx,
          diffY: dy,
          guides: [
            {
              type: "center",
              cx: otherP.x,
              cy: otherP.y,
            },
          ],
        };
      }
    }
  }
  return bestSnap;
}

export function getBounds(element: CanvasElement, allElements: CanvasElement[]): Bounds {
  if (element.type === "group") {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const childId of element.childIds) {
      const child = allElements.find((e) => e.id === childId);
      if (child) {
        const b = getBounds(child, allElements);
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }
    }
    if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0, centerX: 0, centerY: 0 };

    if (element.rotation && element.rotation !== 0) {
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];

      const cos = Math.cos(element.rotation);
      const sin = Math.sin(element.rotation);

      const rotatedCorners = corners.map((corner) => {
        const dx = corner.x - centerX;
        const dy = corner.y - centerY;
        return {
          x: centerX + dx * cos - dy * sin,
          y: centerY + dx * sin + dy * cos,
        };
      });

      minX = Math.min(...rotatedCorners.map((c) => c.x));
      minY = Math.min(...rotatedCorners.map((c) => c.y));
      maxX = Math.max(...rotatedCorners.map((c) => c.x));
      maxY = Math.max(...rotatedCorners.map((c) => c.y));

      return { minX, minY, maxX, maxY, centerX, centerY };
    }

    return { minX, minY, maxX, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
  }

  let minX = 0,
    minY = 0,
    maxX = 0,
    maxY = 0;

  if (element.type === "ellipse") {
    minX = element.cx - element.rx;
    minY = element.cy - element.ry;
    maxX = element.cx + element.rx;
    maxY = element.cy + element.ry;
  } else if (element.type === "line") {
    minX = Math.min(element.x1, element.x2);
    minY = Math.min(element.y1, element.y2);
    maxX = Math.max(element.x1, element.x2);
    maxY = Math.max(element.y1, element.y2);
  } else if (element.type === "path") {
    minX = element.bounds.x;
    minY = element.bounds.y;
    maxX = element.bounds.x + element.bounds.width;
    maxY = element.bounds.y + element.bounds.height;
  } else if (element.type === "text") {
    if (element.bounds) {
      minX = element.x + element.bounds.x;
      minY = element.y + element.bounds.y;
      maxX = minX + element.bounds.width;
      maxY = minY + element.bounds.height;
    } else {
      minX = element.x;
      minY = element.y - element.fontSize;
      maxX = element.x + (element.text?.length || 0) * element.fontSize * 0.6;
      maxY = element.y;
    }
  } else if (element.type === "polygon" || element.type === "polyline") {
    if (element.points.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, centerX: 0, centerY: 0 };
    }
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    for (const pt of element.points) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
  } else {
    minX = element.x;
    minY = element.y;
    maxX = element.x + element.width;
    maxY = element.y + element.height;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

export function getSnapPoints(element: CanvasElement, bounds: Bounds): Point[] {
  const points: Point[] = [];

  if (element.type === "polygon" || element.type === "polyline") {
    for (const pt of element.points) {
      points.push({ x: pt.x, y: pt.y });
    }
    return points;
  }

  points.push(
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.centerX, y: bounds.centerY },
  );
  return points;
}
