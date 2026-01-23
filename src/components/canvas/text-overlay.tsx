import type opentype from "opentype.js";
import { useEffect, useRef } from "react";
import { drawTextWithOpenType, getFont } from "@/lib/text-renderer";
import { useCanvasStore } from "@/store";
import type { TextElement } from "@/types";

interface TextOverlayProps {
  canvasRef: HTMLCanvasElement | null;
  transform: { x: number; y: number; scale: number };
  fontsReady?: boolean;
}

const loadedFonts = new Map<string, opentype.Font[]>();

export function TextOverlay({ canvasRef, transform, fontsReady = false }: TextOverlayProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const elements = useCanvasStore((s) => s.elements);
  const isEditingText = useCanvasStore((s) => s.isEditingText);
  const editingTextId = useCanvasStore((s) => s.editingTextId);

  useEffect(() => {
    if (!overlayRef.current || !canvasRef || !fontsReady) return;

    let mounted = true;
    const overlay = overlayRef.current;
    const ctx = overlay.getContext("2d")!;

    const rect = canvasRef.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    overlay.width = rect.width * dpr;
    overlay.height = rect.height * dpr;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    const render = async () => {
      if (!mounted) return;

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      const textElements = elements.filter((e) => e.type === "text") as TextElement[];

      for (const textEl of textElements) {
        if (!mounted) break;

        if (isEditingText && editingTextId === textEl.id) {
          continue;
        }

        if (textEl.visible === false) continue;

        const { x, y, text, fontSize, fontFamily, fontWeight, fill, opacity, rotation } = textEl;

        const fontKey = `${fontFamily}-${fontWeight || "400"}`;
        let fonts = loadedFonts.get(fontKey);

        if (!fonts) {
          const loaded = await getFont(fontFamily, fontWeight || "400");
          if (loaded) {
            fonts = loaded;
            loadedFonts.set(fontKey, fonts);
          }
        }

        if (!mounted) break;

        if (!fonts || fonts.length === 0) {
          ctx.save();
          if (rotation) {
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.translate(-x, -y);
          }
          ctx.font = `${fontWeight || "normal"} ${fontSize}px ${fontFamily}`;
          ctx.textBaseline = "alphabetic";
          ctx.globalAlpha = opacity ?? 1;
          if (fill) {
            ctx.fillStyle = typeof fill === "string" ? fill : "#000000";
            ctx.fillText(text, x, y);
          }
          ctx.restore();
          continue;
        }

        ctx.save();

        let centerX: number;
        let centerY: number;
        if (textEl.bounds) {
          centerX = x + textEl.bounds.x + textEl.bounds.width / 2;
          centerY = y + textEl.bounds.y + textEl.bounds.height / 2;
        } else {
          const estWidth = text.length * fontSize * 0.6;
          const estHeight = fontSize * 1.2;
          centerX = x + estWidth / 2;
          centerY = y - fontSize + estHeight / 2;
        }

        if (rotation) {
          ctx.translate(centerX, centerY);
          ctx.rotate(rotation);
          ctx.translate(-centerX, -centerY);
        }

        ctx.globalAlpha = opacity ?? 1;

        const fillColor = fill ? (typeof fill === "string" ? fill : "#000000") : null;

        drawTextWithOpenType(ctx, fonts, text, x, y, fontSize, {
          fill: fillColor,
        });

        ctx.restore();
      }

      ctx.restore();
    };

    render();

    return () => {
      mounted = false;
    };
  }, [canvasRef, elements, transform, isEditingText, editingTextId, fontsReady]);

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
