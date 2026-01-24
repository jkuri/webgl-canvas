import { resizePath } from "@/lib/svg-import";
import type { CanvasElement, GroupElement } from "@/types";
import { getElementBounds } from "@/types";

export const getGroupBounds = (
  element: GroupElement,
  elements: CanvasElement[],
): { x: number; y: number; width: number; height: number } => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasChildren = false;

  const traverse = (ids: string[]) => {
    for (const id of ids) {
      const el = elements.find((e) => e.id === id);
      if (!el) continue;

      if (el.type === "group") {
        traverse(el.childIds);
      } else {
        hasChildren = true;
        const b = getElementBounds(el);
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      }
    }
  };

  traverse(element.childIds);

  if (!hasChildren) return { x: 0, y: 0, width: 0, height: 0 };

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

export const moveGroupChildren = (
  element: GroupElement,
  dx: number,
  dy: number,
  elements: CanvasElement[],
): Map<string, Record<string, unknown>> => {
  const updates = new Map<string, Record<string, unknown>>();

  const traverse = (ids: string[]) => {
    for (const id of ids) {
      const el = elements.find((e) => e.id === id);
      if (!el) continue;

      if (el.type === "group") {
        traverse(el.childIds);
      } else {
        if (el.type === "rect" || el.type === "image" || el.type === "text") {
          updates.set(id, { x: el.x + dx, y: el.y + dy });
        } else if (el.type === "ellipse") {
          updates.set(id, { cx: el.cx + dx, cy: el.cy + dy });
        } else if (el.type === "line") {
          updates.set(id, { x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy });
        } else if (el.type === "path") {
          updates.set(id, { bounds: { ...el.bounds, x: el.bounds.x + dx, y: el.bounds.y + dy } });
        } else if (el.type === "polygon" || el.type === "polyline") {
          updates.set(id, { points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) });
        }
      }
    }
  };

  traverse(element.childIds);
  return updates;
};

export const resizeElementInGroup = (
  el: CanvasElement,
  oldB: { x: number; y: number; width: number; height: number },
  newB: { x: number; y: number; width: number; height: number },
  updates: Map<string, Record<string, unknown>>,
) => {
  if (el.type === "rect" || el.type === "image") {
    const x = newB.x + ((el.x - oldB.x) / oldB.width) * newB.width;
    const y = newB.y + ((el.y - oldB.y) / oldB.height) * newB.height;
    updates.set(el.id, {
      x,
      y,
      width: (el.width / oldB.width) * newB.width,
      height: (el.height / oldB.height) * newB.height,
    });
  } else if (el.type === "ellipse") {
    const relCx = (el.cx - oldB.x) / oldB.width;
    const relCy = (el.cy - oldB.y) / oldB.height;

    updates.set(el.id, {
      cx: newB.x + relCx * newB.width,
      cy: newB.y + relCy * newB.height,
      rx: (el.rx / oldB.width) * newB.width,
      ry: (el.ry / oldB.height) * newB.height,
    });
  } else if (el.type === "text") {
    const x = newB.x + ((el.x - oldB.x) / oldB.width) * newB.width;
    const y = newB.y + ((el.y - oldB.y) / oldB.height) * newB.height;

    const scaleX = newB.width / oldB.width;
    const scaleY = newB.height / oldB.height;
    const avgScale = (scaleX + scaleY) / 2;

    updates.set(el.id, { x, y, fontSize: el.fontSize * avgScale });
  } else if (el.type === "line") {
    const relX1 = (el.x1 - oldB.x) / oldB.width;
    const relY1 = (el.y1 - oldB.y) / oldB.height;
    const relX2 = (el.x2 - oldB.x) / oldB.width;
    const relY2 = (el.y2 - oldB.y) / oldB.height;

    updates.set(el.id, {
      x1: newB.x + relX1 * newB.width,
      y1: newB.y + relY1 * newB.height,
      x2: newB.x + relX2 * newB.width,
      y2: newB.y + relY2 * newB.height,
    });
  } else if (el.type === "path") {
    const pathOldBounds = el.bounds;

    const relX = (pathOldBounds.x - oldB.x) / oldB.width;
    const relY = (pathOldBounds.y - oldB.y) / oldB.height;
    const relW = pathOldBounds.width / oldB.width;
    const relH = pathOldBounds.height / oldB.height;

    const pathNewBounds = {
      x: newB.x + relX * newB.width,
      y: newB.y + relY * newB.height,
      width: relW * newB.width,
      height: relH * newB.height,
    };

    const newD = resizePath(el.d, pathOldBounds, pathNewBounds);

    updates.set(el.id, {
      d: newD,
      bounds: pathNewBounds,
    });
  } else if (el.type === "polygon" || el.type === "polyline") {
    const newPoints = el.points.map((p) => ({
      x: newB.x + ((p.x - oldB.x) / oldB.width) * newB.width,
      y: newB.y + ((p.y - oldB.y) / oldB.height) * newB.height,
    }));
    updates.set(el.id, { points: newPoints });
  }
};

