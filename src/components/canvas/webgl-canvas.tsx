import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRotatedCorners, getShapesInBox, hitTestResizeHandle, hitTestShape, WebGLRenderer } from "@/core";
import { useCanvasControls, useCanvasInteractions } from "@/hooks";
import { useCanvasStore } from "@/store";
import type { CanvasElement, Shape } from "@/types";
import { CanvasContextMenu } from "./canvas-context-menu";
import { CanvasMenubar } from "./canvas-menubar";
import { CanvasToolbar } from "./canvas-toolbar";
import { DimensionLabel } from "./dimension-label";
import { LayersPanel } from "./layers-panel";
import { Panel } from "./panel";
import { PropertiesPanel } from "./properties-panel";

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
        width: Math.abs(element.x2 - element.x1) || 1,
        height: Math.abs(element.y2 - element.y1) || 1,
      };
    }
    case "path":
      return element.bounds;
    case "group":
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

export function WebGLCanvas() {
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
    setIsSpaceHeld,
    setActiveTool,
    clearSelection,
    deleteSelected,
    duplicateSelected,
    copySelected,
    paste,
    flipHorizontal,
    flipVertical,
    toggleLock,
    groupSelected,
    ungroupSelected,
  } = useCanvasStore();

  const { handlers, actions } = useCanvasControls();

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
  }, [elements, selectedIds, selectionBox]);

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
      if (e.ctrlKey || e.metaKey) {
        actions.zoomIn();
        return;
      }
      if (!containerRef.current) return;
      handlers.handleWheel(e, containerRef.current.getBoundingClientRect());
    },
    [handlers, actions],
  );

  const onMouseUp = useCallback(() => {
    handleMouseUp((box) => getShapesInBox(box, elements));
  }, [handleMouseUp, elements]);

  // Setup event listeners
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpaceHeld(true);
      }
      if (e.metaKey || e.ctrlKey) setIsCmdHeld(true);

      // Tool shortcuts (only when no modifier)
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (e.code === "KeyV") setActiveTool("select");
        if (e.code === "KeyH") setActiveTool("pan");
      }

      if (e.code === "Escape") clearSelection();

      // Delete
      if ((e.code === "Delete" || e.code === "Backspace") && selectedIds.length > 0) {
        deleteSelected();
      }

      // Copy (Cmd+C)
      if (e.code === "KeyC" && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        copySelected();
      }

      // Paste (Cmd+V)
      if (e.code === "KeyV" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        paste();
      }

      // Duplicate (Cmd+D)
      if (e.code === "KeyD" && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        duplicateSelected();
      }

      // Flip Horizontal (Shift+H)
      if (e.code === "KeyH" && e.shiftKey && !e.metaKey && !e.ctrlKey && selectedIds.length > 0) {
        e.preventDefault();
        flipHorizontal();
      }

      // Flip Vertical (Shift+V)
      if (e.code === "KeyV" && e.shiftKey && !e.metaKey && !e.ctrlKey && selectedIds.length > 0) {
        e.preventDefault();
        flipVertical();
      }

      // Lock/Unlock (Shift+Cmd+L)
      if (e.code === "KeyL" && e.shiftKey && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        toggleLock();
      }

      // Group (Cmd+G)
      if (e.code === "KeyG" && (e.metaKey || e.ctrlKey) && !e.shiftKey && selectedIds.length > 1) {
        e.preventDefault();
        groupSelected();
      }

      // Ungroup (Cmd+Shift+G)
      if (e.code === "KeyG" && (e.metaKey || e.ctrlKey) && e.shiftKey && selectedIds.length > 0) {
        e.preventDefault();
        ungroupSelected();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpaceHeld(false);
      if (!e.metaKey && !e.ctrlKey) setIsCmdHeld(false);
    };

    // Prevent native browser context menu
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("contextmenu", preventContextMenu);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("contextmenu", preventContextMenu);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    onMouseUp,
    selectedIds,
    deleteSelected,
    duplicateSelected,
    copySelected,
    paste,
    flipHorizontal,
    flipVertical,
    toggleLock,
    groupSelected,
    ungroupSelected,
    setIsSpaceHeld,
    setActiveTool,
    clearSelection,
  ]);

  // Check if hovered handle is a corner (for rotation)
  const isCornerHandle =
    hoveredHandle === "nw" || hoveredHandle === "ne" || hoveredHandle === "se" || hoveredHandle === "sw";

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

    // For single element, use its actual bounds and rotation
    if (selectedElements.length === 1) {
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
        };
      }

      const bounds = getElementBoundsLocal(element);
      return {
        bounds,
        rotation: element.rotation,
      };
    }

    // For multiple elements, calculate axis-aligned bounding box using rotated corners
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const element of selectedElements) {
      if (element.type === "group") continue;
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
    };
  }, [selectedIds, elements]);

  return (
    <div ref={containerRef} className="relative h-screen w-full select-none overflow-hidden" style={{ cursor }}>
      <CanvasContextMenu onContextMenu={handleContextMenu}>
        <canvas ref={canvasRef} className="h-full w-full" />
      </CanvasContextMenu>

      {selectionInfo && (
        <DimensionLabel bounds={selectionInfo.bounds} transform={transform} rotation={selectionInfo.rotation} />
      )}

      <CanvasMenubar />
      <CanvasToolbar />

      {/* Layers Panel */}
      <Panel className="absolute top-0 left-0 border-r border-l-0">
        <LayersPanel />
      </Panel>

      {/* Properties Panel */}
      <Panel className="absolute top-0 right-0 border-r-0 border-l">
        <PropertiesPanel />
      </Panel>
    </div>
  );
}
