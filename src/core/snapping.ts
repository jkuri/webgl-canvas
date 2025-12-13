import type { CanvasElement, SmartGuide } from "@/types";

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
}

export function getBounds(element: CanvasElement): Bounds {
  if (element.type === "rect") {
    return {
      minX: element.x,
      minY: element.y,
      maxX: element.x + element.width,
      maxY: element.y + element.height,
      centerX: element.x + element.width / 2,
      centerY: element.y + element.height / 2,
    };
  }
  if (element.type === "ellipse") {
    return {
      minX: element.cx - element.rx,
      minY: element.cy - element.ry,
      maxX: element.cx + element.rx,
      maxY: element.cy + element.ry,
      centerX: element.cx,
      centerY: element.cy,
    };
  }
  if (element.type === "line") {
      const minX = Math.min(element.x1, element.x2);
      const maxX = Math.max(element.x1, element.x2);
      const minY = Math.min(element.y1, element.y2);
      const maxY = Math.max(element.y1, element.y2);
      return {
          minX, minY, maxX, maxY,
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2
      };
  }
  if (element.type === "path") {
       return {
            minX: element.bounds.x,
            minY: element.bounds.y,
            maxX: element.bounds.x + element.bounds.width,
            maxY: element.bounds.y + element.bounds.height,
            centerX: element.bounds.x + element.bounds.width / 2,
            centerY: element.bounds.y + element.bounds.height / 2
       }
  }
  return { minX: 0, minY: 0, maxX: 0, maxY: 0, centerX: 0, centerY: 0 };
}
export interface Point {
  x: number;
  y: number;
}

export function getSnapPoints(element: CanvasElement): Point[] {
    const points: Point[] = [];
    if (element.type === "rect") {
        points.push({ x: element.x, y: element.y }); // Top-Left
        points.push({ x: element.x + element.width, y: element.y }); // Top-Right
        points.push({ x: element.x + element.width, y: element.y + element.height }); // Bottom-Right
        points.push({ x: element.x, y: element.y + element.height }); // Bottom-Left
    } else if (element.type === "line") {
        points.push({ x: element.x1, y: element.y1 });
        points.push({ x: element.x2, y: element.y2 });
    } else if (element.type === "path") {
        // Rudimentary parsing of path commands to get points could go here.
        // For now, let's just use bounding box corners as a slightly better proxy than nothing,
        // or if we have the points stored.
        // Assuming path element structure might evolve.
        // If we want actual vertices, we need to parse d string.
        // Let's stick to corners for now if parsing is complex, or add a TODO.
        const b = getBounds(element);
        points.push({ x: b.minX, y: b.minY });
        points.push({ x: b.maxX, y: b.minY });
        points.push({ x: b.maxX, y: b.maxY });
        points.push({ x: b.minX, y: b.maxY });
    } else if (element.type === 'ellipse') {
        points.push({ x: element.cx, y: element.cy }); // Center
        points.push({ x: element.cx, y: element.cy - element.ry }); // Top
        points.push({ x: element.cx + element.rx, y: element.cy }); // Right
        points.push({ x: element.cx, y: element.cy + element.ry }); // Bottom
        points.push({ x: element.cx - element.rx, y: element.cy }); // Left
    }
    return points;
}
export interface SnapAdjustment {
  x: number;
  y: number;
  guides: SmartGuide[];
}

