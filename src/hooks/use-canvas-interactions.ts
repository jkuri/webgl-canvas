import { useCallback, useMemo, useRef } from "react";
import { calculateBoundingBox, hitTestBoundsHandle, hitTestRotatedElementHandle } from "@/core";
import { useCanvasStore } from "@/store";
import type { BoundingBox, CanvasElement, ResizeHandle, Shape } from "@/types";

// Generate Figma-style SVG cursor for resize handles with rotation
function createRotatedResizeCursor(angle: number): string {
  // Normalize angle to 0-360
  const normalizedAngle = ((angle % 360) + 360) % 360;

  // Smaller resize cursor (20x20)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><g transform="rotate(${normalizedAngle} 10 10)"><path d="M3 3L7 3L7 5L5 5L5 7L3 7Z" fill="#fff"/><path d="M17 17L13 17L13 15L15 15L15 13L17 13Z" fill="#fff"/><path d="M5 5L15 15" stroke="#fff" stroke-width="2.5"/><path d="M3 3L7 3L7 5L5 5L5 7L3 7Z" fill="#000"/><path d="M17 17L13 17L13 15L15 15L15 13L17 13Z" fill="#000"/><path d="M5 5L15 15" stroke="#000" stroke-width="1.2"/></g></svg>`;

  // Use base64 encoding for better browser compatibility
  const base64 = btoa(svg);
  return `url("data:image/svg+xml;base64,${base64}") 10 10, auto`;
}

// Generate Figma-style rotation cursor (curved arrow) with rotation
function createRotationCursor(angle: number): string {
  const normalizedAngle = ((angle % 360) + 360) % 360;

  // Professional rotation cursor (24x24) - clean curved arrow with proper arrowheads
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g transform="rotate(${normalizedAngle} 12 12)"><path d="M12 5C8.13 5 5 8.13 5 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M12 5C8.13 5 5 8.13 5 12" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M12 2L15 5L12 8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 2L15 5L12 8" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L5 15L8 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L5 15L8 12" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

  const base64 = btoa(svg);
  return `url("data:image/svg+xml;base64,${base64}") 12 12, auto`;
}

// Get rotation cursor for a specific corner handle
function getRotatedRotationCursor(handle: ResizeHandle, shapeRotation: number): string {
  // Only corner handles can rotate
  const cornerAngles: Record<string, number> = {
    nw: 0,
    ne: 90,
    se: 180,
    sw: 270,
  };

  if (!handle || !(handle in cornerAngles)) {
    // Default rotation cursor for non-corner or when no handle
    const rotationDegrees = (shapeRotation * 180) / Math.PI;
    const roundedAngle = Math.round(rotationDegrees / 5) * 5;
    const cacheKey = `rotate-${roundedAngle}`;
    if (!cursorCache.has(cacheKey)) {
      cursorCache.set(cacheKey, createRotationCursor(roundedAngle));
    }
    return cursorCache.get(cacheKey)!;
  }

  const baseAngle = cornerAngles[handle];
  const rotationDegrees = (shapeRotation * 180) / Math.PI;
  const finalAngle = baseAngle + rotationDegrees;
  const roundedAngle = Math.round(finalAngle / 5) * 5;
  const cacheKey = `rotate-${roundedAngle}`;

  if (!cursorCache.has(cacheKey)) {
    cursorCache.set(cacheKey, createRotationCursor(roundedAngle));
  }

  return cursorCache.get(cacheKey)!;
}

// Cache for cursor URLs to avoid regenerating
const cursorCache = new Map<string, string>();

function getRotatedCursor(handle: ResizeHandle, rotation: number): string {
  if (!handle) return "default";

  const baseAngles: Record<string, number> = {
    nw: 0,
    se: 0,
    ne: 90,
    sw: 90,
    n: 45,
    s: 45,
    e: -45,
    w: -45,
  };

  const baseAngle = baseAngles[handle] ?? 0;
  const rotationDegrees = (rotation * 180) / Math.PI;
  const finalAngle = baseAngle + rotationDegrees;

  // Round to nearest 5 degrees for caching
  const roundedAngle = Math.round(finalAngle / 5) * 5;
  const cacheKey = `resize-${roundedAngle}`;

  if (!cursorCache.has(cacheKey)) {
    cursorCache.set(cacheKey, createRotatedResizeCursor(roundedAngle));
  }

  return cursorCache.get(cacheKey)!;
}

