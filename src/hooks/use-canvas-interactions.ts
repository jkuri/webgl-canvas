import { useCallback, useMemo, useRef } from "react";
import {
  calculateBoundingBox,
  getShapesInBox,
  hitTestAllElements,
  hitTestAllTopLevel,
  hitTestBoundsHandle,
  hitTestRotatedElementHandle,
} from "@/core";
import { type Bounds, calculateSnaps, createSnapState, getBounds, type SnapState } from "@/core/snapping";
import { resizePath } from "@/lib/svg-import";

import { useCanvasStore } from "@/store";
import type { BoundingBox, CanvasElement, ResizeHandle, Shape, SmartGuide } from "@/types";
import { getElementBounds } from "@/types";

interface PendingUpdate {
  type: "drag" | "resize" | "rotate" | "marquee";
  updates?: Map<string, Record<string, unknown>>;
  singleUpdate?: { id: string; data: Record<string, unknown> };
  selectionBox?: { startX: number; startY: number; endX: number; endY: number } | null;
  selectedIds?: string[];
  smartGuides?: SmartGuide[];
}

interface ElementData {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  type?: string;
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
  parentId?: string;
  aspectRatioLocked?: boolean;
  anchorX?: number;
  anchorY?: number;
}

let pendingUpdate: PendingUpdate | null = null;
let rafScheduled = false;

function flushPendingUpdate() {
  if (!pendingUpdate) return;

  const update = pendingUpdate;
  pendingUpdate = null;
  rafScheduled = false;

  const { updateElements, updateElement, setSelectionBox, setSelectedIds, setSmartGuides } = useCanvasStore.getState();

  if (update.updates && update.updates.size > 0) {
    updateElements(update.updates);
  }
  if (update.singleUpdate) {
    updateElement(update.singleUpdate.id, update.singleUpdate.data);
  }
  if (update.selectionBox !== undefined) {
    setSelectionBox(update.selectionBox);
  }
  if (update.selectedIds !== undefined) {
    setSelectedIds(update.selectedIds);
  }
  if (update.smartGuides !== undefined) {
    setSmartGuides(update.smartGuides);
  }
}

function scheduleUpdate(update: PendingUpdate) {
  pendingUpdate = update;
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushPendingUpdate);
  }
}

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

function getSnapCandidatesAndPoints(elements: CanvasElement[], excludeIds: Set<string> | string): SnapState {
  const excludeSet = typeof excludeIds === "string" ? new Set([excludeIds]) : excludeIds;
  return createSnapState(elements, excludeSet);
}

