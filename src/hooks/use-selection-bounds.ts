import { useMemo } from "react";
import { calculateGroupOBB, getRotatedCorners } from "@/core";
import { useCanvasStore } from "@/store";
import type { CanvasElement, GroupElement, Shape } from "@/types";
import { getElementBounds } from "@/types";

export function useSelectionBounds() {
  const elements = useCanvasStore((s) => s.elements);
  const selectedIds = useCanvasStore((s) => s.selectedIds);

  return useMemo(() => {
    if (selectedIds.length === 0) return null;
    const selectedElements = elements.filter((e) => selectedIds.includes(e.id));
    if (selectedElements.length === 0) return null;

    const getAllShapes = (els: CanvasElement[]): CanvasElement[] => {
      const shapes: CanvasElement[] = [];
      for (const el of els) {
        if (el.type === "group") {
          const children = (el as GroupElement).childIds
            .map((id) => elements.find((e) => e.id === id))
            .filter(Boolean) as CanvasElement[];
          shapes.push(...getAllShapes(children));
        } else {
          shapes.push(el);
        }
      }
      return shapes;
    };

    const allShapes = getAllShapes(selectedElements);
    if (allShapes.length === 0) return null;

    if (selectedElements.length === 1 && selectedElements[0].type !== "group") {
      const element = selectedElements[0];
      if (element.type === "line") {
        const dx = element.x2 - element.x1;
        const dy = element.y2 - element.y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const cx = (element.x1 + element.x2) / 2;
        const cy = (element.y1 + element.y2) / 2;
        return {
          bounds: {
            x: cx - length / 2,
            y: cy,
            width: length,
            height: 0,
          },
          rotation: angle,
          isLine: true,
        };
      }

      if (element.type === "text") {
        if (element.bounds) {
          return {
            bounds: {
              x: element.x + element.bounds.x,
              y: element.y + element.bounds.y,
              width: element.bounds.width,
              height: element.bounds.height,
            },
            rotation: element.rotation,
            isLine: false,
          };
        }

        const textWidth = element.text.length * element.fontSize * 0.6;
        const textHeight = element.fontSize * 1.2;
        return {
          bounds: {
            x: element.x,
            y: element.y - textHeight,
            width: textWidth,
            height: textHeight,
          },
          rotation: element.rotation,
          isLine: false,
        };
      }

      const bounds = getElementBounds(element);
      return {
        bounds,
        rotation: element.rotation,
        isLine: false,
      };
    }

    if (selectedElements.length === 1 && selectedElements[0].type === "group") {
      const element = selectedElements[0] as GroupElement;
      const shapes = getAllShapes([element]) as Shape[];
      if (shapes.length === 0) return null;

      const obb = calculateGroupOBB(shapes, element.rotation);

      return {
        bounds: {
          x: obb.x,
          y: obb.y,
          width: obb.width,
          height: obb.height,
        },
        rotation: obb.rotation,
        isLine: false,
      };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const element of allShapes) {
      const corners = getRotatedCorners(element as Shape);
      for (const corner of corners) {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
      }
    }

    return {
      bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      rotation: 0,
      isLine: false,
    };
  }, [selectedIds, elements]);
}
