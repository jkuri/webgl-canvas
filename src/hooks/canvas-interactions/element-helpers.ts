import { createSnapState, type SnapState } from "@/core/snapping";
import type { CanvasElement } from "@/types";
import { getElementBounds } from "@/types";
import type { ElementData } from "./types";

export function flattenCanvasElements(
  elements: CanvasElement[],
  getElementById: (id: string) => CanvasElement | undefined,
): CanvasElement[] {
  const result: CanvasElement[] = [];

  const recurse = (els: CanvasElement[]) => {
    for (const el of els) {
      if (el.type === "group") {
        const children = el.childIds.map((id) => getElementById(id)).filter(Boolean) as CanvasElement[];
        recurse(children);
      } else {
        result.push(el);
      }
    }
  };
  recurse(elements);
  return result;
}

export function getDescendantIds(
  ids: string[],
  getElementById: (id: string) => CanvasElement | undefined,
): Set<string> {
  const descendants = new Set<string>();

  const collectDescendants = (elementIds: string[]) => {
    for (const id of elementIds) {
      descendants.add(id);
      const element = getElementById(id);
      if (element?.type === "group") {
        collectDescendants(element.childIds);
      }
    }
  };

  collectDescendants(ids);
  return descendants;
}

export function getSnapCandidatesAndPoints(elements: CanvasElement[], excludeIds: Set<string> | string): SnapState {
  const excludeSet = typeof excludeIds === "string" ? new Set([excludeIds]) : excludeIds;
  return createSnapState(elements, excludeSet);
}

export function collectElementsForResize(
  els: CanvasElement[],
  map: Map<string, ElementData>,
  getElementById: (id: string) => CanvasElement | undefined,
) {
  for (const element of els) {
    if (element.type === "group") {
      const entry: ElementData = {
        type: "group",
        rotation: element.rotation,
        childIds: element.childIds,
        aspectRatioLocked: element.aspectRatioLocked,
      };
      map.set(element.id, entry);

      const children = element.childIds.map((id) => getElementById(id)).filter(Boolean) as CanvasElement[];
      collectElementsForResize(children, map, getElementById);
    } else {
      const eBounds = getElementBounds(element);
      const entry: ElementData = {
        ...eBounds,
        rotation: element.rotation,
        type: element.type,
        cx: undefined,
        cy: undefined,
        rx: undefined,
        ry: undefined,
        x1: undefined,
        y1: undefined,
        x2: undefined,
        y2: undefined,
        d: undefined,
        bounds: undefined,
        parentId: element.parentId,
        aspectRatioLocked: element.aspectRatioLocked,
      };

      if (element.type === "ellipse") {
        entry.cx = element.cx;
        entry.cy = element.cy;
        entry.rx = element.rx;
        entry.ry = element.ry;
      } else if (element.type === "line") {
        entry.x1 = element.x1;
        entry.y1 = element.y1;
        entry.x2 = element.x2;
        entry.y2 = element.y2;
      } else if (element.type === "path") {
        entry.d = element.d;
        entry.bounds = element.bounds;
      } else if (element.type === "text") {
        entry.fontSize = element.fontSize;
        entry.text = element.text;
      } else if (element.type === "polygon" || element.type === "polyline") {
        entry.points = element.points;
      }

      map.set(element.id, entry);
    }
  }
}

export function collectElementsForRotation(
  els: CanvasElement[],
  originalRotations: Map<string, number>,
  originalElements: Map<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      type: string;
      cx?: number;
      cy?: number;
      rx?: number;
      ry?: number;
      x1?: number;
      y1?: number;
      x2?: number;
      y2?: number;
      d?: string;
      bounds?: { x: number; y: number; width: number; height: number };
      anchorX?: number;
      anchorY?: number;
    }
  >,
) {
  for (const element of els) {
    originalRotations.set(element.id, element.rotation);
    const eBounds = getElementBounds(element);
    const entry = {
      ...eBounds,
      rotation: element.rotation,
      type: element.type,
      cx: undefined as number | undefined,
      cy: undefined as number | undefined,
      rx: undefined as number | undefined,
      ry: undefined as number | undefined,
      x1: undefined as number | undefined,
      y1: undefined as number | undefined,
      x2: undefined as number | undefined,
      y2: undefined as number | undefined,
      d: undefined as string | undefined,
      bounds: undefined as { x: number; y: number; width: number; height: number } | undefined,
      anchorX: undefined as number | undefined,
      anchorY: undefined as number | undefined,
    };
    if (element.type === "ellipse") {
      entry.cx = element.cx;
      entry.cy = element.cy;
      entry.rx = element.rx;
      entry.ry = element.ry;
    } else if (element.type === "line") {
      entry.x1 = element.x1;
      entry.y1 = element.y1;
      entry.x2 = element.x2;
      entry.y2 = element.y2;
    } else if (element.type === "path") {
      entry.d = element.d;
      entry.bounds = element.bounds;
    } else if (element.type === "text") {
      entry.anchorX = element.x;
      entry.anchorY = element.y;
    }
    originalElements.set(element.id, entry);
  }
}

export function collectDraggableElements(
  ids: string[],
  map: Map<
    string,
    { x: number; y: number; cx?: number; cy?: number; x1?: number; y1?: number; x2?: number; y2?: number }
  >,
  getElementById: (id: string) => CanvasElement | undefined,
) {
  for (const id of ids) {
    const element = getElementById(id);
    if (!element) continue;

    if (element.type === "group") {
      collectDraggableElements(element.childIds, map, getElementById);
    } else {
      if (element.type === "rect" || element.type === "image") {
        map.set(id, { x: element.x, y: element.y });
      } else if (element.type === "ellipse") {
        map.set(id, { x: 0, y: 0, cx: element.cx, cy: element.cy });
      } else if (element.type === "line") {
        map.set(id, { x: 0, y: 0, x1: element.x1, y1: element.y1, x2: element.x2, y2: element.y2 });
      } else if (element.type === "path") {
        map.set(id, { x: element.bounds.x, y: element.bounds.y });
      } else if (element.type === "text") {
        map.set(id, { x: element.x, y: element.y });
      }
    }
  }
}

export function buildDragElementsMap(
  element: CanvasElement,
): Map<string, { x: number; y: number; cx?: number; cy?: number; x1?: number; y1?: number; x2?: number; y2?: number }> {
  const elementsMap = new Map<
    string,
    { x: number; y: number; cx?: number; cy?: number; x1?: number; y1?: number; x2?: number; y2?: number }
  >();

  if (element.type === "rect" || element.type === "image") {
    elementsMap.set(element.id, { x: element.x, y: element.y });
  } else if (element.type === "ellipse") {
    elementsMap.set(element.id, { x: 0, y: 0, cx: element.cx, cy: element.cy });
  } else if (element.type === "line") {
    elementsMap.set(element.id, {
      x: 0,
      y: 0,
      x1: element.x1,
      y1: element.y1,
      x2: element.x2,
      y2: element.y2,
    });
  } else if (element.type === "path") {
    elementsMap.set(element.id, { x: element.bounds.x, y: element.bounds.y });
  } else if (element.type === "text") {
    elementsMap.set(element.id, { x: element.x, y: element.y });
  }

  return elementsMap;
}