function createRotatedResizeCursor(angle: number): string {
  const normalizedAngle = ((angle % 360) + 360) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><g transform="rotate(${normalizedAngle} 10 10)"><path d="M3 3L7 3L7 5L5 5L5 7L3 7Z" fill="#fff"/><path d="M17 17L13 17L13 15L15 15L15 13L17 13Z" fill="#fff"/><path d="M5 5L15 15" stroke="#fff" stroke-width="2.5"/><path d="M3 3L7 3L7 5L5 5L5 7L3 7Z" fill="#000"/><path d="M17 17L13 17L13 15L15 15L15 13L17 13Z" fill="#000"/><path d="M5 5L15 15" stroke="#000" stroke-width="1.2"/></g></svg>`;

  const base64 = btoa(svg);
  return `url("data:image/svg+xml;base64,${base64}") 10 10, auto`;
}

function createRotationCursor(angle: number): string {
  const normalizedAngle = ((angle % 360) + 360) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g transform="rotate(${normalizedAngle} 12 12)"><path d="M12 5C8.13 5 5 8.13 5 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M12 5C8.13 5 5 8.13 5 12" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M12 2L15 5L12 8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 2L15 5L12 8" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L5 15L8 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L5 15L8 12" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

  const base64 = btoa(svg);
  return `url("data:image/svg+xml;base64,${base64}") 12 12, auto`;
}

function getRotatedRotationCursor(handle: ResizeHandle, shapeRotation: number): string {
  const cornerAngles: Record<string, number> = {
    nw: 0,
    ne: 90,
    se: 180,
    sw: 270,
  };

  if (!handle || !(handle in cornerAngles)) {
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
  } = useCanvasStore();

  const dragStartRef = useRef<{
    worldX: number;
    worldY: number;
    elements: Map<
      string,
      { x: number; y: number; cx?: number; cy?: number; x1?: number; y1?: number; x2?: number; y2?: number }
    >;
    snapState: SnapState;
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
        aspectRatioLocked?: boolean;
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

        anchorX?: number;
        anchorY?: number;
      }
    >;
    handle: ResizeHandle;
  } | null>(null);

  const marqueeStartRef = useRef<{ worldX: number; worldY: number } | null>(null);
  const initialSelectedIdsRef = useRef<string[]>([]);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
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

          if (selectedElements.some((e) => e.locked)) {
            return;
          }

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

                  anchorX?: number;
                  anchorY?: number;
                }
              >();

              if (selectedElements.length === 1 && selectedElements[0].type === "group") {
                const group = selectedElements[0];
                originalRotations.set(group.id, group.rotation);

                originalElements.set(group.id, {
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  rotation: group.rotation,
                  type: "group",
                });
              }

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

        if (selectedIds.length > 0) {
          const selectedElements = selectedIds.map((id) => getElementById(id)).filter(Boolean) as CanvasElement[];

          const anyLocked = selectedElements.some((e) => e.locked);

          if (!anyLocked) {
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
                    aspectRatioLocked?: boolean;
                  }
                >();

                const collectElements = (els: CanvasElement[], map: Map<string, ElementData>) => {
                  for (const element of els) {
                    if (element.type === "group") {
                      const children = element.childIds
                        .map((id) => getElementById(id))
                        .filter(Boolean) as CanvasElement[];
                      collectElements(children, map);
                    } else {
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
                  const anyLocked = selectedElements.some((e) => e.locked);

                  if (!anyLocked) {
                    setIsDragging(true);
                    const elementsMap = new Map<
                      string,
                      {
                        x: number;
                        y: number;
                        cx?: number;
                        cy?: number;
                        x1?: number;
                        y1?: number;
                        x2?: number;
                        y2?: number;
                      }
                    >();

                    const collectDraggableElements = (ids: string[], map: Map<string, ElementData>) => {
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

                    collectDraggableElements(selectedIds, elementsMap);

                    const excludedIds = getDescendantIds(selectedIds, getElementById);

                    const snapState = getSnapCandidatesAndPoints(elements, excludedIds);

                    const originalBounds: Bounds = {
                      minX: bounds.x,
                      minY: bounds.y,
                      maxX: bounds.x + bounds.width,
                      maxY: bounds.y + bounds.height,
                      centerX: bounds.x + bounds.width / 2,
                      centerY: bounds.y + bounds.height / 2,
                    };

                    dragStartRef.current = {
                      worldX: world.x,
                      worldY: world.y,
                      elements: elementsMap,
                      snapState,
                      originalBounds,
                    };
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

                const snapState = getSnapCandidatesAndPoints(elements, deepHit.id);

                const b = getBounds(deepHit, elements);
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
                  snapState,
                  originalBounds,
                };
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

                const snapState = getSnapCandidatesAndPoints(elements, deepHit.id);

                const b = getBounds(deepHit, elements);
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
                  snapState,
                  originalBounds,
                };
              }
              return;
            }
          }

          if (isDoubleClick && !hasSelectedChild && selectedIds.length === 1 && hit.type !== "group") {
            const overlappingTopLevel = hitTestAllTopLevel(world.x, world.y, elements);

            if (overlappingTopLevel.length > 1) {
              const currentIndex = overlappingTopLevel.findIndex((e) => e.id === hit.id);

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
                const currentIndex = overlappingElements.findIndex((e) => e.id === currentSelected.id);

                const nextIndex = (currentIndex + 1) % overlappingElements.length;
                const nextElement = overlappingElements[nextIndex];

                lastClickTimeRef.current = now;
                lastClickElementRef.current = nextElement.id;
                setSelectedIds([nextElement.id]);

                if (!nextElement.locked) {
                  setIsDragging(true);
                  const elementsMap = new Map<
                    string,
                    {
                      x: number;
                      y: number;
                      cx?: number;
                      cy?: number;
                      x1?: number;
                      y1?: number;
                      x2?: number;
                      y2?: number;
                    }
                  >();

                  if (nextElement.type === "rect" || nextElement.type === "image") {
                    elementsMap.set(nextElement.id, { x: nextElement.x, y: nextElement.y });
                  } else if (nextElement.type === "ellipse") {
                    elementsMap.set(nextElement.id, { x: 0, y: 0, cx: nextElement.cx, cy: nextElement.cy });
                  } else if (nextElement.type === "line") {
                    elementsMap.set(nextElement.id, {
                      x: 0,
                      y: 0,
                      x1: nextElement.x1,
                      y1: nextElement.y1,
                      x2: nextElement.x2,
                      y2: nextElement.y2,
                    });
                  } else if (nextElement.type === "path") {
                    elementsMap.set(nextElement.id, { x: nextElement.bounds.x, y: nextElement.bounds.y });
                  } else if (nextElement.type === "text") {
                    elementsMap.set(nextElement.id, { x: nextElement.x, y: nextElement.y });
                  }

                  const snapState = getSnapCandidatesAndPoints(elements, nextElement.id);

                  const b = getBounds(nextElement, elements);
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
                    snapState,
                    originalBounds,
                  };
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
              setIsDragging(true);
              const elementsMap = new Map<
                string,
                { x: number; y: number; cx?: number; cy?: number; x1?: number; y1?: number; x2?: number; y2?: number }
              >();

              const collectDraggableElements = (ids: string[], map: Map<string, ElementData>) => {
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

              const excludedIds = getDescendantIds(elementsToDrag, getElementById);

              const snapState = getSnapCandidatesAndPoints(elements, excludedIds);

              const draggedEls = elements.filter((e) => elementsToDrag.includes(e.id));
              let minX = Infinity,
                minY = Infinity,
                maxX = -Infinity,
                maxY = -Infinity;

              for (const el of draggedEls) {
                const b = getBounds(el, elements);
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
                snapState,
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

      if (activeTool === "select" && !isPanning && !isDragging && !isResizing && !isMarqueeSelecting) {
        const now = performance.now();
        if (now - lastHoverCheckRef.current >= HOVER_THROTTLE_MS) {
          lastHoverCheckRef.current = now;

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
      }

      if (isPanning) {
        handlers.updatePan(e);
        return;
      }

      if (isDragging && dragStartRef.current) {
        const deltaX = world.x - dragStartRef.current.worldX;
        const deltaY = world.y - dragStartRef.current.worldY;

        let finalDeltaX = deltaX;
        let finalDeltaY = deltaY;

        if (
          useCanvasStore.getState().snapToGrid ||
          useCanvasStore.getState().snapToObjects ||
          useCanvasStore.getState().snapToGeometry
        ) {
          const originalBounds = dragStartRef.current.originalBounds;
          const snapState = dragStartRef.current.snapState;

          const projected: Bounds = {
            minX: originalBounds.minX + deltaX,
            minY: originalBounds.minY + deltaY,
            maxX: originalBounds.maxX + deltaX,
            maxY: originalBounds.maxY + deltaY,
            centerX: originalBounds.centerX + deltaX,
            centerY: originalBounds.centerY + deltaY,
          };

          const { snapToGrid, snapToObjects, snapToGeometry, gridSize } = useCanvasStore.getState();

          const snapResult = calculateSnaps(projected, snapState, {
            snapToGrid,
            snapToObjects,
            snapToGeometry,
            gridSize,
            threshold: 10,
            scale: transform.scale,
          });

          finalDeltaX = deltaX + snapResult.x;
          finalDeltaY = deltaY + snapResult.y;
          useCanvasStore.getState().setSmartGuides(snapResult.guides);
        } else {
          useCanvasStore.getState().setSmartGuides([]);
        }

        const updates = new Map<string, Record<string, unknown>>();
        for (const [id, startPos] of dragStartRef.current.elements) {
          const element = getElementById(id);
          if (!element) continue;

          if (element.type === "rect" || element.type === "image") {
            updates.set(id, { x: startPos.x + finalDeltaX, y: startPos.y + finalDeltaY });
          } else if (element.type === "ellipse") {
            updates.set(id, { cx: (startPos.cx ?? 0) + finalDeltaX, cy: (startPos.cy ?? 0) + finalDeltaY });
          } else if (element.type === "line") {
            updates.set(id, {
              x1: (startPos.x1 ?? 0) + finalDeltaX,
              y1: (startPos.y1 ?? 0) + finalDeltaY,
              x2: (startPos.x2 ?? 0) + finalDeltaX,
              y2: (startPos.y2 ?? 0) + finalDeltaY,
            });
          } else if (element.type === "path") {
            updates.set(id, {
              bounds: {
                ...element.bounds,
                x: startPos.x + finalDeltaX,
                y: startPos.y + finalDeltaY,
              },
            });
          } else if (element.type === "text") {
            updates.set(id, { x: startPos.x + finalDeltaX, y: startPos.y + finalDeltaY });
          }
        }
        if (updates.size > 0) {
          scheduleUpdate({
            type: "drag",
            updates,
            smartGuides: useCanvasStore.getState().smartGuides,
          });
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

        if (isSingleRotatedElement && originalElements.size === 1) {
          const [id, original] = [...originalElements.entries()][0];

          if (original.type === "rect" || original.type === "image") {
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

            const shouldMaintainRatio = original.aspectRatioLocked || e.shiftKey;

            if (shouldMaintainRatio) {
              const ratio = original.width / original.height;

              let driveByWidth = true;

              if (handle?.length === 1) {
                if (handle === "n" || handle === "s") driveByWidth = false;
              } else {
                if (Math.abs(localDeltaY * ratio) > Math.abs(localDeltaX)) {
                  driveByWidth = false;
                }
              }

              if (driveByWidth) {
                newHeight = newWidth / ratio;
              } else {
                newWidth = newHeight * ratio;
              }
            }

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

            scheduleUpdate({
              type: "resize",
              singleUpdate: {
                id,
                data: {
                  x: finalX,
                  y: finalY,
                  width: newWidth,
                  height: newHeight,
                },
              },
            });
          } else if (original.type === "line") {
            const currentX1 = original.x1 ?? 0;
            const currentY1 = original.y1 ?? 0;
            const currentX2 = original.x2 ?? 0;
            const currentY2 = original.y2 ?? 0;

            if (handle === "nw") {
              scheduleUpdate({
                type: "resize",
                singleUpdate: {
                  id,
                  data: {
                    x1: currentX1 + deltaX,
                    y1: currentY1 + deltaY,
                  },
                },
              });
            } else if (handle === "se") {
              scheduleUpdate({
                type: "resize",
                singleUpdate: {
                  id,
                  data: {
                    x2: currentX2 + deltaX,
                    y2: currentY2 + deltaY,
                  },
                },
              });
            }
          } else if (original.type === "path") {
            const bounds = original.bounds || { x: 0, y: 0, width: 0, height: 0 };
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

            const shouldMaintainRatio = original.aspectRatioLocked || e.shiftKey;

            if (shouldMaintainRatio) {
              const ratio = bounds.width / bounds.height;
              let driveByWidth = true;

              if (handle?.length === 1) {
                if (handle === "n" || handle === "s") driveByWidth = false;
              } else {
                if (Math.abs(localDeltaY * ratio) > Math.abs(localDeltaX)) {
                  driveByWidth = false;
                }
              }

              if (driveByWidth) {
                newHeight = newWidth / ratio;
              } else {
                newWidth = newHeight * ratio;
              }

              if (handle?.includes("w")) {
                newX = bounds.x + bounds.width - newWidth;
              } else if (!handle?.includes("e")) {
                newX = bounds.x + (bounds.width - newWidth) / 2;
              }

              if (handle?.includes("n")) {
                newY = bounds.y + bounds.height - newHeight;
              } else if (!handle?.includes("s")) {
                newY = bounds.y + (bounds.height - newHeight) / 2;
              }
            }

            const newBounds = { x: newX, y: newY, width: newWidth, height: newHeight };
            const newD = resizePath(original.d!, bounds, newBounds);

            scheduleUpdate({
              type: "resize",
              singleUpdate: {
                id,
                data: {
                  d: newD,
                  bounds: newBounds,
                },
              },
            });
          }
        } else {
          const shouldMaintainRatio =
            originalElements.size === 1
              ? [...originalElements.values()][0].aspectRatioLocked || e.shiftKey
              : e.shiftKey;

          let newBoundsX = originalBounds.x;
          let newBoundsY = originalBounds.y;
          let newBoundsWidth = originalBounds.width;
          let newBoundsHeight = originalBounds.height;

          if (handle?.includes("w")) {
            newBoundsWidth = originalBounds.width - deltaX;
            newBoundsX = originalBounds.x + deltaX;
          } else if (handle?.includes("e")) {
            newBoundsWidth = originalBounds.width + deltaX;
          }

          if (handle?.includes("n")) {
            newBoundsHeight = originalBounds.height - deltaY;
            newBoundsY = originalBounds.y + deltaY;
          } else if (handle?.includes("s")) {
            newBoundsHeight = originalBounds.height + deltaY;
          }

          if (shouldMaintainRatio) {
            const ratio = originalBounds.width / originalBounds.height;
            let driveByWidth = true;

            if (handle?.length === 1) {
              if (handle === "n" || handle === "s") driveByWidth = false;
            } else {
              const deltaW = Math.abs(newBoundsWidth - originalBounds.width);
              const deltaH = Math.abs(newBoundsHeight - originalBounds.height);
              if (deltaH * ratio > deltaW) {
                driveByWidth = false;
              }
            }

            if (driveByWidth) {
              newBoundsHeight = newBoundsWidth / ratio;
            } else {
              newBoundsWidth = newBoundsHeight * ratio;
            }

            if (handle?.includes("w")) {
              newBoundsX = originalBounds.x + originalBounds.width - newBoundsWidth;
            } else if (!handle?.includes("e")) {
              newBoundsX = originalBounds.x + (originalBounds.width - newBoundsWidth) / 2;
            }

            if (handle?.includes("n")) {
              newBoundsY = originalBounds.y + originalBounds.height - newBoundsHeight;
            } else if (!handle?.includes("s")) {
              newBoundsY = originalBounds.y + (originalBounds.height - newBoundsHeight) / 2;
            }
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

          const updates = new Map<string, Record<string, unknown>>();
          for (const [id, original] of originalElements) {
            const relX = (original.x - originalBounds.x) / originalBounds.width;
            const relY = (original.y - originalBounds.y) / originalBounds.height;
            const relW = original.width / originalBounds.width;
            const relH = original.height / originalBounds.height;

            const newX = newBoundsX + relX * newBoundsWidth;
            const newY = newBoundsY + relY * newBoundsHeight;
            const newW = Math.max(1, relW * newBoundsWidth);
            const newH = Math.max(1, relH * newBoundsHeight);

            if (original.type === "rect" || original.type === "image") {
              updates.set(id, { x: newX, y: newY, width: newW, height: newH });
            } else if (original.type === "ellipse") {
              updates.set(id, {
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

              updates.set(id, {
                x1: newBoundsX + relX1 * newBoundsWidth,
                y1: newBoundsY + relY1 * newBoundsHeight,
                x2: newBoundsX + relX2 * newBoundsWidth,
                y2: newBoundsY + relY2 * newBoundsHeight,
              });
            } else if (original.type === "path") {
              const oldBounds = original.bounds || { x: 0, y: 0, width: 0, height: 0 };
              const newBounds = {
                ...oldBounds,
                x: newX,
                y: newY,
                width: newW,
                height: newH,
              };
              const newD = resizePath(original.d!, oldBounds, newBounds);

              updates.set(id, {
                d: newD,
                bounds: newBounds,
              });
            }
          }
          if (updates.size > 0) {
            const { snapToGrid, snapToObjects, snapToGeometry } = useCanvasStore.getState();
            const hasSnapping = snapToGrid || snapToObjects || snapToGeometry;
            scheduleUpdate({
              type: "drag",
              updates,
              smartGuides: hasSnapping ? useCanvasStore.getState().smartGuides : [],
            });
          }
        }
      }

      if (isRotating && rotateStartRef.current) {
        const { startAngle, centerX, centerY, originalRotations, originalElements } = rotateStartRef.current;
        const currentAngle = Math.atan2(world.y - centerY, world.x - centerX);
        const deltaAngle = currentAngle - startAngle;

        const updates = new Map<string, Record<string, unknown>>();
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

            updates.set(id, {
              x1: p1.x,
              y1: p1.y,
              x2: p2.x,
              y2: p2.y,
              rotation: newRotation,
            });
          } else if (original.type === "group") {
            updates.set(id, {
              rotation: newRotation,
            });
          } else if (original.type === "ellipse") {
            const center = rotatePoint(original.cx!, original.cy!);
            updates.set(id, {
              cx: center.x,
              cy: center.y,
              rotation: newRotation,
            });
          } else if (original.type === "rect" || original.type === "image") {
            const ox = original.x + original.width / 2;
            const oy = original.y + original.height / 2;
            const center = rotatePoint(ox, oy);

            updates.set(id, {
              x: center.x - original.width / 2,
              y: center.y - original.height / 2,
              rotation: newRotation,
            });
          } else if (original.type === "text") {
            const boundsX = original.x;
            const boundsY = original.y;
            const anchorX = original.anchorX ?? boundsX;
            const anchorY = original.anchorY ?? boundsY;

            const visualCenterX = boundsX + original.width / 2;
            const visualCenterY = boundsY + original.height / 2;

            const isSingleElement = originalElements.size === 1;

            if (isSingleElement) {
              updates.set(id, {
                rotation: newRotation,
              });
            } else {
              const newVisualCenter = rotatePoint(visualCenterX, visualCenterY);

              const newBoundsX = newVisualCenter.x - original.width / 2;
              const newBoundsY = newVisualCenter.y - original.height / 2;

              const anchorToBoundsX = boundsX - anchorX;
              const anchorToBoundsY = boundsY - anchorY;

              const rotatedOffsetX = anchorToBoundsX * cos - anchorToBoundsY * sin;
              const rotatedOffsetY = anchorToBoundsX * sin + anchorToBoundsY * cos;

              updates.set(id, {
                x: newBoundsX - rotatedOffsetX,
                y: newBoundsY - rotatedOffsetY,
                rotation: newRotation,
              });
            }
          } else if (original.type === "path") {
            const ox = original.bounds!.x + original.bounds!.width / 2;
            const oy = original.bounds!.y + original.bounds!.height / 2;
            const center = rotatePoint(ox, oy);

            updates.set(id, {
              bounds: {
                ...original.bounds!,
                x: center.x - original.bounds!.width / 2,
                y: center.y - original.bounds!.height / 2,
              },
              rotation: newRotation,
            });
          }
        }
        if (updates.size > 0) {
          scheduleUpdate({
            type: "rotate",
            updates,
          });
        }
      }

      if (isMarqueeSelecting && marqueeStartRef.current) {
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

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

        let newSelectedIds: string[] | undefined;
        if (boxElements.length > 0 || initialSelectedIdsRef.current.length > 0) {
          const newIds = [...new Set([...initialSelectedIdsRef.current, ...boxElements.map((e) => e.id)])];

          if (newIds.length !== selectedIds.length || !newIds.every((id) => selectedIds.includes(id))) {
            newSelectedIds = newIds;
          }
        } else if (selectedIds.length > 0) {
          newSelectedIds = [];
        }

        scheduleUpdate({
          type: "marquee",
          selectionBox: {
            startX: marqueeStartRef.current.worldX,
            startY: marqueeStartRef.current.worldY,
            endX: world.x,
            endY: world.y,
          },
          selectedIds: newSelectedIds,
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
