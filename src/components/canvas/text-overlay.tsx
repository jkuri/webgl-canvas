import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/store";
import type { TextElement } from "@/types";

interface TextOverlayProps {
  canvasRef: HTMLCanvasElement | null;
  transform: { x: number; y: number; scale: number };
}

/**
 * Canvas 2D overlay for rendering text elements
 * WebGL doesn't handle text rendering well, so we use a separate 2D canvas
 */
export function TextOverlay({ canvasRef, transform }: TextOverlayProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const elements = useCanvasStore((s) => s.elements);
  const isEditingText = useCanvasStore((s) => s.isEditingText);
  const editingTextId = useCanvasStore((s) => s.editingTextId);

  useEffect(() => {
    if (!overlayRef.current || !canvasRef) return;

    const overlay = overlayRef.current;
    const ctx = overlay.getContext("2d")!;

    // Match WebGL canvas size
    const rect = canvasRef.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    overlay.width = rect.width * dpr;
    overlay.height = rect.height * dpr;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    // Clear canvas
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Apply transform
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // Render text elements
    const textElements = elements.filter((e) => e.type === "text") as TextElement[];

    for (const textEl of textElements) {
      // Skip if this text is being edited (editor will render it)
      if (isEditingText && editingTextId === textEl.id) {
        continue;
      }

      if (textEl.visible === false) continue;

      const { x, y, text, fontSize, fontFamily, fontWeight, textAnchor, fill, opacity, rotation } = textEl;

      ctx.save();

      // Apply rotation
      if (rotation) {
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.translate(-x, -y);
      }

      // Set text styles
      ctx.font = `${fontWeight || "normal"} ${fontSize}px ${fontFamily}`;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = (textAnchor as CanvasTextAlign) || "start";
      ctx.globalAlpha = opacity ?? 1;

      // Set fill color
      if (fill) {
        ctx.fillStyle = typeof fill === "string" ? fill : "#000000";
        ctx.fillText(text, x, y);
      }

      // Note: stroke for text is typically not used in design tools
      // If needed, it can be added here similar to fill

      ctx.restore();
    }

    ctx.restore();
  }, [canvasRef, elements, transform, isEditingText, editingTextId]);

  return (
    <canvas
      ref={overlayRef}
      className="pointer-events-none absolute inset-0"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
}
