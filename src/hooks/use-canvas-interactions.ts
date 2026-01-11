import { useCallback, useMemo, useRef } from "react";
import {
  type Bounds,
  calculateBoundingBox,
  calculateSnapAdjustment,
  getBounds,
  getShapesInBox,
  getSnapPoints,
  hitTestBoundsHandle,
  hitTestRotatedElementHandle,
  type Point,
} from "@/core";
import { resizePath } from "@/lib/svg-import";
import { useCanvasStore } from "@/store";
import type { BoundingBox, CanvasElement, ResizeHandle, Shape } from "@/types";
import { getElementBounds } from "@/types";

// Helper to flatten groups recursively
function flattenCanvasElements(
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

// Helper to get all descendant IDs of elements (for group snap exclusion)
function getDescendantIds(ids: string[], getElementById: (id: string) => CanvasElement | undefined): Set<string> {
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
    snapCandidates: Bounds[];
    snapPoints: Point[];
    originalBounds: Bounds;
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
        bounds?: { x: number; y: number; width: number; height: number; rotation?: number };
        d?: string;
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
        d?: string;
        bounds?: { x: number; y: number; width: number; height: number };
      }
    >;
    handle: ResizeHandle;
  } | null>(null);

  const marqueeStartRef = useRef<{ worldX: number; worldY: number } | null>(null);
  const initialSelectedIdsRef = useRef<string[]>([]);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastClickTimeRef = useRef<number>(0);
  const lastClickElementRef = useRef<string | null>(null);

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
      // Ignore events originating from UI panels
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
            const flattenedElements = flattenCanvasElements(selectedElements, getElementById);
            const bounds = calculateBoundingBox(flattenedElements);
            if (bounds) {
              clickedHandle = hitTestBoundsHandle(world.x, world.y, bounds, transform.scale);
            }
          }

          // Only allow rotation from corner handles
          const isCorner =
            clickedHandle === "nw" || clickedHandle === "ne" || clickedHandle === "se" || clickedHandle === "sw";
          if (isCorner) {
            const flattenedElements = flattenCanvasElements(selectedElements, getElementById);
            const bounds = calculateBoundingBox(flattenedElements);
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
                  d?: string;
                  bounds?: { x: number; y: number; width: number; height: number };
                }
              >();

              for (const element of flattenedElements) {
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
            // Check resize handle first
            let handle: ResizeHandle = null;
            if (
              selectedElements.length === 1 &&
              selectedElements[0].type !== "group" &&
              selectedElements[0].type !== "text"
            ) {
              handle = hitTestRotatedElementHandle(world.x, world.y, selectedElements[0] as Shape, transform.scale);
            } else if (
              selectedElements.length > 1 ||
              (selectedElements.length === 1 && selectedElements[0].type === "group")
            ) {
              const flattened = flattenCanvasElements(selectedElements, getElementById);
              const bounds = calculateBoundingBox(flattened);
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
              let bounds: BoundingBox | null;
              let flattenedElements: CanvasElement[] = [];

              if (isSingleRotatedElement) {
                bounds = getElementBounds(selectedElements[0]);
                flattenedElements = [selectedElements[0]];
              } else {
                flattenedElements = flattenCanvasElements(selectedElements, getElementById);
                bounds = calculateBoundingBox(flattenedElements);
              }

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
                    x1?: number;
                    y1?: number;
                    x2?: number;
                    y2?: number;
                    bounds?: { x: number; y: number; width: number; height: number; rotation?: number };
                  }
                >();
                // biome-ignore lint/suspicious/noExplicitAny: complex type
                const collectElements = (els: CanvasElement[], map: Map<string, any>) => {
                  for (const element of els) {
                    if (element.type === "group") {
                      // Recursive collection of children
                      const children = element.childIds
                        .map((id) => getElementById(id))
                        .filter(Boolean) as CanvasElement[];
                      collectElements(children, map);
                    } else {
                      // Collect leaf element
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
                        // Store parentId to check if it belongs to a group being resized
                        parentId: element.parentId,
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
                      }

                      map.set(element.id, entry);
                    }
                  }
                };

                collectElements(flattenedElements, originalElements);
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

        // Check if any currently selected element is a child (has parentId)
        // If so, use deep select to allow clicking on children directly
        const hasSelectedChild = selectedIds.some((id) => {
          const el = getElementById(id);
          return el?.parentId;
        });

        const hit = hitTest(world.x, world.y, hasSelectedChild);

        if (hit) {
          // Detect double-click
          const now = Date.now();
          const isDoubleClick = now - lastClickTimeRef.current < 300 && lastClickElementRef.current === hit.id;

          if (isDoubleClick && hit.type === "text") {
            // Start editing text
            useCanvasStore.getState().setIsEditingText(true, hit.id);
            lastClickTimeRef.current = 0;
            lastClickElementRef.current = null;
            return;
          }

          // Double-click on a group: deep select the child element
          if (isDoubleClick && hit.type === "group") {
            const deepHit = hitTest(world.x, world.y, true);
            if (deepHit && deepHit.id !== hit.id) {
              lastClickTimeRef.current = 0;
              lastClickElementRef.current = null;
              setSelectedIds([deepHit.id]);

              // Start dragging the deep-selected element if not locked
              if (!deepHit.locked) {
                setIsDragging(true);
                const elementsMap = new Map<
                  string,
                  { x: number; y: number; cx?: number; cy?: number; x1?: number; y1?: number; x2?: number; y2?: number }
                >();

                if (deepHit.type === "rect" || deepHit.type === "image") {
                  elementsMap.set(deepHit.id, { x: deepHit.x, y: deepHit.y });
                } else if (deepHit.type === "ellipse") {
                  elementsMap.set(deepHit.id, { x: 0, y: 0, cx: deepHit.cx, cy: deepHit.cy });
                } else if (deepHit.type === "line") {
                  elementsMap.set(deepHit.id, {
                    x: 0,
                    y: 0,
                    x1: deepHit.x1,
                    y1: deepHit.y1,
                    x2: deepHit.x2,
                    y2: deepHit.y2,
                  });
                } else if (deepHit.type === "path") {
                  elementsMap.set(deepHit.id, { x: deepHit.bounds.x, y: deepHit.bounds.y });
                } else if (deepHit.type === "text") {
                  elementsMap.set(deepHit.id, { x: deepHit.x, y: deepHit.y });
                }

                // Pre-calculate candidates for snapping (everything NOT being dragged)
                const snapCandidates = elements
                  .filter((e) => e.id !== deepHit.id && e.type !== "group")
                  .map((e) => getBounds(e));

                const snapPoints = elements
                  .filter((e) => e.id !== deepHit.id && e.type !== "group")
                  .flatMap((e) => getSnapPoints(e));

                const b = getBounds(deepHit);
                const originalBounds: Bounds = {
                  minX: b.minX,
                  minY: b.minY,
                  maxX: b.maxX,
                  maxY: b.maxY,
                  centerX: b.centerX,
                  centerY: b.centerY,
                };

                dragStartRef.current = {
                  worldX: world.x,
                  worldY: world.y,
                  elements: elementsMap,
                  snapCandidates,
                  snapPoints,
                  originalBounds,
                };
              }
              return;
            }
          }

          lastClickTimeRef.current = now;
          lastClickElementRef.current = hit.id;

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
              // Helper to collect all draggable elements (including group children)
              // biome-ignore lint/suspicious/noExplicitAny: complex type
              const collectDraggableElements = (ids: string[], map: Map<string, any>) => {
                for (const id of ids) {
                  const element = getElementById(id);
                  if (!element) continue;

                  if (element.type === "group") {
                    collectDraggableElements(element.childIds, map);
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
              };

              collectDraggableElements(elementsToDrag, elementsMap);

              // Get all descendant IDs (including selected elements and their children)
              // to properly exclude them from snap candidates
              const excludedIds = getDescendantIds(elementsToDrag, getElementById);

              // Pre-calculate candidates for snapping (everything NOT being dragged)
              const snapCandidates = elements
                .filter((e) => !excludedIds.has(e.id) && e.type !== "group")
                .map((e) => getBounds(e));

              const snapPoints = elements
                .filter((e) => !excludedIds.has(e.id) && e.type !== "group")
                .flatMap((e) => getSnapPoints(e));

              const draggedEls = elements.filter((e) => elementsToDrag.includes(e.id));
              let minX = Infinity,
                minY = Infinity,
                maxX = -Infinity,
                maxY = -Infinity;

              for (const el of draggedEls) {
                const b = getBounds(el);
                minX = Math.min(minX, b.minX);
                minY = Math.min(minY, b.minY);
                maxX = Math.max(maxX, b.maxX);
                maxY = Math.max(maxY, b.maxY);
              }

              const originalBounds: Bounds = {
                minX,
                minY,
                maxX,
                maxY,
                centerX: (minX + maxX) / 2,
                centerY: (minY + maxY) / 2,
              };

              dragStartRef.current = {
                worldX: world.x,
                worldY: world.y,
                elements: elementsMap,
                snapCandidates,
                snapPoints,
                originalBounds,
              };
            }
          }
        } else {
          if (!e.shiftKey) {
            setSelectedIds([]);
            initialSelectedIdsRef.current = [];
          } else {
            initialSelectedIdsRef.current = [...selectedIds];
          }
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
          if (
            selectedElements.length === 1 &&
            selectedElements[0].type !== "group" &&
            selectedElements[0].type !== "text"
          ) {
            handle = hitTestRotatedElementHandle(world.x, world.y, selectedElements[0] as Shape, transform.scale);
          } else if (
            selectedElements.length > 1 ||
            (selectedElements.length === 1 && selectedElements[0].type === "group")
          ) {
            const flattened = flattenCanvasElements(selectedElements, getElementById);
            const bounds = calculateBoundingBox(flattened);
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

        // Snapping Logic
        let finalDeltaX = deltaX;
        let finalDeltaY = deltaY;

        if (
          useCanvasStore.getState().snapToGrid ||
          useCanvasStore.getState().snapToObjects ||
          useCanvasStore.getState().snapToGeometry
        ) {
          const originalBounds = dragStartRef.current.originalBounds;
          const snapCandidates = dragStartRef.current.snapCandidates;
          const snapPoints = dragStartRef.current.snapPoints;

          // Projected bounds
          const projected: Bounds = {
            minX: originalBounds.minX + deltaX,
            minY: originalBounds.minY + deltaY,
            maxX: originalBounds.maxX + deltaX,
            maxY: originalBounds.maxY + deltaY,
            centerX: originalBounds.centerX + deltaX,
            centerY: originalBounds.centerY + deltaY,
          };

          const { snapToGrid, snapToObjects, snapToGeometry, gridSize } = useCanvasStore.getState();

          const snapResult = calculateSnapAdjustment(
            projected,
            snapCandidates,
            snapPoints,
            snapToGrid,
            snapToObjects,
            snapToGeometry,
            transform.scale,
            10, // threshold
            gridSize,
          );

          finalDeltaX = deltaX + snapResult.x;
          finalDeltaY = deltaY + snapResult.y;
          useCanvasStore.getState().setSmartGuides(snapResult.guides);
        } else {
          useCanvasStore.getState().setSmartGuides([]);
        }

        for (const [id, startPos] of dragStartRef.current.elements) {
          const element = getElementById(id);
          if (!element) continue;

          if (element.type === "rect" || element.type === "image") {
            updateElement(id, { x: startPos.x + finalDeltaX, y: startPos.y + finalDeltaY });
          } else if (element.type === "ellipse") {
            updateElement(id, { cx: (startPos.cx ?? 0) + finalDeltaX, cy: (startPos.cy ?? 0) + finalDeltaY });
          } else if (element.type === "line") {
            updateElement(id, {
              x1: (startPos.x1 ?? 0) + finalDeltaX,
              y1: (startPos.y1 ?? 0) + finalDeltaY,
              x2: (startPos.x2 ?? 0) + finalDeltaX,
              y2: (startPos.y2 ?? 0) + finalDeltaY,
            });
          } else if (element.type === "path") {
            updateElement(id, {
              bounds: {
                ...element.bounds,
                x: startPos.x + finalDeltaX,
                y: startPos.y + finalDeltaY,
              },
            });
          } else if (element.type === "text") {
            updateElement(id, { x: startPos.x + finalDeltaX, y: startPos.y + finalDeltaY });
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
          } else if (original.type === "path") {
            // Path resizing - resize bounds proportionally
            // original.bounds might be undefined if flattened in resizeStartRef, construct it from top-level props
            const bounds = { x: original.x, y: original.y, width: original.width, height: original.height };
            const cosNeg = Math.cos(-elementRotation);
            const sinNeg = Math.sin(-elementRotation);

            const localDeltaX = deltaX * cosNeg - deltaY * sinNeg;
            const localDeltaY = deltaX * sinNeg + deltaY * cosNeg;

            let newWidth = bounds.width;
            let newHeight = bounds.height;
            let newX = bounds.x;
            let newY = bounds.y;

            if (handle?.includes("e")) {
              newWidth = bounds.width + localDeltaX;
            } else if (handle?.includes("w")) {
              newWidth = bounds.width - localDeltaX;
              newX = bounds.x + localDeltaX;
            }

            if (handle?.includes("s")) {
              newHeight = bounds.height + localDeltaY;
            } else if (handle?.includes("n")) {
              newHeight = bounds.height - localDeltaY;
              newY = bounds.y + localDeltaY;
            }

            const minSize = 20;
            newWidth = Math.max(minSize, newWidth);
            newHeight = Math.max(minSize, newHeight);

            const newBounds = { x: newX, y: newY, width: newWidth, height: newHeight };
            const newD = resizePath(original.d!, bounds, newBounds);

            updateElement(id, {
              d: newD,
              bounds: newBounds,
            });
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
            const relX = (original.x - originalBounds.x) / originalBounds.width;
            const relY = (original.y - originalBounds.y) / originalBounds.height;
            const relW = original.width / originalBounds.width;
            const relH = original.height / originalBounds.height;

            const newX = newBoundsX + relX * newBoundsWidth;
            const newY = newBoundsY + relY * newBoundsHeight;
            const newW = Math.max(1, relW * newBoundsWidth);
            const newH = Math.max(1, relH * newBoundsHeight);

            if (original.type === "rect") {
              updateElement(id, { x: newX, y: newY, width: newW, height: newH });
            } else if (original.type === "ellipse") {
              updateElement(id, {
                cx: newX + newW / 2,
                cy: newY + newH / 2,
                rx: newW / 2,
                ry: newH / 2,
              });
            } else if (original.type === "line") {
              const relX1 = ((original.x1 ?? 0) - originalBounds.x) / originalBounds.width;
              const relY1 = ((original.y1 ?? 0) - originalBounds.y) / originalBounds.height;
              const relX2 = ((original.x2 ?? 0) - originalBounds.x) / originalBounds.width;
              const relY2 = ((original.y2 ?? 0) - originalBounds.y) / originalBounds.height;

              updateElement(id, {
                x1: newBoundsX + relX1 * newBoundsWidth,
                y1: newBoundsY + relY1 * newBoundsHeight,
                x2: newBoundsX + relX2 * newBoundsWidth,
                y2: newBoundsY + relY2 * newBoundsHeight,
              });
            } else if (original.type === "path") {
              const oldBounds = { x: original.x, y: original.y, width: original.width, height: original.height };
              const newBounds = {
                ...oldBounds,
                x: newX,
                y: newY,
                width: newW,
                height: newH,
              };
              const newD = resizePath(original.d!, oldBounds, newBounds);

              updateElement(id, {
                d: newD,
                bounds: newBounds,
              });
            }
          }
        }
      }

      if (isRotating && rotateStartRef.current) {
        const { startAngle, centerX, centerY, originalRotations, originalElements } = rotateStartRef.current;
        const currentAngle = Math.atan2(world.y - centerY, world.x - centerX);
        const deltaAngle = currentAngle - startAngle;

        for (const [id, original] of originalElements) {
          const originalRotation = originalRotations.get(id) ?? 0;
          const newRotation = originalRotation + deltaAngle;

          const cos = Math.cos(deltaAngle);
          const sin = Math.sin(deltaAngle);

          const rotatePoint = (x: number, y: number) => ({
            x: centerX + (x - centerX) * cos - (y - centerY) * sin,
            y: centerY + (x - centerX) * sin + (y - centerY) * cos,
          });

          if (original.type === "line") {
            const p1 = rotatePoint(original.x1!, original.y1!);
            const p2 = rotatePoint(original.x2!, original.y2!);

            updateElement(id, {
              x1: p1.x,
              y1: p1.y,
              x2: p2.x,
              y2: p2.y,
              rotation: newRotation,
            });
          } else if (original.type === "ellipse") {
            const center = rotatePoint(original.cx!, original.cy!);
            updateElement(id, {
              cx: center.x,
              cy: center.y,
              rotation: newRotation,
            });
          } else if (original.type === "rect" || original.type === "image" || original.type === "text") {
            // Calculate original center
            const ox = original.x + original.width / 2;
            const oy = original.y + original.height / 2;
            const center = rotatePoint(ox, oy);

            updateElement(id, {
              x: center.x - original.width / 2,
              y: center.y - original.height / 2,
              rotation: newRotation,
            });
          } else if (original.type === "path") {
            // Path rotation requires standard bounds update plus path data rotation or just bounds?
            // Usually paths are defined by d-string relative to bounds or absolute?
            // In this app, paths seem to have 'bounds'.
            // We'll rotate the bounds center.
            const ox = original.bounds!.x + original.bounds!.width / 2;
            const oy = original.bounds!.y + original.bounds!.height / 2;
            const center = rotatePoint(ox, oy);

            updateElement(id, {
              bounds: {
                ...original.bounds!,
                x: center.x - original.bounds!.width / 2,
                y: center.y - original.bounds!.height / 2,
              },
              rotation: newRotation,
            });
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

        const elements = useCanvasStore.getState().elements;
        const boxElements = getShapesInBox(
          {
            startX: marqueeStartRef.current.worldX,
            startY: marqueeStartRef.current.worldY,
            endX: world.x,
            endY: world.y,
          },
          elements,
        );

        if (boxElements.length > 0 || initialSelectedIdsRef.current.length > 0) {
          const newIds = [...new Set([...initialSelectedIdsRef.current, ...boxElements.map((e) => e.id)])];

          if (newIds.length !== selectedIds.length || !newIds.every((id) => selectedIds.includes(id))) {
            setSelectedIds(newIds);
          }
        } else if (selectedIds.length > 0) {
          setSelectedIds([]);
        }
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

  const handleMouseUp = useCallback(() => {
    if (isMarqueeSelecting && marqueeStartRef.current) {
      const world = screenToWorld(lastMousePosRef.current.x, lastMousePosRef.current.y);
      const elements = useCanvasStore.getState().elements;
      const boxElements = getShapesInBox(
        {
          startX: marqueeStartRef.current.worldX,
          startY: marqueeStartRef.current.worldY,
          endX: world.x,
          endY: world.y,
        },
        elements,
      );
      if (boxElements.length > 0 || initialSelectedIdsRef.current.length > 0) {
        setSelectedIds([...new Set([...initialSelectedIdsRef.current, ...boxElements.map((e) => e.id)])]);
      } else {
        setSelectedIds([]);
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

    // Clear guides
    useCanvasStore.getState().setSmartGuides([]);
  }, [
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
  ]);

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
