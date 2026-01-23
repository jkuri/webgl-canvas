import { useCallback, useEffect } from "react";
import { useCanvasStore } from "@/store";

interface UseHotkeysOptions {
  onCmdChange?: (held: boolean) => void;
}

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
    setIsEditingText,
  } = useCanvasStore();

  const moveSelectedElements = useCallback(
    (deltaX: number, deltaY: number) => {
      if (selectedIds.length === 0) return;

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
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpaceHeld(true);
      }

      if (e.metaKey || e.ctrlKey) {
        onCmdChange?.(true);
      }

      if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (e.code === "KeyV") setActiveTool("select");
        if (e.code === "KeyH") setActiveTool("pan");
      }

      if (e.code === "Escape") {
        clearSelection();
      }

      if (e.code === "Enter" && selectedIds.length === 1) {
        const element = getElementById(selectedIds[0]);
        if (element?.type === "text" && !element.locked) {
          e.preventDefault();
          setIsEditingText(true, element.id);
        }
      }

      if (selectedIds.length > 0) {
        const step = e.shiftKey ? 10 : 1;

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

      if ((e.code === "Delete" || e.code === "Backspace") && selectedIds.length > 0) {
        e.preventDefault();
        deleteSelected();
      }

      if (e.code === "KeyC" && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        copySelected();
      }

      if (e.code === "KeyV" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        paste();
      }

      if (e.code === "KeyD" && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        duplicateSelected();
      }

      if (e.code === "KeyA" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        selectAll();
      }

      if (e.code === "KeyH" && e.shiftKey && !e.metaKey && !e.ctrlKey && selectedIds.length > 0) {
        e.preventDefault();
        flipHorizontal();
      }

      if (e.code === "KeyV" && e.shiftKey && !e.metaKey && !e.ctrlKey && selectedIds.length > 0) {
        e.preventDefault();
        flipVertical();
      }

      if (e.code === "KeyL" && e.shiftKey && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        toggleLock();
      }

      if (e.code === "KeyG" && (e.metaKey || e.ctrlKey) && !e.shiftKey && selectedIds.length >= 2) {
        e.preventDefault();
        groupSelected();
      }

      if (e.code === "KeyG" && (e.metaKey || e.ctrlKey) && e.shiftKey && selectedIds.length > 0) {
        e.preventDefault();
        ungroupSelected();
      }

      if (e.code === "BracketRight" && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) bringToFront(id);
      }

      if (e.code === "BracketRight" && !e.metaKey && !e.ctrlKey && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) bringForward(id);
      }

      if (e.code === "BracketLeft" && (e.metaKey || e.ctrlKey) && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) sendToBack(id);
      }

      if (e.code === "BracketLeft" && !e.metaKey && !e.ctrlKey && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) sendBackward(id);
      }

      if (e.code === "KeyH" && (e.metaKey || e.ctrlKey) && e.shiftKey && selectedIds.length > 0) {
        e.preventDefault();
        for (const id of selectedIds) {
          const el = getElementById(id);
          if (el) setElementVisibility(id, el.visible === false);
        }
      }

      if (e.code === "KeyZ" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        useCanvasStore.getState().undo();
      }

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
