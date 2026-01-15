import { useCallback, useEffect } from "react";
import { useCanvasStore } from "@/store";

interface UseHotkeysOptions {
  /** Callback when cmd/ctrl key state changes */
  onCmdChange?: (held: boolean) => void;
}

/**
 * Centralized keyboard shortcuts hook for the canvas.
 * Handles all keyboard shortcuts including arrow key positioning.
 */
export function useHotkeys(options: UseHotkeysOptions = {}) {
  const { onCmdChange } = options;

  const {
    selectedIds,
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
    selectAll,
    getElementById,
    updateElement,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    setElementVisibility,
  } = useCanvasStore();

  /**
   * Move selected elements by the specified delta.
   * Handles all element types properly.
   */
  const moveSelectedElements = useCallback(
    (deltaX: number, deltaY: number) => {
      if (selectedIds.length === 0) return;

      // Collect all element IDs to move (including group children)
      const idsToMove = new Set<string>();

      const collectIds = (ids: string[]) => {
        for (const id of ids) {
          const element = getElementById(id);
          if (!element) continue;

          if (element.type === "group") {
            collectIds(element.childIds);
          } else {
            idsToMove.add(id);
          }
        }
      };

      collectIds(selectedIds);

      // Move each element
      for (const id of idsToMove) {
        const element = getElementById(id);
        if (!element || element.locked) continue;

        switch (element.type) {
          case "rect":
          case "image":
            updateElement(id, { x: element.x + deltaX, y: element.y + deltaY });
            break;
          case "ellipse":
            updateElement(id, { cx: element.cx + deltaX, cy: element.cy + deltaY });
            break;
          case "line":
            updateElement(id, {
              x1: element.x1 + deltaX,
              y1: element.y1 + deltaY,
              x2: element.x2 + deltaX,
              y2: element.y2 + deltaY,
            });
            break;
          case "path":
            updateElement(id, {
              bounds: {
                ...element.bounds,
                x: element.bounds.x + deltaX,
                y: element.bounds.y + deltaY,
              },
            });
            break;
          case "text":
            updateElement(id, { x: element.x + deltaX, y: element.y + deltaY });
            break;
          case "polygon":
          case "polyline":
            updateElement(id, {
              points: element.points.map((pt) => ({
                x: pt.x + deltaX,
                y: pt.y + deltaY,
              })),
            });
            break;
        }
      }
    },
    [selectedIds, getElementById, updateElement],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Space - pan mode
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpaceHeld(true);
      }

      // Track cmd/ctrl state
      if (e.metaKey || e.ctrlKey) {
        onCmdChange?.(true);
      }

      // --- Tool shortcuts (no modifiers) ---
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (e.code === "KeyV") setActiveTool("select");
        if (e.code === "KeyH") setActiveTool("pan");
      }

      // Escape - clear selection
      if (e.code === "Escape") {
        clearSelection();
      }

      // --- Arrow keys - move selected elements ---
      if (selectedIds.length > 0) {
        const step = e.shiftKey ? 10 : 1; // Shift = 10px, normal = 1px

        if (e.code === "ArrowUp") {
          e.preventDefault();
          moveSelectedElements(0, -step);
        }
        if (e.code === "ArrowDown") {
          e.preventDefault();
          moveSelectedElements(0, step);
        }
        if (e.code === "ArrowLeft") {
          e.preventDefault();
          moveSelectedElements(-step, 0);
        }
        if (e.code === "ArrowRight") {
          e.preventDefault();
          moveSelectedElements(step, 0);
        }
      }

      // --- Delete ---
      if ((e.code === "Delete" || e.code === "Backspace") && selectedIds.length > 0) {
        e.preventDefault();
        deleteSelected();
      }

      // --- Copy (Cmd+C) ---
      if (e.code === "KeyC" && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        copySelected();
      }

      // --- Paste (Cmd+V) ---
      if (e.code === "KeyV" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        paste();
      }

      // --- Duplicate (Cmd+D) ---
      if (e.code === "KeyD" && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        duplicateSelected();
      }

      // --- Select All (Cmd+A) ---
      if (e.code === "KeyA" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        selectAll();
      }

      // --- Flip Horizontal (Shift+H) ---
      if (e.code === "KeyH" && e.shiftKey && !e.metaKey && !e.ctrlKey && selectedIds.length > 0) {
        e.preventDefault();
        flipHorizontal();
      }

      // --- Flip Vertical (Shift+V) ---
      if (e.code === "KeyV" && e.shiftKey && !e.metaKey && !e.ctrlKey && selectedIds.length > 0) {
        e.preventDefault();
        flipVertical();
      }

      // --- Lock/Unlock (Shift+Cmd+L) ---
      if (e.code === "KeyL" && e.shiftKey && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        toggleLock();
      }

      // --- Group (Cmd+G) ---
      if (e.code === "KeyG" && (e.metaKey || e.ctrlKey) && !e.shiftKey && selectedIds.length >= 2) {
        e.preventDefault();
        groupSelected();
      }

      // --- Ungroup (Cmd+Shift+G) ---
      if (e.code === "KeyG" && (e.metaKey || e.ctrlKey) && e.shiftKey && selectedIds.length > 0) {
        e.preventDefault();
        ungroupSelected();
      }

      // --- Layer ordering ---
      // Bring to Front (Cmd+])
      if (e.code === "BracketRight" && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) bringToFront(id);
      }

      // Bring Forward (])
      if (e.code === "BracketRight" && !e.metaKey && !e.ctrlKey && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) bringForward(id);
      }

      // Send to Back (Cmd+[)
      if (e.code === "BracketLeft" && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) sendToBack(id);
      }

      // Send Backward ([)
      if (e.code === "BracketLeft" && !e.metaKey && !e.ctrlKey && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) sendBackward(id);
      }

      // --- Show/Hide (Cmd+Shift+H) ---
      if (e.code === "KeyH" && (e.metaKey || e.ctrlKey) && e.shiftKey && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) {
          const el = getElementById(id);
          if (el) setElementVisibility(id, el.visible === false);
        }
      }

      // --- Undo (Cmd+Z) ---
      if (e.code === "KeyZ" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        useCanvasStore.getState().undo();
      }

      // --- Redo (Cmd+Shift+Z) ---
      if (e.code === "KeyZ" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        useCanvasStore.getState().redo();
      }
    },
    [
      selectedIds,
      setIsSpaceHeld,
      setActiveTool,
      clearSelection,
      deleteSelected,
      copySelected,
      paste,
      duplicateSelected,
      selectAll,
      flipHorizontal,
      flipVertical,
      toggleLock,
      groupSelected,
      ungroupSelected,
      moveSelectedElements,
      onCmdChange,
      bringToFront,
      sendToBack,
      bringForward,
      sendBackward,
      getElementById,
      setElementVisibility,
    ],
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpaceHeld(false);
      }
      if (!e.metaKey && !e.ctrlKey) {
        onCmdChange?.(false);
      }
    },
    [setIsSpaceHeld, onCmdChange],
  );

  // Attach global keyboard listeners
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    moveSelectedElements,
  };
}
