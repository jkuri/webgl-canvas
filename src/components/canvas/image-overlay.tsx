import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/store";
import type { ImageElement } from "@/types";

interface ImageOverlayProps {
  canvasRef: HTMLCanvasElement | null;
  transform: { x: number; y: number; scale: number };
}

const loadedImages = new Map<string, HTMLImageElement>();

export function ImageOverlay({ canvasRef, transform }: ImageOverlayProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const elements = useCanvasStore((s) => s.elements);

  useEffect(() => {
    if (!overlayRef.current || !canvasRef) return;

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

      const imageElements = elements.filter((e) => e.type === "image") as ImageElement[];

      for (const imageEl of imageElements) {
        if (!mounted) break;

        if (imageEl.visible === false) continue;

        const { x, y, width, height, href, opacity, rotation } = imageEl;

        let img = loadedImages.get(href);

        if (!img) {
          img = new Image();
          const loadPromise = new Promise<void>((resolve, reject) => {
            img!.onload = () => resolve();
            img!.onerror = reject;
          });
          img.src = href;

          try {
            await loadPromise;
            if (!mounted) break;
            loadedImages.set(href, img);
          } catch {
            continue;
          }
        }

        if (!mounted) break;

        ctx.save();

        const centerX = x + width / 2;
        const centerY = y + height / 2;

        if (rotation) {
          ctx.translate(centerX, centerY);
          ctx.rotate(rotation);
          ctx.translate(-centerX, -centerY);
        }

        ctx.globalAlpha = opacity ?? 1;

        ctx.drawImage(img, x, y, width, height);

        ctx.restore();
      }

      ctx.restore();
    };

    render();

    return () => {
      mounted = false;
    };
  }, [canvasRef, elements, transform]);

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
