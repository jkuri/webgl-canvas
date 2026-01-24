import { useCallback, useEffect, useRef, useState } from "react";
import { hitTestResizeHandle, hitTestShape, WebGLRenderer } from "@/core";
import { useCanvasControls, useCanvasInteractions, useHotkeys } from "@/hooks";
import { useFileDrop } from "@/hooks/use-file-drop";
import { useSelectionBounds } from "@/hooks/use-selection-bounds";
import { useCanvasStore } from "@/store";
import type { CanvasElement } from "@/types";
import { CanvasContextMenu } from "./canvas-context-menu";
import { CanvasToolbar } from "./canvas-toolbar";
import { DimensionLabel } from "./dimension-label";
import { ImageOverlay } from "./image-overlay";
import { LayersPanel } from "./layers-panel";
import { Panel } from "./panel";
import { PropertiesPanel } from "./properties-panel";
import { SmartGuides } from "./smart-guides";
import { TextEditor } from "./text-editor";
import { TextOverlay } from "./text-overlay";

interface WebGLCanvasProps {
  isReady?: boolean;
}

export function WebGLCanvas({ isReady = false }: WebGLCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const [isCmdHeld, setIsCmdHeld] = useState(false);

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
    isViewMode,
    importElements,
    loadFromStorage,
  } = useCanvasStore();

  const selectionInfo = useSelectionBounds();

  const { handlers, actions } = useCanvasControls();

  useEffect(() => {
    loadFromStorage();
  }, []);

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

  const { handleDragOver, handleDrop } = useFileDrop({ screenToWorld, importElements });

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

  const hitTest = useCallback(
    (worldX: number, worldY: number, deepSelect = false) => hitTestShape(worldX, worldY, elements, deepSelect),
    [elements],
  );

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

  useEffect(() => {
    rendererRef.current?.markDirty();
  }, [elements, selectedIds, selectionBox, canvasBackground, canvasBackgroundVisible]);

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

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("contextmenu", preventContextMenu);
    canvas.addEventListener("dragover", handleDragOver);
    canvas.addEventListener("drop", handleDrop);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("contextmenu", preventContextMenu);
      canvas.removeEventListener("dragover", handleDragOver);
      canvas.removeEventListener("drop", handleDrop);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, onMouseUp, handleDragOver, handleDrop]);

  const isCornerHandle = hoveredHandle === "nw" || hoveredHandle === "ne" || hoveredHandle === "se" || hoveredHandle === "sw";

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

  return (
    <div ref={containerRef} className="relative h-screen w-full select-none overflow-hidden" style={{ cursor }}>
      <CanvasContextMenu onContextMenu={handleContextMenu}>
        <canvas ref={canvasRef} className="h-full w-full" />
        <ImageOverlay canvasRef={canvasRef.current} transform={transform} />
        <TextOverlay canvasRef={canvasRef.current} transform={transform} fontsReady={isReady} />
      </CanvasContextMenu>

      {!isViewMode && (
        <>
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

          <Panel className="absolute top-0 bottom-0 left-0 border-r border-l-0">
            <LayersPanel />
          </Panel>

          <Panel className="absolute top-0 right-0 border-r-0 border-l">
            <PropertiesPanel />
          </Panel>
        </>
      )}
    </div>
  );
}