export const rotateGroupChildren = (
  element: GroupElement,
  deltaRotation: number,
  groupCenterX: number,
  groupCenterY: number,
  elements: CanvasElement[],
): Map<string, Record<string, unknown>> => {
  const updates = new Map<string, Record<string, unknown>>();

  const cos = Math.cos(deltaRotation);
  const sin = Math.sin(deltaRotation);

  const traverse = (ids: string[]) => {
    for (const id of ids) {
      const el = elements.find((e) => e.id === id);
      if (!el) continue;

      if (el.type === "group") {
        traverse(el.childIds);
      } else {
        const elUpdate: Record<string, unknown> = {};

        if (el.type === "line") {
          const dx1 = el.x1 - groupCenterX;
          const dy1 = el.y1 - groupCenterY;
          const dx2 = el.x2 - groupCenterX;
          const dy2 = el.y2 - groupCenterY;

          elUpdate.x1 = groupCenterX + dx1 * cos - dy1 * sin;
          elUpdate.y1 = groupCenterY + dx1 * sin + dy1 * cos;
          elUpdate.x2 = groupCenterX + dx2 * cos - dy2 * sin;
          elUpdate.y2 = groupCenterY + dx2 * sin + dy2 * cos;
          elUpdate.rotation = el.rotation + deltaRotation;
        } else if (el.type === "ellipse") {
          const dcx = el.cx - groupCenterX;
          const dcy = el.cy - groupCenterY;
          elUpdate.cx = groupCenterX + dcx * cos - dcy * sin;
          elUpdate.cy = groupCenterY + dcx * sin + dcy * cos;
          elUpdate.rotation = el.rotation + deltaRotation;
        } else if (el.type === "path") {
          const b = el.bounds;
          const bCx = b.x + b.width / 2;
          const bCy = b.y + b.height / 2;

          const dbCx = bCx - groupCenterX;
          const dbCy = bCy - groupCenterY;

          const newBCx = groupCenterX + dbCx * cos - dbCy * sin;
          const newBCy = groupCenterY + dbCx * sin + dbCy * cos;

          const newBoundsX = newBCx - b.width / 2;
          const newBoundsY = newBCy - b.height / 2;

          elUpdate.bounds = { ...b, x: newBoundsX, y: newBoundsY };
          elUpdate.rotation = el.rotation + deltaRotation;
        } else if (el.type === "rect" || el.type === "image" || el.type === "text") {
          let w = 0;
          let h = 0;

          if (el.type === "text") {
            if (el.bounds) {
              w = el.bounds.width;
              h = el.bounds.height;
            } else {
              w = 0;
              h = 0;
            }
          } else {
            w = el.width;
            h = el.height;
          }

          const elCx = el.x + w / 2;
          const elCy = el.y + h / 2;

          const dCx = elCx - groupCenterX;
          const dCy = elCy - groupCenterY;

          const newCx = groupCenterX + dCx * cos - dCy * sin;
          const newCy = groupCenterY + dCx * sin + dCy * cos;

          elUpdate.x = newCx - w / 2;
          elUpdate.y = newCy - h / 2;
          elUpdate.rotation = el.rotation + deltaRotation;
        }

        updates.set(el.id, elUpdate);
      }
    }
  };

  traverse(element.childIds);
  return updates;
};

