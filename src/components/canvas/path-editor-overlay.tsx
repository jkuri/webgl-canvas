import React from "react";
import { usePathEditor } from "@/hooks/use-path-editor";
import { useCanvasStore } from "@/store";

interface PathEditorOverlayProps {
  screenToWorld: (x: number, y: number) => { x: number; y: number };
  worldToScreen: (x: number, y: number) => { x: number; y: number };
}

export function PathEditorOverlay({ screenToWorld, worldToScreen }: PathEditorOverlayProps) {
  const isEditing = useCanvasStore((s) => !!s.editingPathId);
  const selectedPointIndices = useCanvasStore((s) => s.selectedPointIndices);

  const { editablePoints, handleMouseDown, handleMouseMove, handleMouseUp } = usePathEditor(screenToWorld);

  React.useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  if (!isEditing) return null;

  const ANCHOR_SIZE = 8;
  const HANDLE_SIZE = 6;

  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible" style={{ width: "100%", height: "100%" }}>
      {editablePoints.map((p, i) => {
        const screenP = worldToScreen(p.x, p.y);
        const lines = [];

        if (p.handleIn) {
          const screenH = worldToScreen(p.handleIn.x, p.handleIn.y);
          lines.push(
            <line key={`line-in-${i}`} x1={screenP.x} y1={screenP.y} x2={screenH.x} y2={screenH.y} stroke="#1a73e8" strokeWidth={1} />,
          );
        }

        if (p.handleOut) {
          const screenH = worldToScreen(p.handleOut.x, p.handleOut.y);
          lines.push(
            <line key={`line-out-${i}`} x1={screenP.x} y1={screenP.y} x2={screenH.x} y2={screenH.y} stroke="#1a73e8" strokeWidth={1} />,
          );
        }
        return lines;
      })}

      {editablePoints.map((p, i) => {
        const screenP = worldToScreen(p.x, p.y);
        const elements = [];

        if (p.handleIn) {
          const screenH = worldToScreen(p.handleIn.x, p.handleIn.y);
          elements.push(
            <circle
              key={`handle-in-${i}`}
              cx={screenH.x}
              cy={screenH.y}
              r={HANDLE_SIZE / 2}
              fill="white"
              stroke="#1a73e8"
              strokeWidth={1}
              className="pointer-events-auto cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => handleMouseDown(e, "handleIn", i)}
            />,
          );
        }

        if (p.handleOut) {
          const screenH = worldToScreen(p.handleOut.x, p.handleOut.y);
          elements.push(
            <circle
              key={`handle-out-${i}`}
              cx={screenH.x}
              cy={screenH.y}
              r={HANDLE_SIZE / 2}
              fill="white"
              stroke="#1a73e8"
              strokeWidth={1}
              className="pointer-events-auto cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => handleMouseDown(e, "handleOut", i)}
            />,
          );
        }

        const isSelected = selectedPointIndices.includes(i);
        elements.push(
          <circle
            key={`anchor-${i}`}
            cx={screenP.x}
            cy={screenP.y}
            r={ANCHOR_SIZE / 2}
            fill={isSelected ? "#1a73e8" : "white"}
            stroke="#1a73e8"
            strokeWidth={1}
            className="pointer-events-auto cursor-move"
            onMouseDown={(e) => handleMouseDown(e, "anchor", i)}
          />,
        );

        return elements;
      })}
    </svg>
  );
}
