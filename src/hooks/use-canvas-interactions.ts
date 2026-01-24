import { useCallback, useMemo, useRef } from "react";
import {
  calculateBoundingBox,
  calculateGroupOBB,
  hitTestAllElements,
  hitTestAllTopLevel,
  hitTestBoundsHandle,
  hitTestRotatedElementHandle,
} from "@/core";
import { useCanvasStore } from "@/store";
import type { CanvasElement, ResizeHandle, Shape } from "@/types";
import {
  flattenCanvasElements,
  getResizeHandle,
  getRotatedCursor,
  getRotatedRotationCursor,
  useDragInteraction,
  useMarqueeInteraction,
  useResizeInteraction,
  useRotateInteraction,
} from "./canvas-interactions";

interface UseCanvasInteractionsProps {
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  hitTest: (worldX: number, worldY: number, deepSelect?: boolean) => CanvasElement | null;
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
  hitTestResizeHandle: _hitTestResizeHandle,
  handlers,
  actions: _actions,
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
  } = useCanvasStore();

  const dragInteraction = useDragInteraction(screenToWorld, getElementById);
  const resizeInteraction = useResizeInteraction(screenToWorld, getElementById);
  const rotateInteraction = useRotateInteraction(screenToWorld, getElementById);
  const marqueeInteraction = useMarqueeInteraction(screenToWorld);

  const lastClickTimeRef = useRef<number>(0);
  const lastClickElementRef = useRef<string | null>(null);
  const lastHoverCheckRef = useRef<number>(0);
  const HOVER_THROTTLE_MS = 16;

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
      const target = e.target as HTMLElement;
      if (target.closest(".pointer-events-auto")) {
        return;
      }

      const shouldPan = activeTool === "pan" || e.button === 1 || (e.button === 0 && isSpaceHeld);

      if (shouldPan) {
        e.preventDefault();
        setIsPanning(true);
        handlers.startPan(e);
        return;
      }

      if (activeTool === "select" && e.button === 0) {
        const world = screenToWorld(e.clientX, e.clientY);

        if ((e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
          const selectedElements = selectedIds.map((id) => getElementById(id)).filter(Boolean) as CanvasElement[];

          if (selectedElements.some((el) => el.locked)) {
            return;
          }

          let clickedHandle: ResizeHandle = null;
          if (
            selectedElements.length === 1 &&
            (selectedElements[0].type !== "group" || selectedElements[0].type === "group")
          ) {
            if (selectedElements[0].type === "group") {
              const group = selectedElements[0] as unknown as CanvasElement;

              const flattenedElements = flattenCanvasElements([group], getElementById);
              const obb = calculateGroupOBB(flattenedElements as Shape[], group.rotation);
              clickedHandle = hitTestRotatedElementHandle(world.x, world.y, obb, transform.scale);
            } else {
              clickedHandle = hitTestRotatedElementHandle(
                world.x,
                world.y,
                selectedElements[0] as Shape,
                transform.scale,
              );
            }
          } else {
            const flattenedElements = flattenCanvasElements(selectedElements, getElementById);
            const bounds = calculateBoundingBox(flattenedElements);
            if (bounds) {
              clickedHandle = hitTestBoundsHandle(world.x, world.y, bounds, transform.scale);
            }
          }

          const isCorner =
            clickedHandle === "nw" || clickedHandle === "ne" || clickedHandle === "se" || clickedHandle === "sw";
          if (isCorner) {
            rotateInteraction.startRotate(world.x, world.y, clickedHandle, selectedElements, setIsRotating);
            return;
          }
        }

        if (selectedIds.length > 0) {
          const selectedElements = selectedIds.map((id) => getElementById(id)).filter(Boolean) as CanvasElement[];
          const anyLocked = selectedElements.some((el) => el.locked);

          if (!anyLocked) {
            const handle = getResizeHandle(
              world.x,
              world.y,
              selectedElements,
              transform.scale,
              getElementById,
              hitTestRotatedElementHandle,
              hitTestBoundsHandle,
            );

            if (handle) {
              resizeInteraction.startResize(world.x, world.y, handle, selectedElements, setIsResizing);
              return;
            }
          }
        }

        const hasSelectedChild = selectedIds.some((id) => {
          const el = getElementById(id);
          return el?.parentId;
        });

        if (selectedIds.length > 0 && !hasSelectedChild) {
          const selectedElements = selectedIds.map((id) => getElementById(id)).filter(Boolean) as CanvasElement[];
          const flattened = flattenCanvasElements(selectedElements, getElementById);
          const bounds = calculateBoundingBox(flattened);

          if (bounds) {
            const isWithinBounds =
              world.x >= bounds.x &&
              world.x <= bounds.x + bounds.width &&
              world.y >= bounds.y &&
              world.y <= bounds.y + bounds.height;

            if (isWithinBounds) {
              const now = Date.now();
              const firstSelectedId = selectedIds[0];
              const isDoubleClick =
                now - lastClickTimeRef.current < 400 && lastClickElementRef.current === firstSelectedId;

              const selectedElement = selectedIds.length === 1 ? getElementById(firstSelectedId) : null;

              if (isDoubleClick && selectedElement?.type === "text") {
                useCanvasStore.getState().setIsEditingText(true, selectedElement.id);
                lastClickTimeRef.current = 0;
                lastClickElementRef.current = null;
                return;
              }

              if (isDoubleClick && selectedElement?.type === "group") {
              } else {
                lastClickTimeRef.current = now;
                lastClickElementRef.current = firstSelectedId;

                const topHit = hitTest(world.x, world.y, hasSelectedChild);
                if (topHit && !selectedIds.includes(topHit.id)) {
                } else {
                  const anyLocked = selectedElements.some((el) => el.locked);

                  if (!anyLocked) {
                    dragInteraction.startDrag(world.x, world.y, selectedIds, elements, setIsDragging);
                    return;
                  }
                }
              }
            }
          }
        }

        const hit = hitTest(world.x, world.y, hasSelectedChild);

        if (hit) {
          const now = Date.now();
          const isDoubleClick = now - lastClickTimeRef.current < 400 && lastClickElementRef.current === hit.id;

          if (isDoubleClick && hit.type === "text") {
            useCanvasStore.getState().setIsEditingText(true, hit.id);
            lastClickTimeRef.current = 0;
            lastClickElementRef.current = null;
            return;
          }

          const selectedGroup = selectedIds.length === 1 ? getElementById(selectedIds[0]) : null;
          const isTimeForDoubleClick = now - lastClickTimeRef.current < 400;
          if (
            isTimeForDoubleClick &&
            selectedGroup?.type === "group" &&
            lastClickElementRef.current === selectedGroup.id
          ) {
            const groupChildren = hitTestAllElements(world.x, world.y, elements, selectedGroup.id);
            if (groupChildren.length > 0) {
              const deepHit = groupChildren[0];
              lastClickTimeRef.current = now;
              lastClickElementRef.current = deepHit.id;
              setSelectedIds([deepHit.id]);

              if (!deepHit.locked) {
                dragInteraction.startDragForElement(world.x, world.y, deepHit, elements, setIsDragging);
              }
              return;
            }
          }

          if (isDoubleClick && hit.type === "group") {
            const deepHit = hitTest(world.x, world.y, true);
            if (deepHit && deepHit.id !== hit.id) {
              lastClickTimeRef.current = now;
              lastClickElementRef.current = deepHit.id;
              setSelectedIds([deepHit.id]);

              if (!deepHit.locked) {
                dragInteraction.startDragForElement(world.x, world.y, deepHit, elements, setIsDragging);
              }
              return;
            }
          }

          if (isDoubleClick && !hasSelectedChild && selectedIds.length === 1 && hit.type !== "group") {
            const overlappingTopLevel = hitTestAllTopLevel(world.x, world.y, elements);

            if (overlappingTopLevel.length > 1) {
              const currentIndex = overlappingTopLevel.findIndex((el) => el.id === hit.id);
              const nextIndex = (currentIndex + 1) % overlappingTopLevel.length;
              const nextElement = overlappingTopLevel[nextIndex];

              lastClickTimeRef.current = now;
              lastClickElementRef.current = nextElement.id;
              setSelectedIds([nextElement.id]);
              return;
            }
          }

          if (isDoubleClick && hasSelectedChild && selectedIds.length === 1) {
            const currentSelected = getElementById(selectedIds[0]);
            if (currentSelected?.parentId) {
              const overlappingElements = hitTestAllElements(world.x, world.y, elements, currentSelected.parentId);

              if (overlappingElements.length > 1) {
                const currentIndex = overlappingElements.findIndex((el) => el.id === currentSelected.id);
                const nextIndex = (currentIndex + 1) % overlappingElements.length;
                const nextElement = overlappingElements[nextIndex];

                lastClickTimeRef.current = now;
                lastClickElementRef.current = nextElement.id;
                setSelectedIds([nextElement.id]);

                if (!nextElement.locked) {
                  dragInteraction.startDragForElement(world.x, world.y, nextElement, elements, setIsDragging);
                }
                return;
              }
            }
          }

          lastClickTimeRef.current = now;
          lastClickElementRef.current = hit.id;

          const isAlreadySelected = selectedIds.includes(hit.id);

          if (e.shiftKey || e.metaKey || e.ctrlKey) {
            setSelectedIds(isAlreadySelected ? selectedIds.filter((id) => id !== hit.id) : [...selectedIds, hit.id]);
          } else {
            if (!isAlreadySelected) setSelectedIds([hit.id]);

            const elementsToDrag = isAlreadySelected ? selectedIds : [hit.id];
            const anyLocked = elementsToDrag.some((id) => {
              const element = getElementById(id);
              return element?.locked;
            });

            if (!anyLocked) {
              dragInteraction.startDrag(world.x, world.y, elementsToDrag, elements, setIsDragging);
            }
          }
        } else {
          marqueeInteraction.startMarquee(
            e.clientX,
            e.clientY,
            selectedIds,
            e.shiftKey,
            setIsMarqueeSelecting,
            setSelectedIds,
            setSelectionBox,
          );
        }
      }
    },
    [
      activeTool,
      isSpaceHeld,
      handlers,
      screenToWorld,
      selectedIds,
      hitTest,
      getElementById,
      transform.scale,
      setIsPanning,
      setIsDragging,
      setIsResizing,
      setIsMarqueeSelecting,
      setSelectedIds,
      setSelectionBox,
      setIsRotating,
      dragInteraction,
      resizeInteraction,
      rotateInteraction,
      marqueeInteraction,
      elements,
    ],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const world = screenToWorld(e.clientX, e.clientY);

      if (activeTool === "select" && !isPanning && !isDragging && !isResizing && !isMarqueeSelecting) {
        const now = performance.now();
        if (now - lastHoverCheckRef.current >= HOVER_THROTTLE_MS) {
          lastHoverCheckRef.current = now;

          if (selectedIds.length > 0) {
            const selectedElements = selectedIds.map((id) => getElementById(id)).filter(Boolean) as CanvasElement[];

            const handle = getResizeHandle(
              world.x,
              world.y,
              selectedElements,
              transform.scale,
              getElementById,
              hitTestRotatedElementHandle,
              hitTestBoundsHandle,
            );

            setHoveredHandle(handle);
          } else {
            setHoveredHandle(null);
          }
        }
      }

      if (isPanning) {
        handlers.updatePan(e);
        return;
      }

      if (isDragging) {
        dragInteraction.updateDrag(e.clientX, e.clientY, transform.scale);
      }

      if (isResizing) {
        resizeInteraction.updateResize(e.clientX, e.clientY, e.shiftKey);
      }

      if (isRotating) {
        rotateInteraction.updateRotate(e.clientX, e.clientY);
      }

      if (isMarqueeSelecting) {
        marqueeInteraction.updateMarquee(e.clientX, e.clientY, selectedIds);
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
      getElementById,
      transform.scale,
      setHoveredHandle,
      dragInteraction,
      resizeInteraction,
      rotateInteraction,
      marqueeInteraction,
    ],
  );

  const handleMouseUp = useCallback(() => {
    if (isMarqueeSelecting) {
      marqueeInteraction.endMarquee(setSelectedIds, setSelectionBox);
    }

    setIsPanning(false);
    setIsDragging(false);
    setIsResizing(false);
    setIsRotating(false);
    setIsMarqueeSelecting(false);

    dragInteraction.endDrag();
    resizeInteraction.endResize();
    rotateInteraction.endRotate();

    useCanvasStore.getState().setSmartGuides([]);
  }, [
    isMarqueeSelecting,
    setIsPanning,
    setIsDragging,
    setIsResizing,
    setIsRotating,
    setIsMarqueeSelecting,
    setSelectedIds,
    setSelectionBox,
    dragInteraction,
    resizeInteraction,
    rotateInteraction,
    marqueeInteraction,
  ]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const world = screenToWorld(e.clientX, e.clientY);

      const hasSelectedChild = selectedIds.some((id) => {
        const el = getElementById(id);
        return el?.parentId;
      });

      const hit = hitTest(world.x, world.y, hasSelectedChild);
      setContextMenuTarget(hit);
      if (hit && !selectedIds.includes(hit.id)) setSelectedIds([hit.id]);
    },
    [screenToWorld, hitTest, selectedIds, setContextMenuTarget, setSelectedIds, getElementById],
  );

  const getRotationCursorForHandle = useCallback(
    (handle: ResizeHandle): string => {
      return getRotatedRotationCursor(handle, selectedRotation);
    },
    [selectedRotation],
  );

  const activeRotationHandle = isRotating ? rotateInteraction.getActiveHandle() : null;

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