export const resizeGroupChildrenOBB = (
  group: GroupElement,
  startOBB: { x: number; y: number; width: number; height: number; rotation: number },
  endOBB: { x: number; y: number; width: number; height: number; rotation: number },
  originalElements: Map<string, CanvasElement>,
  updates: Map<string, Record<string, unknown>>,
) => {
  const scaleX = endOBB.width / startOBB.width;
  const scaleY = endOBB.height / startOBB.height;

  const startCenterX = startOBB.x + startOBB.width / 2;
  const startCenterY = startOBB.y + startOBB.height / 2;

  const endCenterX = endOBB.x + endOBB.width / 2;
  const endCenterY = endOBB.y + endOBB.height / 2;

  const cos = Math.cos(-startOBB.rotation);
  const sin = Math.sin(-startOBB.rotation);

  const cosEnd = Math.cos(endOBB.rotation);
  const sinEnd = Math.sin(endOBB.rotation);

  const traverse = (ids: string[]) => {
    for (const id of ids) {
      const el = originalElements.get(id);
      if (!el) continue;

      if (el.type === "group") {
        traverse(el.childIds);
      } else if (el.type === "rect" || el.type === "image" || el.type === "text") {
        let w = 0;
        let h = 0;

        if (el.type === "text" && el.bounds) {
          w = el.bounds.width;
          h = el.bounds.height;
        } else {
          if (el.type !== "text") {
            w = el.width;
            h = el.height;
          }
        }

        const elCx = el.x + w / 2;
        const elCy = el.y + h / 2;

        const dx = elCx - startCenterX;
        const dy = elCy - startCenterY;

        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        const scaledLocalX = localX * scaleX;
        const scaledLocalY = localY * scaleY;

        const finalCx = endCenterX + scaledLocalX * cosEnd - scaledLocalY * sinEnd;
        const finalCy = endCenterY + scaledLocalX * sinEnd + scaledLocalY * cosEnd;

        const newWidth = w * scaleX;
        const newHeight = h * scaleY;

        const update: Record<string, unknown> = {
          x: finalCx - newWidth / 2,
          y: finalCy - newHeight / 2,
        };

        if (el.type !== "text") {
          update.width = newWidth;
          update.height = newHeight;
        } else {
          update.fontSize = el.fontSize * ((scaleX + scaleY) / 2);
        }

        updates.set(id, update);
      } else if (el.type === "path") {
        const b = el.bounds;
        const elCx = b.x + b.width / 2;
        const elCy = b.y + b.height / 2;

        const dx = elCx - startCenterX;
        const dy = elCy - startCenterY;
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        const scaledLocalX = localX * scaleX;
        const scaledLocalY = localY * scaleY;

        const finalCx = endCenterX + scaledLocalX * cosEnd - scaledLocalY * sinEnd;
        const finalCy = endCenterY + scaledLocalX * sinEnd + scaledLocalY * cosEnd;

        const finalW = b.width * scaleX;
        const finalH = b.height * scaleY;

        const newBounds = {
          x: finalCx - finalW / 2,
          y: finalCy - finalH / 2,
          width: finalW,
          height: finalH,
        };

        const newD = resizePath(el.d, b, newBounds);
        updates.set(id, { d: newD, bounds: newBounds });
      }
    }
  };
  traverse(group.childIds);
};