export function calculateSnapAdjustment(
  projectedBounds: Bounds,
  candidates: Bounds[],
  candidatePoints: Point[], // New: All vertices from all other objects
  snapToGrid: boolean,
  snapToObjects: boolean,
  snapToGeometry: boolean,
  scale: number,
  threshold = 10 // Screen pixels
): SnapAdjustment {
  const { minX, minY, maxX, maxY, centerX, centerY } = projectedBounds;

  let snapX = 0;
  let snapY = 0;
  const guides: SmartGuide[] = [];
  const snapThreshold = threshold / scale;

  // 1. Grid Snapping (Low priority)
  if (snapToGrid) {
      const gridSize = 10;
      const snapLeft = Math.round(minX / gridSize) * gridSize;
      const snapTop = Math.round(minY / gridSize) * gridSize;

      if (Math.abs(snapLeft - minX) < snapThreshold) {
          snapX = snapLeft - minX;
      }
      if (Math.abs(snapTop - minY) < snapThreshold) {
          snapY = snapTop - minY;
      }
  }

  // 2. Object Snapping (High priority, overwrites grid)
  if (snapToObjects) {
      const xCandidates = [minX, centerX, maxX];
      const yCandidates = [minY, centerY, maxY];

      let minDistX = snapThreshold;
      let minDistY = snapThreshold;

      let bestGuideX: SmartGuide | null = null;
      let bestGuideY: SmartGuide | null = null;

      // ---- ALIGNMENT SNAPPING ----
      for (const b of candidates) {
          const targetsX = [b.minX, b.centerX, b.maxX];
          const targetsY = [b.minY, b.centerY, b.maxY];

          // Check X Alignment
          for (const cand of xCandidates) {
              for (const target of targetsX) {
                 const dist = target - cand;
                 const absDist = Math.abs(dist);
                 if (absDist < minDistX) {
                       minDistX = absDist;
                       snapX = dist;

                       const mergedMinY = Math.min(minY, b.minY);
                       const mergedMaxY = Math.max(maxY, b.maxY);
                       bestGuideX = {
                           type: "x",
                           x: target,
                           y1: mergedMinY,
                           y2: mergedMaxY
                       };
                 }
              }
          }

          // Check Y Alignment
          for (const cand of yCandidates) {
              for (const target of targetsY) {
                  const dist = target - cand;
                   const absDist = Math.abs(dist);
                   if (absDist < minDistY) {
                       minDistY = absDist;
                       snapY = dist;

                       const mergedMinX = Math.min(minX, b.minX);
                       const mergedMaxX = Math.max(maxX, b.maxX);
                       bestGuideY = {
                           type: "y",
                           y: target,
                           x1: mergedMinX,
                           x2: mergedMaxX
                       };
                   }
              }
          }
      }

      // ---- GAP SNAPPING (X Axis) ----
      // Check if we are equidistant between two other objects horizontally
      // Or if we are creating an equal gap relative to one neighbor equal to that neighbor's gap to another.
      // Simplest Use Case: A [gap] B [gap] C(dragged)
      // Check gaps between candidates first? No, we need to find if [C] matches a gap.

      // Strategy:
      // 1. Find the nearest neighbor to the left/right.
      // 2. Calculate that gap.
      // 3. See if there's another pair with that same gap, OR if the neighbor has another neighbor with that same gap.

      // Simplified Figma-like distribution:
      // Look for candidates that are "in line" vertically (intersecting Y ranges).
      // Calculate distances between their centers or edges? Figma uses edges (gap).

      // Let's implement "Equal Spacing" detection against immediate neighbors.
      // Case 1: [A] ... [B] ... MyObject (equidistant)
      // Case 2: MyObject ... [A] ... [B] (equidistant)
      // Case 3: [A] ... MyObject ... [B] (equidistant)

      // We only run this if we haven't found a stronger alignment snap or maybe concurrently?
      // Usually gap snapping is separate. Let's prioritize alignment for now, or just add gap guides if we find a gap snap that is within threshold.

      // Optimization: Only check candidates that overlap in Y (for X gaps) or X (for Y gaps).
      const draggedHeight = maxY - minY;
      const draggedWidth = maxX - minX;

      // X-Axis Gaps
      // Filter candidates that overlap in Y
      const candidatesInY = candidates.filter(c => c.maxY > minY && c.minY < maxY);
      // Sort by X pos
      candidatesInY.sort((a, b) => a.minX - b.minX);

      // We need to fit `projectedBounds` (shifted by snapX if any) into this sorted list
      // But we don't know final snapX yet.
      // Let's assume we use the current projected position (with grid snap or 0).

      const pMinX = minX + snapX;
      const pMaxX = maxX + snapX;

      // Find closest left and right neighbors
      let leftNeighbor: Bounds | null = null;
      let rightNeighbor: Bounds | null = null;

      // Iterate to find neighbors
      for (const c of candidatesInY) {
          if (c.maxX < pMinX) leftNeighbor = c; // Updates to closer and closer left neighbor
          if (c.minX > pMaxX && !rightNeighbor) { rightNeighbor = c; break; } // First one to the right
      }

      // Case 1: Equal Distribution: LeftNeighbor ... (Gap) ... Me ... (Gap) ... RightNeighbor
      if (leftNeighbor && rightNeighbor) {
          const gapLeft = pMinX - leftNeighbor.maxX;
          const gapRight = rightNeighbor.minX - pMaxX;

          // Check difference
          const diff = gapRight - gapLeft;
          if (Math.abs(diff) < snapThreshold * 2) { // slightly looser or same threshold
              // Snap to make gaps equal
              // We want gapLeft == gapRight
              // (x - L.maxX) = (R.minX - (x + width))
              // x - L.max = R.min - x - width
              // 2x = R.min + L.max - width
              // x = (R.min + L.max - width) / 2
              const targetX = (rightNeighbor.minX + leftNeighbor.maxX - draggedWidth) / 2;
              const snapDiff = targetX - minX;

              if (Math.abs(snapDiff) < snapThreshold) {
                  // Prefer this snap? Or combine with alignment?
                  // Usually distribution snap is distinct. slightly prioritize or overwrite if close.
                  if (Math.abs(snapDiff) <= minDistX) {
                       snapX = snapDiff;
                       minDistX = Math.abs(snapDiff);
                       // Add guides
                       // Gap Guide Left
                       guides.push({
                           type: "distance",
                           x1: leftNeighbor.maxX,
                           y1: (minY + maxY) / 2,
                           x2: pMinX,
                           y2: (minY + maxY) / 2,
                           label: Math.round(gapLeft).toString()
                       });
                       // Gap Guide Right
                       guides.push({
                           type: "distance",
                           x1: pMaxX,
                           y1: (minY + maxY) / 2,
                           x2: rightNeighbor.minX,
                           y2: (minY + maxY) / 2,
                           label: Math.round(gapRight).toString()
                       });
                  }
              }
          }
      }

      // Y-Axis Gaps
      const candidatesInX = candidates.filter(c => c.maxX > minX && c.minX < maxX);
      candidatesInX.sort((a, b) => a.minY - b.minY);

      const pMinY = minY + snapY;
      const pMaxY = maxY + snapY;

      let topNeighbor: Bounds | null = null;
      let bottomNeighbor: Bounds | null = null;

      for (const c of candidatesInX) {
          if (c.maxY < pMinY) topNeighbor = c;
          if (c.minY > pMaxY && !bottomNeighbor) { bottomNeighbor = c; break; }
      }

      if (topNeighbor && bottomNeighbor) {
          const gapTop = pMinY - topNeighbor.maxY;
          const gapBottom = bottomNeighbor.minY - pMaxY;

          const diff = gapBottom - gapTop;
          if (Math.abs(diff) < snapThreshold * 2) {
               const targetY = (bottomNeighbor.minY + topNeighbor.maxY - draggedHeight) / 2;
               const snapDiff = targetY - minY;

               if (Math.abs(snapDiff) <= minDistY) { // Prioritize or combine
                   snapY = snapDiff;
                   minDistY = Math.abs(snapDiff);
                   const finalGap = (bottomNeighbor.minY - (targetY + draggedHeight));

                   guides.push({
                       type: "distance",
                       x: (minX + maxX) / 2,
                       y: topNeighbor.maxY,
                       x1: (minX + maxX) / 2, // Used for drawing the line vertical?
                       y1: topNeighbor.maxY,
                       y2: targetY, // Start of dragged
                       label: Math.round(finalGap).toString()
                   });
                   guides.push({
                       type: "distance",
                       x: (minX + maxX) / 2,
                       y: targetY + draggedHeight, // End of dragged
                       y1: targetY + draggedHeight,
                       y2: bottomNeighbor.minY,
                       label: Math.round(finalGap).toString()
                   });
               }
          }
      }

      if (bestGuideX) guides.push(bestGuideX);
      if (bestGuideY) guides.push(bestGuideY);
  }

  // 3. Geometry Snapping (Points)
  if (snapToGeometry && candidatePoints.length > 0) {
      // Check dragging bounds corners/center against candidate points
      const myPoints = [
          { x: minX, y: minY }, { x: maxX, y: minY },
          { x: maxX, y: maxY }, { x: minX, y: maxY },
          { x: centerX, y: centerY }
      ];

      // We want to snap 'myPoints' to 'candidatePoints'
      // This is a 2D point snap, effectively.

      let bestPointDist = snapThreshold;
      let snapPointX = 0;
      let snapPointY = 0;

      for (const myP of myPoints) {
          // Adjust myP by current snapX/snapY (accumulated from object/grid snap) ??
          // Ideally, geometry snap is very precise. If we find a vertex snap, it might override alignment snap.
          // Let's check "raw" myP first.

          for (const otherP of candidatePoints) {
              const dx = otherP.x - myP.x;
              const dy = otherP.y - myP.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist < bestPointDist) {
                  bestPointDist = dist;
                  // If we snap to point, we snap both X and Y usually
                  snapPointX = dx;
                  snapPointY = dy;

                  // For UI, we can show a small circle or cross at the snap point
                  // We'll reuse 'x' and 'y' types for now or add a 'point' type?
                  // Let's rely on X/Y guides intersecting at the point.
                  // For UI, we can show a small circle or cross at the snap point
                  // We'll reuse 'x' and 'y' types for now or add a 'point' type?
                  // Let's rely on X/Y guides intersecting at the point.
                  // Actually, let's just use standard guides intersecting
                  // Actually, let's just use standard guides intersecting
              }
          }
      }

      if (bestPointDist < snapThreshold) {
           // Overwrite or Refine?
           // If we have a point snap, it's usually intended.
           snapX = snapPointX;
           snapY = snapPointY;

           // Ideally we draw a guide at the target point.
           // For now, let's leave visual guides for geometry simple (maybe just the snap feeling)
           // or add X/Y guides at the target location.
      }
  }

  return {
    x: snapX,
    y: snapY,
    guides
  };
}
