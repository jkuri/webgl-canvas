import { useCallback, useMemo, useRef } from "react";
import { calculateBoundingBox, hitTestBoundsHandle, hitTestRotatedShapeHandle } from "@/core";
import { useCanvasStore } from "@/store";
import type { BoundingBox, ResizeHandle, Shape } from "@/types";

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

  // Base angles for each handle direction
  // nwse handles (nw, se) = 0 degrees (diagonal from top-left to bottom-right)
  // nesw handles (ne, sw) = 90 degrees (diagonal from top-right to bottom-left)
  // ns handles (n, s) = 45 degrees (vertical)
  // ew handles (e, w) = -45 degrees (horizontal)
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

interface UseCanvasInteractionsProps {
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  hitTest: (worldX: number, worldY: number) => Shape | null;
  hitTestResizeHandle: (worldX: number, worldY: number, shape: Shape) => ResizeHandle;
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
    shapes,
    setIsPanning,
    setIsDragging,
    setIsResizing,
    setIsRotating,
    setIsMarqueeSelecting,
    setSelectedIds,
    setHoveredHandle,
    setContextMenuTarget,
    setSelectionBox,
    getShapeById,
    updateShape,
  } = useCanvasStore();

  const dragStartRef = useRef<{
    worldX: number;
    worldY: number;
    shapes: Map<string, { x: number; y: number }>;
  } | null>(null);

  const resizeStartRef = useRef<{
    worldX: number;
    worldY: number;
    handle: ResizeHandle;
    originalBounds: BoundingBox;
    originalShapes: Map<string, { x: number; y: number; width: number; height: number; rotation: number }>;
    isSingleRotatedShape: boolean;
    shapeRotation: number;
  } | null>(null);

  const rotateStartRef = useRef<{
    startAngle: number;
    centerX: number;
    centerY: number;
    originalRotations: Map<string, number>;
    handle: ResizeHandle;
  } | null>(null);

  const marqueeStartRef = useRef<{ worldX: number; worldY: number } | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Get the rotation of the currently selected shape(s) for cursor
  // Note: We depend on shapes array to ensure reactivity when rotation changes
  const selectedRotation = useMemo(() => {
    if (selectedIds.length === 1) {
      const shape = shapes.find((s) => s.id === selectedIds[0]);
      return shape?.rotation ?? 0;
    }
    return 0;
  }, [selectedIds, shapes]);

  const getCursorForHandle = useCallback(
    (handle: ResizeHandle): string => {
      if (!handle) return "default";
      // Always use custom rotated cursor (even when rotation is 0)
      return getRotatedCursor(handle, selectedRotation);
    },
    [selectedRotation],
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
          const selectedShapes = selectedIds.map((id) => getShapeById(id)).filter(Boolean) as Shape[];

          // Don't allow rotation if any selected shape is locked
          if (selectedShapes.some((s) => s.locked)) {
            return;
          }

          // Check if clicking on a corner handle
          let clickedHandle: ResizeHandle = null;
          if (selectedShapes.length === 1) {
            clickedHandle = hitTestRotatedShapeHandle(world.x, world.y, selectedShapes[0], transform.scale);
          } else {
            const bounds = calculateBoundingBox(selectedShapes);
            if (bounds) {
              clickedHandle = hitTestBoundsHandle(world.x, world.y, bounds, transform.scale);
            }
          }

          // Only allow rotation from corner handles
          const isCorner =
            clickedHandle === "nw" || clickedHandle === "ne" || clickedHandle === "se" || clickedHandle === "sw";
          if (isCorner) {
            const bounds = calculateBoundingBox(selectedShapes);
            if (bounds) {
              const centerX = bounds.x + bounds.width / 2;
              const centerY = bounds.y + bounds.height / 2;
              const startAngle = Math.atan2(world.y - centerY, world.x - centerX);
              const originalRotations = new Map<string, number>();
              for (const shape of selectedShapes) {
                originalRotations.set(shape.id, shape.rotation);
              }
              setIsRotating(true);
              rotateStartRef.current = { startAngle, centerX, centerY, originalRotations, handle: clickedHandle };
              return;
            }
          }
        }

        // Check resize handle first
        if (selectedIds.length > 0) {
          const selectedShapes = selectedIds.map((id) => getShapeById(id)).filter(Boolean) as Shape[];

          // Don't allow resize if any selected shape is locked
          const anyLocked = selectedShapes.some((s) => s.locked);

          if (!anyLocked) {
            // For single shape, use rotated handle hit test
            let handle: ResizeHandle = null;
            if (selectedShapes.length === 1) {
              handle = hitTestRotatedShapeHandle(world.x, world.y, selectedShapes[0], transform.scale);
            } else {
              const bounds = calculateBoundingBox(selectedShapes);
              if (bounds) {
                handle = hitTestBoundsHandle(world.x, world.y, bounds, transform.scale);
              }
            }

            if (handle) {
              const isSingleRotatedShape = selectedShapes.length === 1 && selectedShapes[0].rotation !== 0;
              const shapeRotation = isSingleRotatedShape ? selectedShapes[0].rotation : 0;

              // For single rotated shape, use unrotated bounds
              const bounds = isSingleRotatedShape
                ? {
                    x: selectedShapes[0].x,
                    y: selectedShapes[0].y,
                    width: selectedShapes[0].width,
                    height: selectedShapes[0].height,
                  }
                : calculateBoundingBox(selectedShapes);

              if (bounds) {
                setIsResizing(true, handle);
                const originalShapes = new Map<
                  string,
                  { x: number; y: number; width: number; height: number; rotation: number }
                >();
                for (const shape of selectedShapes) {
                  originalShapes.set(shape.id, {
                    x: shape.x,
                    y: shape.y,
                    width: shape.width,
                    height: shape.height,
                    rotation: shape.rotation,
                  });
                }
                resizeStartRef.current = {
                  worldX: world.x,
                  worldY: world.y,
                  handle,
                  originalBounds: bounds,
                  originalShapes,
                  isSingleRotatedShape,
                  shapeRotation,
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

            // Check if any shape to be dragged is locked
            const shapesToDrag = isAlreadySelected ? selectedIds : [hit.id];
            const anyLocked = shapesToDrag.some((id) => {
              const shape = getShapeById(id);
              return shape?.locked;
            });

            if (!anyLocked) {
              setIsDragging(true);
              const shapesMap = new Map<string, { x: number; y: number }>();
              for (const id of shapesToDrag) {
                const shape = getShapeById(id);
                if (shape) shapesMap.set(id, { x: shape.x, y: shape.y });
              }
              dragStartRef.current = { worldX: world.x, worldY: world.y, shapes: shapesMap };
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
      getShapeById,
      transform.scale,
      setIsPanning,
      setIsDragging,
      setIsResizing,
      setIsMarqueeSelecting,
      setSelectedIds,
      setSelectionBox,
    ],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const world = screenToWorld(e.clientX, e.clientY);

      // Update hovered handle
      if (activeTool === "select" && !isPanning && !isDragging && !isResizing && !isMarqueeSelecting) {
        if (selectedIds.length > 0) {
          const selectedShapes = selectedIds.map((id) => getShapeById(id)).filter(Boolean) as Shape[];

          let handle: ResizeHandle = null;
          if (selectedShapes.length === 1) {
            handle = hitTestRotatedShapeHandle(world.x, world.y, selectedShapes[0], transform.scale);
          } else {
            const bounds = calculateBoundingBox(selectedShapes);
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
        for (const [id, startPos] of dragStartRef.current.shapes) {
          updateShape(id, { x: startPos.x + deltaX, y: startPos.y + deltaY });
        }
      }

      if (isResizing && resizeStartRef.current) {
        const {
          handle,
          originalBounds,
          worldX: startX,
          worldY: startY,
          originalShapes,
          isSingleRotatedShape,
          shapeRotation,
        } = resizeStartRef.current;

        const deltaX = world.x - startX;
        const deltaY = world.y - startY;

        if (isSingleRotatedShape && originalShapes.size === 1) {
          // For single rotated shape, use anchor-based resize
          const [id, original] = [...originalShapes.entries()][0];
          const cos = Math.cos(shapeRotation);
          const sin = Math.sin(shapeRotation);
          const cosNeg = Math.cos(-shapeRotation);
          const sinNeg = Math.sin(-shapeRotation);

          // Transform delta to local space
          const localDeltaX = deltaX * cosNeg - deltaY * sinNeg;
          const localDeltaY = deltaX * sinNeg + deltaY * cosNeg;

          let newWidth = original.width;
          let newHeight = original.height;
          let anchorLocalX = 0;
          let anchorLocalY = 0;

          // Determine anchor point (opposite corner) and new dimensions
          if (handle?.includes("e")) {
            newWidth = original.width + localDeltaX;
            anchorLocalX = original.x; // left edge is anchor
          } else if (handle?.includes("w")) {
            newWidth = original.width - localDeltaX;
            anchorLocalX = original.x + original.width; // right edge is anchor
          } else {
            anchorLocalX = original.x + original.width / 2; // center
          }

          if (handle?.includes("s")) {
            newHeight = original.height + localDeltaY;
            anchorLocalY = original.y; // top edge is anchor
          } else if (handle?.includes("n")) {
            newHeight = original.height - localDeltaY;
            anchorLocalY = original.y + original.height; // bottom edge is anchor
          } else {
            anchorLocalY = original.y + original.height / 2; // center
          }

          // Enforce minimum size
          const minSize = 20;
          newWidth = Math.max(minSize, newWidth);
          newHeight = Math.max(minSize, newHeight);

          // Calculate new local position based on anchor
          let newX = original.x;
          let newY = original.y;

          if (handle?.includes("w")) {
            newX = anchorLocalX - newWidth;
          } else if (!handle?.includes("e")) {
            newX = anchorLocalX - newWidth / 2;
          }

          if (handle?.includes("n")) {
            newY = anchorLocalY - newHeight;
          } else if (!handle?.includes("s")) {
            newY = anchorLocalY - newHeight / 2;
          }

          // Calculate original anchor in world space
          const origCenterX = original.x + original.width / 2;
          const origCenterY = original.y + original.height / 2;
          const anchorOffsetX = anchorLocalX - origCenterX;
          const anchorOffsetY = anchorLocalY - origCenterY;
          const anchorWorldX = origCenterX + anchorOffsetX * cos - anchorOffsetY * sin;
          const anchorWorldY = origCenterY + anchorOffsetX * sin + anchorOffsetY * cos;

          // Calculate new center
          const newCenterX = newX + newWidth / 2;
          const newCenterY = newY + newHeight / 2;

          // Calculate where anchor would be with new dimensions
          const newAnchorOffsetX = anchorLocalX - newCenterX;
          const newAnchorOffsetY = anchorLocalY - newCenterY;

          // Adjust anchor based on which handle
          let finalAnchorOffsetX = newAnchorOffsetX;
          let finalAnchorOffsetY = newAnchorOffsetY;
          if (handle?.includes("w")) {
            finalAnchorOffsetX = newWidth / 2;
          } else if (handle?.includes("e")) {
            finalAnchorOffsetX = -newWidth / 2;
          } else {
            finalAnchorOffsetX = 0;
          }
          if (handle?.includes("n")) {
            finalAnchorOffsetY = newHeight / 2;
          } else if (handle?.includes("s")) {
            finalAnchorOffsetY = -newHeight / 2;
          } else {
            finalAnchorOffsetY = 0;
          }

          // Calculate new center position to keep anchor fixed
          const newCenterWorldX = anchorWorldX - (finalAnchorOffsetX * cos - finalAnchorOffsetY * sin);
          const newCenterWorldY = anchorWorldY - (finalAnchorOffsetX * sin + finalAnchorOffsetY * cos);

          // Convert back to top-left position
          const finalX = newCenterWorldX - newWidth / 2;
          const finalY = newCenterWorldY - newHeight / 2;

          updateShape(id, {
            x: finalX,
            y: finalY,
            width: newWidth,
            height: newHeight,
          });
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

          for (const [id, original] of originalShapes) {
            const relX = (original.x - originalBounds.x) / originalBounds.width;
            const relY = (original.y - originalBounds.y) / originalBounds.height;
            const relW = original.width / originalBounds.width;
            const relH = original.height / originalBounds.height;

            updateShape(id, {
              x: newBoundsX + relX * newBoundsWidth,
              y: newBoundsY + relY * newBoundsHeight,
              width: Math.max(10, relW * newBoundsWidth),
              height: Math.max(10, relH * newBoundsHeight),
            });
          }
        }
      }

      if (isRotating && rotateStartRef.current) {
        const { startAngle, centerX, centerY, originalRotations } = rotateStartRef.current;
        const currentAngle = Math.atan2(world.y - centerY, world.x - centerX);
        const deltaAngle = currentAngle - startAngle;

        for (const [id, originalRotation] of originalRotations) {
          updateShape(id, { rotation: originalRotation + deltaAngle });
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
      getShapeById,
      transform.scale,
      setHoveredHandle,
      updateShape,
      setSelectionBox,
    ],
  );

  const handleMouseUp = useCallback(
    (getShapesInBox: (box: { startX: number; startY: number; endX: number; endY: number }) => Shape[]) => {
      if (isMarqueeSelecting && marqueeStartRef.current) {
        const world = screenToWorld(lastMousePosRef.current.x, lastMousePosRef.current.y);
        const shapes = getShapesInBox({
          startX: marqueeStartRef.current.worldX,
          startY: marqueeStartRef.current.worldY,
          endX: world.x,
          endY: world.y,
        });
        if (shapes.length > 0) {
          setSelectedIds([...new Set([...selectedIds, ...shapes.map((s) => s.id)])]);
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

  // Get rotation cursor based on hovered handle and shape rotation
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
