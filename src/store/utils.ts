import type { CanvasElement } from "@/types";

export function generateElementName(type: CanvasElement["type"], elements: CanvasElement[]): string {
  const prefix =
    type === "rect"
      ? "Rectangle"
      : type === "ellipse"
        ? "Ellipse"
        : type === "line"
          ? "Line"
          : type === "path"
            ? "Path"
            : type === "text"
              ? "Text"
              : type === "polygon"
                ? "Polygon"
                : type === "polyline"
                  ? "Polyline"
                  : type === "image"
                    ? "Image"
                    : "Group";
  const count = elements.filter((e) => e.type === type).length + 1;
  return `${prefix} ${count}`;
}

export const cloneElement = (element: CanvasElement, newId: string, offset: number = 20): CanvasElement => {
  const copy = { ...element, id: newId, name: `${element.name} Copy` };

  if (copy.type === "rect" || copy.type === "image" || copy.type === "text") {
    copy.x += offset;
    copy.y += offset;
  } else if (copy.type === "ellipse") {
    copy.cx += offset;
    copy.cy += offset;
  } else if (copy.type === "line") {
    copy.x1 += offset;
    copy.y1 += offset;
    copy.x2 += offset;
    copy.y2 += offset;
  } else if (copy.type === "path") {
    copy.bounds = {
      ...copy.bounds,
      x: copy.bounds.x + offset,
      y: copy.bounds.y + offset,
    };
  } else if (copy.type === "polygon" || copy.type === "polyline") {
    copy.points = copy.points.map((p) => ({ x: p.x + offset, y: p.y + offset }));
  }

  return copy;
};

export const getDescendants = (groupId: string, elements: CanvasElement[], collected: CanvasElement[] = []): CanvasElement[] => {
  const group = elements.find((e) => e.id === groupId);
  if (!group || group.type !== "group") return collected;

  for (const childId of group.childIds) {
    const child = elements.find((e) => e.id === childId);
    if (child) {
      collected.push(child);
      if (child.type === "group") {
        getDescendants(child.id, elements, collected);
      }
    }
  }
  return collected;
};

let elementIndexMap: Map<string, number> | null = null;
let lastElements: CanvasElement[] | null = null;

export function getElementIndex(elements: CanvasElement[], id: string): number {
  if (elements !== lastElements) {
    elementIndexMap = new Map();
    for (let i = 0; i < elements.length; i++) {
      elementIndexMap.set(elements[i].id, i);
    }
    lastElements = elements;
  }
  return elementIndexMap?.get(id) ?? -1;
}
