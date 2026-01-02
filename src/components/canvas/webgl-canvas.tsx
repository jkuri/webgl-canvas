import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRotatedCorners, hitTestResizeHandle, hitTestShape, WebGLRenderer } from "@/core";
import { useCanvasControls, useCanvasInteractions, useHotkeys } from "@/hooks";
import { parseSVG, translatePath } from "@/lib/svg-import";
import { useCanvasStore } from "@/store";
import type { CanvasElement, GroupElement, Shape } from "@/types";
import { getElementBounds } from "@/types";
import { CanvasContextMenu } from "./canvas-context-menu";
import { CanvasToolbar } from "./canvas-toolbar";
import { DimensionLabel } from "./dimension-label";
import { LayersPanel } from "./layers-panel";
import { Panel } from "./panel";
import { PropertiesPanel } from "./properties-panel";
import { SmartGuides } from "./smart-guides";
import { TextEditor } from "./text-editor";
import { TextOverlay } from "./text-overlay";

export function WebGLCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const [_isCmdHeld, setIsCmdHeld] = useState(false);

  const {
    elements,
    selectedIds,
    transform,
    activeTool,
    isSpaceHeld,
    isPanning,
    isDragging,
    isResizing,
    isRotating,
    activeResizeHandle,
    selectionBox,
    canvasBackground,
    canvasBackgroundVisible,
    importElements,
  } = useCanvasStore();

  const { handlers, actions } = useCanvasControls();

  // Use centralized hotkeys hook
  useHotkeys({
    onCmdChange: setIsCmdHeld,
  });

  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (screenX - rect.left - transform.x) / transform.scale,
        y: (screenY - rect.top - transform.y) / transform.scale,
      };
    },
    [transform],
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: worldX * transform.scale + transform.x + rect.left,
        y: worldY * transform.scale + transform.y + rect.top,
      };
    },
    [transform],
  );

  const hitTest = useCallback((worldX: number, worldY: number) => hitTestShape(worldX, worldY, elements), [elements]);

  const hitTestHandle = useCallback(
    (worldX: number, worldY: number, element: CanvasElement) => hitTestResizeHandle(worldX, worldY, element),
    [],
  );

  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
    getCursorForHandle,
    getRotationCursorForHandle,
    hoveredHandle,
    activeRotationHandle,
  } = useCanvasInteractions({
    screenToWorld,
    hitTest,
    hitTestResizeHandle: hitTestHandle,
    handlers,
    actions,
  });

  // Handle drag and drop for SVG import
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file.type.includes("svg") && !file.name.endsWith(".svg")) return;

      try {
        const content = await file.text();
        const importedElements = parseSVG(content);
        if (importedElements.length === 0) return;

        // Get drop position in world coordinates
        const dropWorld = screenToWorld(e.clientX, e.clientY);

        // Calculate bounding box of all imported elements
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const el of importedElements) {
          const bounds = getElementBounds(el);
          minX = Math.min(minX, bounds.x);
          minY = Math.min(minY, bounds.y);
          maxX = Math.max(maxX, bounds.x + bounds.width);
          maxY = Math.max(maxY, bounds.y + bounds.height);
        }

        // Calculate offset to position at drop location
        const importedCenterX = (minX + maxX) / 2;
        const importedCenterY = (minY + maxY) / 2;
        const offsetX = dropWorld.x - importedCenterX;
        const offsetY = dropWorld.y - importedCenterY;

        // Apply offset to all elements
        const positionedElements = importedElements.map((el) => {
          if (el.type === "rect" || el.type === "image") {
            return { ...el, x: el.x + offsetX, y: el.y + offsetY };
          }
          if (el.type === "ellipse") {
            return { ...el, cx: el.cx + offsetX, cy: el.cy + offsetY };
          }
          if (el.type === "line") {
            return {
              ...el,
              x1: el.x1 + offsetX,
              y1: el.y1 + offsetY,
              x2: el.x2 + offsetX,
              y2: el.y2 + offsetY,
            };
          }
          if (el.type === "path") {
            return {
              ...el,
              d: translatePath(el.d, offsetX, offsetY),
              bounds: { ...el.bounds, x: el.bounds.x + offsetX, y: el.bounds.y + offsetY },
            };
          }
          if (el.type === "polygon" || el.type === "polyline") {
            return {
              ...el,
              points: el.points.map((pt) => ({ x: pt.x + offsetX, y: pt.y + offsetY })),
            };
          }
          if (el.type === "text") {
            return { ...el, x: el.x + offsetX, y: el.y + offsetY };
          }
          return el;
        });

        importElements(positionedElements);
      } catch (error) {
        console.error("Failed to import dropped SVG:", error);
      }
    },
    [screenToWorld, importElements],
  );

  // Initialize WebGL renderer
  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      const renderer = new WebGLRenderer(canvasRef.current);
      rendererRef.current = renderer;
      renderer.startRenderLoop(() => useCanvasStore.getState());
    } catch (error) {
      console.error("Failed to initialize WebGL:", error);
    }
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Mark renderer dirty when state changes
  useEffect(() => {
    rendererRef.current?.markDirty();
  }, [elements, selectedIds, selectionBox, canvasBackground, canvasBackgroundVisible]);

  // Handle canvas resize
  useEffect(() => {
    const container = containerRef.current;
    const renderer = rendererRef.current;
    if (!container || !renderer) return;

    const handleResize = (entries: ResizeObserverEntry[]) => {
      const { width, height } = entries[0].contentRect;
      renderer.resize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const { width, height } = container.getBoundingClientRect();
    renderer.resize(width, height);

    return () => resizeObserver.disconnect();
  }, []);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (!containerRef.current) return;
      handlers.handleWheel(e, containerRef.current.getBoundingClientRect());
    },
    [handlers],
  );

  const onMouseUp = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

  // Setup event listeners
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Prevent native browser context menu
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("contextmenu", preventContextMenu);
    canvas.addEventListener("dragover", handleDragOver);
    canvas.addEventListener("drop", handleDrop);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("contextmenu", preventContextMenu);
      canvas.removeEventListener("dragover", handleDragOver);
      canvas.removeEventListener("drop", handleDrop);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, onMouseUp, handleDragOver, handleDrop]);

  // Check if hovered handle is a corner (for rotation)
  const isCornerHandle =
    hoveredHandle === "nw" || hoveredHandle === "ne" || hoveredHandle === "se" || hoveredHandle === "sw";

  const isCmdHeld = _isCmdHeld;

  const cursor = isPanning
    ? "grabbing"
    : isRotating
      ? getRotationCursorForHandle(activeRotationHandle)
      : isResizing
        ? getCursorForHandle(activeResizeHandle)
        : isDragging
          ? "move"
          : isCmdHeld && selectedIds.length > 0 && isCornerHandle
            ? getRotationCursorForHandle(hoveredHandle)
            : hoveredHandle
              ? getCursorForHandle(hoveredHandle)
              : isSpaceHeld || activeTool === "pan"
                ? "grab"
                : "default";

  // Calculate bounding box and rotation for selected elements
  const selectionInfo = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const selectedElements = elements.filter((e) => selectedIds.includes(e.id));
    if (selectedElements.length === 0) return null;

    // Helper to recursively get all non-group elements (flattening groups)
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

    // Get all shapes (flatten groups)
    const allShapes = getAllShapes(selectedElements);
    if (allShapes.length === 0) return null;

    // For single non-group element, use its actual bounds and rotation
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
        // Calculate text bounds for dimension display
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

    // For groups or multiple elements, calculate axis-aligned bounding box using rotated corners
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

  return (
    <div ref={containerRef} className="relative h-screen w-full select-none overflow-hidden" style={{ cursor }}>
      <CanvasContextMenu onContextMenu={handleContextMenu}>
        <canvas ref={canvasRef} className="h-full w-full" />
        <TextOverlay canvasRef={canvasRef.current} transform={transform} />
      </CanvasContextMenu>
      <TextEditor worldToScreen={worldToScreen} />
      <SmartGuides />

      {selectionInfo && (
        <DimensionLabel
          bounds={selectionInfo.bounds}
          transform={transform}
          rotation={selectionInfo.rotation}
          isLine={selectionInfo.isLine}
        />
      )}

      <CanvasToolbar />

      {/* Layers Panel */}
      <Panel className="absolute top-0 bottom-0 left-0 border-r border-l-0">
        <LayersPanel />
      </Panel>

      {/* Properties Panel */}
      <Panel className="absolute top-0 right-0 border-r-0 border-l">
        <PropertiesPanel />
      </Panel>
    </div>
  );
}
