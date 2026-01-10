import { useEffect, useRef, useState } from "react";
import { calculateTextBounds } from "@/lib/text-to-path";
import { useCanvasStore } from "@/store";
import type { TextElement } from "@/types";

interface TextEditorProps {
  worldToScreen: (worldX: number, worldY: number) => { x: number; y: number };
}

/**
 * Inline text editor component
 * Shows a contentEditable div positioned at the text element location
 */
export function TextEditor({ worldToScreen }: TextEditorProps) {
  const isEditingText = useCanvasStore((s) => s.isEditingText);
  const editingTextId = useCanvasStore((s) => s.editingTextId);
  const elements = useCanvasStore((s) => s.elements);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const setIsEditingText = useCanvasStore((s) => s.setIsEditingText);
  const transform = useCanvasStore((s) => s.transform);

  const inputRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const textElement = elements.find((e) => e.id === editingTextId && e.type === "text") as TextElement | undefined;

  useEffect(() => {
    if (!isEditingText || !textElement || !inputRef.current) return;

    // Calculate screen position - text baseline is at y, so we don't offset
    const screenPos = worldToScreen(textElement.x, textElement.y);
    setPosition(screenPos);

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(inputRef.current);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }, 10);

    return () => clearTimeout(timer);
  }, [isEditingText, textElement, worldToScreen]);

  if (!isEditingText || !textElement) return null;

  const { fontSize, fontFamily, fontWeight, fill } = textElement;
  const fillColor = typeof fill === "string" ? fill : "#000000";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      finishEditing();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
    // Stop propagation to prevent canvas hotkeys
    e.stopPropagation();
  };

  const finishEditing = async () => {
    if (!inputRef.current || !textElement) return;

    const newText = inputRef.current.textContent || "";

    // Update text content
    updateElement(textElement.id, { text: newText });

    // Calculate and update bounds (async) with relative coordinates
    const bounds = await calculateTextBounds({ ...textElement, text: newText, x: 0, y: 0 });
    updateElement(textElement.id, { bounds });

    setIsEditingText(false);
  };

  const cancelEditing = () => {
    setIsEditingText(false);
  };

  return (
    <div
      ref={inputRef}
      contentEditable
      suppressContentEditableWarning
      onKeyDown={handleKeyDown}
      onBlur={finishEditing}
      className="absolute z-50 min-w-5 whitespace-pre border-2 border-blue-500 bg-transparent px-0 outline-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        fontSize: `${fontSize * transform.scale}px`,
        fontFamily,
        fontWeight: fontWeight || "normal",
        color: fillColor,
        transformOrigin: "left baseline",
        transform: "translateY(-1em)",
        lineHeight: "1.2",
        margin: 0,
        padding: "1px",
      }}
    >
      {textElement.text}
    </div>
  );
}