// Helper to get bounds for any element type
function getElementBoundsLocal(element: CanvasElement): { x: number; y: number; width: number; height: number } {
  switch (element.type) {
    case "rect":
      return { x: element.x, y: element.y, width: element.width, height: element.height };
    case "ellipse":
      return {
        x: element.cx - element.rx,
        y: element.cy - element.ry,
        width: element.rx * 2,
        height: element.ry * 2,
      };
    case "line": {
      const minX = Math.min(element.x1, element.x2);
      const minY = Math.min(element.y1, element.y2);
      return {
        x: minX,
        y: minY,
        width: Math.abs(element.x2 - element.x1),
        height: Math.abs(element.y2 - element.y1),
      };
    }
    case "path":
      return element.bounds;
    case "group":
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

interface UseCanvasInteractionsProps {
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  hitTest: (worldX: number, worldY: number) => CanvasElement | null;
  hitTestResizeHandle: (worldX: number, worldY: number, element: CanvasElement) => ResizeHandle;
  handlers: {
    startPan: (e: MouseEvent) => void;
    updatePan: (e: MouseEvent) => void;
  };
  actions: {
    zoomIn: () => void;
    zoomOut: () => void;
  };
}

export function useCanvasInteractions({
  screenToWorld,
  hitTest,
  hitTestResizeHandle,
  handlers,
  actions,
}: UseCanvasInteractionsProps) {
  const {
    activeTool,
    isSpaceHeld,
    isPanning,
    isDragging,
    isResizing,
    isRotating,
    isMarqueeSelecting,
    selectedIds,
    hoveredHandle,
    transform,
    elements,
    setIsPanning,
    setIsDragging,
    setIsResizing,
    setIsRotating,
    setIsMarqueeSelecting,
    setSelectedIds,
    setHoveredHandle,
    setContextMenuTarget,
    setSelectionBox,
    getElementById,
    updateElement,
  } = useCanvasStore();

  const dragStartRef = useRef<{
    worldX: number;
    worldY: number;
    elements: Map<
      string,
      { x: number; y: number; cx?: number; cy?: number; x1?: number; y1?: number; x2?: number; y2?: number }
    >;
  } | null>(null);

  const resizeStartRef = useRef<{
    worldX: number;
    worldY: number;
    handle: ResizeHandle;
    originalBounds: BoundingBox;
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
      }
    >;
    isSingleRotatedElement: boolean;
    elementRotation: number;
  } | null>(null);

  const rotateStartRef = useRef<{
    startAngle: number;
    centerX: number;
    centerY: number;
    originalRotations: Map<string, number>;
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
      }
    >;
    handle: ResizeHandle;
  } | null>(null);

  const marqueeStartRef = useRef<{ worldX: number; worldY: number } | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Get the rotation of the currently selected element(s) for cursor
  const selectedRotation = useMemo(() => {
    if (selectedIds.length === 1) {
      const element = elements.find((e) => e.id === selectedIds[0]);
      return element?.rotation ?? 0;
    }
    return 0;
  }, [selectedIds, elements]);

  const getCursorForHandle = useCallback(
    (handle: ResizeHandle): string => {
      if (!handle) return "default";

      // Special case for line endpoints - use move cursor
      if (selectedIds.length === 1) {
        const element = elements.find((e) => e.id === selectedIds[0]);
        if (element?.type === "line" && (handle === "nw" || handle === "se")) {
          return "move";
        }
      }

      return getRotatedCursor(handle, selectedRotation);
    },
    [selectedRotation, selectedIds, elements],
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      const shouldPan = activeTool === "pan" || e.button === 1 || (e.button === 0 && isSpaceHeld);

      if (shouldPan) {
        e.preventDefault();
        setIsPanning(true);
        handlers.startPan(e);
        return;
      }

      if (activeTool === "select" && e.button === 0) {
        const world = screenToWorld(e.clientX, e.clientY);

        // Check for rotation mode (Cmd/Ctrl + click on corner handles)
        if ((e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
          const selectedElements = selectedIds.map((id) => getElementById(id)).filter(Boolean) as CanvasElement[];

          // Don't allow rotation if any selected element is locked
          if (selectedElements.some((e) => e.locked)) {
            return;
          }

          // Check if clicking on a corner handle
          let clickedHandle: ResizeHandle = null;
          if (selectedElements.length === 1 && selectedElements[0].type !== "group") {
            clickedHandle = hitTestRotatedElementHandle(
              world.x,
              world.y,
              selectedElements[0] as Shape,
              transform.scale,
            );
          } else {
            const bounds = calculateBoundingBox(selectedElements);
            if (bounds) {
              clickedHandle = hitTestBoundsHandle(world.x, world.y, bounds, transform.scale);
            }
          }

          // Only allow rotation from corner handles
          const isCorner =
            clickedHandle === "nw" || clickedHandle === "ne" || clickedHandle === "se" || clickedHandle === "sw";
          if (isCorner) {
            const bounds = calculateBoundingBox(selectedElements);
            if (bounds) {
              const centerX = bounds.x + bounds.width / 2;
              const centerY = bounds.y + bounds.height / 2;
              const startAngle = Math.atan2(world.y - centerY, world.x - centerX);
              const originalRotations = new Map<string, number>();
              const originalElements = new Map<
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
                }
              >();

              for (const element of selectedElements) {
                originalRotations.set(element.id, element.rotation);
                const eBounds = getElementBoundsLocal(element);
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
                }
                originalElements.set(element.id, entry);
              }
              setIsRotating(true);
              rotateStartRef.current = {
                startAngle,
                centerX,
                centerY,
                originalRotations,
                originalElements,
                handle: clickedHandle,
              };
              return;
            }
          }
        }

        // Check resize handle first
        if (selectedIds.length > 0) {
          const selectedElements = selectedIds.map((id) => getElementById(id)).filter(Boolean) as CanvasElement[];

          // Don't allow resize if any selected element is locked
          const anyLocked = selectedElements.some((e) => e.locked);

          if (!anyLocked) {
            // For single element, use rotated handle hit test
            let handle: ResizeHandle = null;
            if (selectedElements.length === 1 && selectedElements[0].type !== "group") {
              handle = hitTestRotatedElementHandle(world.x, world.y, selectedElements[0] as Shape, transform.scale);
            } else {
              const bounds = calculateBoundingBox(selectedElements);
              if (bounds) {
                handle = hitTestBoundsHandle(world.x, world.y, bounds, transform.scale);
              }
            }

            if (handle) {
              const isSingleRotatedElement =
                selectedElements.length === 1 &&
                (selectedElements[0].rotation !== 0 || selectedElements[0].type === "line") &&
                selectedElements[0].type !== "group";
              const elementRotation = isSingleRotatedElement ? selectedElements[0].rotation : 0;

              // Get bounds for the element(s)
              const bounds = isSingleRotatedElement
                ? getElementBoundsLocal(selectedElements[0])
                : calculateBoundingBox(selectedElements);

              if (bounds) {
                setIsResizing(true, handle);
                const originalElements = new Map<
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
                  }
                >();
                for (const element of selectedElements) {
                  const eBounds = getElementBoundsLocal(element);
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
                  }
                  originalElements.set(element.id, entry);
                }
                resizeStartRef.current = {
                  worldX: world.x,
                  worldY: world.y,
                  handle,
                  originalBounds: bounds,
                  originalElements,
                  isSingleRotatedElement,
                  elementRotation,
                };
                return;
              }
            }
          }
        }

        const hit = hitTest(world.x, world.y);

        if (hit) {
          const isAlreadySelected = selectedIds.includes(hit.id);
          if (e.shiftKey) {
            setSelectedIds(isAlreadySelected ? selectedIds.filter((id) => id !== hit.id) : [...selectedIds, hit.id]);
          } else {
            if (!isAlreadySelected) setSelectedIds([hit.id]);

            // Check if any element to be dragged is locked
            const elementsToDrag = isAlreadySelected ? selectedIds : [hit.id];
            const anyLocked = elementsToDrag.some((id) => {
              const element = getElementById(id);
              return element?.locked;
            });

            if (!anyLocked) {
              setIsDragging(true);
              const elementsMap = new Map<
                string,
                { x: number; y: number; cx?: number; cy?: number; x1?: number; y1?: number; x2?: number; y2?: number }
              >();
              for (const id of elementsToDrag) {
                const element = getElementById(id);
                if (element) {
                  if (element.type === "rect") {
                    elementsMap.set(id, { x: element.x, y: element.y });
                  } else if (element.type === "ellipse") {
                    elementsMap.set(id, { x: 0, y: 0, cx: element.cx, cy: element.cy });
                  } else if (element.type === "line") {
                    elementsMap.set(id, { x: 0, y: 0, x1: element.x1, y1: element.y1, x2: element.x2, y2: element.y2 });
                  } else if (element.type === "path") {
                    elementsMap.set(id, { x: element.bounds.x, y: element.bounds.y });
                  }
                }
              }
              dragStartRef.current = { worldX: world.x, worldY: world.y, elements: elementsMap };
            }
          }
        } else {
          if (!e.shiftKey) setSelectedIds([]);
          setIsMarqueeSelecting(true);
          marqueeStartRef.current = { worldX: world.x, worldY: world.y };
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
          setSelectionBox({ startX: world.x, startY: world.y, endX: world.x, endY: world.y });
        }
      }
    },
    [
      activeTool,
      isSpaceHeld,
      handlers,
      actions,
      screenToWorld,
      selectedIds,
      hitTest,
      hitTestResizeHandle,
      getElementById,
      transform.scale,
      setIsPanning,
      setIsDragging,
      setIsResizing,
      setIsMarqueeSelecting,
      setSelectedIds,
      setSelectionBox,
      setIsRotating,
    ],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const world = screenToWorld(e.clientX, e.clientY);

      // Update hovered handle
      if (activeTool === "select" && !isPanning && !isDragging && !isResizing && !isMarqueeSelecting) {
        if (selectedIds.length > 0) {
          const selectedElements = selectedIds.map((id) => getElementById(id)).filter(Boolean) as CanvasElement[];

          let handle: ResizeHandle = null;
          if (selectedElements.length === 1 && selectedElements[0].type !== "group") {
            handle = hitTestRotatedElementHandle(world.x, world.y, selectedElements[0] as Shape, transform.scale);
          } else {
            const bounds = calculateBoundingBox(selectedElements);
            if (bounds) {
              handle = hitTestBoundsHandle(world.x, world.y, bounds, transform.scale);
            }
          }
          setHoveredHandle(handle);
        } else {
          setHoveredHandle(null);
        }
      }

      if (isPanning) {
        handlers.updatePan(e);
        return;
      }

      if (isDragging && dragStartRef.current) {
        const deltaX = world.x - dragStartRef.current.worldX;
        const deltaY = world.y - dragStartRef.current.worldY;
        for (const [id, startPos] of dragStartRef.current.elements) {
          const element = getElementById(id);
          if (!element) continue;

          if (element.type === "rect") {
            updateElement(id, { x: startPos.x + deltaX, y: startPos.y + deltaY });
          } else if (element.type === "ellipse") {
            updateElement(id, { cx: (startPos.cx ?? 0) + deltaX, cy: (startPos.cy ?? 0) + deltaY });
          } else if (element.type === "line") {
            updateElement(id, {
              x1: (startPos.x1 ?? 0) + deltaX,
              y1: (startPos.y1 ?? 0) + deltaY,
              x2: (startPos.x2 ?? 0) + deltaX,
              y2: (startPos.y2 ?? 0) + deltaY,
            });
          } else if (element.type === "path") {
            updateElement(id, {
              bounds: {
                ...element.bounds,
                x: startPos.x + deltaX,
                y: startPos.y + deltaY,
              },
            });
          }
        }
      }

      if (isResizing && resizeStartRef.current) {
        const {
          handle,
          originalBounds,
          worldX: startX,
          worldY: startY,
          originalElements,
          isSingleRotatedElement,
          elementRotation,
        } = resizeStartRef.current;

        const deltaX = world.x - startX;
        const deltaY = world.y - startY;

        // For now, only support resize for rect elements (most common case)
        // TODO: Add proper ellipse and line resize support
        if (isSingleRotatedElement && originalElements.size === 1) {
          const [id, original] = [...originalElements.entries()][0];

          if (original.type === "rect") {
            const cos = Math.cos(elementRotation);
            const sin = Math.sin(elementRotation);
            const cosNeg = Math.cos(-elementRotation);
            const sinNeg = Math.sin(-elementRotation);

            const localDeltaX = deltaX * cosNeg - deltaY * sinNeg;
            const localDeltaY = deltaX * sinNeg + deltaY * cosNeg;

            let newWidth = original.width;
            let newHeight = original.height;
            let anchorLocalX = 0;
            let anchorLocalY = 0;

            if (handle?.includes("e")) {
              newWidth = original.width + localDeltaX;
              anchorLocalX = original.x;
            } else if (handle?.includes("w")) {
              newWidth = original.width - localDeltaX;
              anchorLocalX = original.x + original.width;
            } else {
              anchorLocalX = original.x + original.width / 2;
            }

            if (handle?.includes("s")) {
              newHeight = original.height + localDeltaY;
              anchorLocalY = original.y;
            } else if (handle?.includes("n")) {
              newHeight = original.height - localDeltaY;
              anchorLocalY = original.y + original.height;
            } else {
              anchorLocalY = original.y + original.height / 2;
            }

            const minSize = 20;
            newWidth = Math.max(minSize, newWidth);
            newHeight = Math.max(minSize, newHeight);

            const origCenterX = original.x + original.width / 2;
            const origCenterY = original.y + original.height / 2;
            const anchorOffsetX = anchorLocalX - origCenterX;
            const anchorOffsetY = anchorLocalY - origCenterY;
            const anchorWorldX = origCenterX + anchorOffsetX * cos - anchorOffsetY * sin;
            const anchorWorldY = origCenterY + anchorOffsetX * sin + anchorOffsetY * cos;

            let finalAnchorOffsetX = 0;
            let finalAnchorOffsetY = 0;
            if (handle?.includes("w")) {
              finalAnchorOffsetX = newWidth / 2;
            } else if (handle?.includes("e")) {
              finalAnchorOffsetX = -newWidth / 2;
            }
            if (handle?.includes("n")) {
              finalAnchorOffsetY = newHeight / 2;
            } else if (handle?.includes("s")) {
              finalAnchorOffsetY = -newHeight / 2;
            }

            const newCenterWorldX = anchorWorldX - (finalAnchorOffsetX * cos - finalAnchorOffsetY * sin);
            const newCenterWorldY = anchorWorldY - (finalAnchorOffsetX * sin + finalAnchorOffsetY * cos);

            const finalX = newCenterWorldX - newWidth / 2;
            const finalY = newCenterWorldY - newHeight / 2;

            updateElement(id, {
              x: finalX,
              y: finalY,
              width: newWidth,
              height: newHeight,
            });
          } else if (original.type === "line") {
            const currentX1 = original.x1 ?? 0;
            const currentY1 = original.y1 ?? 0;
            const currentX2 = original.x2 ?? 0;
            const currentY2 = original.y2 ?? 0;

            if (handle === "nw") {
              // Start point
              updateElement(id, {
                x1: currentX1 + deltaX,
                y1: currentY1 + deltaY,
              });
            } else if (handle === "se") {
              // End point
              updateElement(id, {
                x2: currentX2 + deltaX,
                y2: currentY2 + deltaY,
              });
            }
          }
        } else {
          // Non-rotated or multi-select: use original axis-aligned logic
          let newBoundsX = originalBounds.x;
          let newBoundsY = originalBounds.y;
          let newBoundsWidth = originalBounds.width;
          let newBoundsHeight = originalBounds.height;

          if (handle?.includes("w")) {
            newBoundsX = originalBounds.x + deltaX;
            newBoundsWidth = originalBounds.width - deltaX;
          }
          if (handle?.includes("e")) {
            newBoundsWidth = originalBounds.width + deltaX;
          }
          if (handle?.includes("n")) {
            newBoundsY = originalBounds.y + deltaY;
            newBoundsHeight = originalBounds.height - deltaY;
          }
          if (handle?.includes("s")) {
            newBoundsHeight = originalBounds.height + deltaY;
          }

          const minSize = 20;
          if (newBoundsWidth < minSize) {
            if (handle?.includes("w")) newBoundsX = originalBounds.x + originalBounds.width - minSize;
            newBoundsWidth = minSize;
          }
          if (newBoundsHeight < minSize) {
            if (handle?.includes("n")) newBoundsY = originalBounds.y + originalBounds.height - minSize;
            newBoundsHeight = minSize;
          }

          for (const [id, original] of originalElements) {
            if (original.type !== "rect") continue; // Only resize rects for now

            const relX = (original.x - originalBounds.x) / originalBounds.width;
            const relY = (original.y - originalBounds.y) / originalBounds.height;
            const relW = original.width / originalBounds.width;
            const relH = original.height / originalBounds.height;

            updateElement(id, {
              x: newBoundsX + relX * newBoundsWidth,
              y: newBoundsY + relY * newBoundsHeight,
              width: Math.max(10, relW * newBoundsWidth),
              height: Math.max(10, relH * newBoundsHeight),
            });
          }
        }
      }

      if (isRotating && rotateStartRef.current) {
        const { startAngle, centerX, centerY, originalRotations, originalElements } = rotateStartRef.current;
        const currentAngle = Math.atan2(world.y - centerY, world.x - centerX);
        const deltaAngle = currentAngle - startAngle;

        for (const [id, original] of originalElements) {
          if (original.type === "line") {
            // Rotate line endpoints
            const cos = Math.cos(deltaAngle);
            const sin = Math.sin(deltaAngle);

            const rotatePoint = (x: number, y: number) => ({
              x: centerX + (x - centerX) * cos - (y - centerY) * sin,
              y: centerY + (x - centerX) * sin + (y - centerY) * cos,
            });

            const p1 = rotatePoint(original.x1!, original.y1!);
            const p2 = rotatePoint(original.x2!, original.y2!);

            updateElement(id, {
              x1: p1.x,
              y1: p1.y,
              x2: p2.x,
              y2: p2.y,
              rotation: original.rotation + deltaAngle, // Keep rotation property updated for logic/bounds
            });
          } else {
            // Standard rotation for other elements
            const originalRotation = originalRotations.get(id) ?? 0;
            updateElement(id, { rotation: originalRotation + deltaAngle });
          }
        }
      }

      if (isMarqueeSelecting && marqueeStartRef.current) {
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        setSelectionBox({
          startX: marqueeStartRef.current.worldX,
          startY: marqueeStartRef.current.worldY,
          endX: world.x,
          endY: world.y,
        });
      }
    },
    [
      activeTool,
      isPanning,
      isDragging,
      isResizing,
      isRotating,
      isMarqueeSelecting,
      selectedIds,
      handlers,
      screenToWorld,
      hitTestResizeHandle,
      getElementById,
      transform.scale,
      setHoveredHandle,
      updateElement,
      setSelectionBox,
    ],
  );

  const handleMouseUp = useCallback(
    (getElementsInBox: (box: { startX: number; startY: number; endX: number; endY: number }) => CanvasElement[]) => {
      if (isMarqueeSelecting && marqueeStartRef.current) {
        const world = screenToWorld(lastMousePosRef.current.x, lastMousePosRef.current.y);
        const boxElements = getElementsInBox({
          startX: marqueeStartRef.current.worldX,
          startY: marqueeStartRef.current.worldY,
          endX: world.x,
          endY: world.y,
        });
        if (boxElements.length > 0) {
          setSelectedIds([...new Set([...selectedIds, ...boxElements.map((e) => e.id)])]);
        }
        setSelectionBox(null);
      }
      setIsPanning(false);
      setIsDragging(false);
      setIsResizing(false);
      setIsRotating(false);
      setIsMarqueeSelecting(false);
      dragStartRef.current = null;
      resizeStartRef.current = null;
      rotateStartRef.current = null;
      marqueeStartRef.current = null;
    },
    [
      isMarqueeSelecting,
      screenToWorld,
      selectedIds,
      setIsPanning,
      setIsDragging,
      setIsResizing,
      setIsRotating,
      setIsMarqueeSelecting,
      setSelectedIds,
      setSelectionBox,
    ],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const world = screenToWorld(e.clientX, e.clientY);
      const hit = hitTest(world.x, world.y);
      setContextMenuTarget(hit);
      if (hit && !selectedIds.includes(hit.id)) setSelectedIds([hit.id]);
    },
    [screenToWorld, hitTest, selectedIds, setContextMenuTarget, setSelectedIds],
  );

  // Get rotation cursor based on hovered handle and element rotation
  const getRotationCursorForHandle = useCallback(
    (handle: ResizeHandle): string => {
      return getRotatedRotationCursor(handle, selectedRotation);
    },
    [selectedRotation],
  );

  // Get the handle that started the rotation (for cursor during rotation)
  const activeRotationHandle = isRotating ? (rotateStartRef.current?.handle ?? null) : null;

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
    getCursorForHandle,
    getRotationCursorForHandle,
    hoveredHandle,
    activeRotationHandle,
  };
}
