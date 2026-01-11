import { ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CanvasElement, EllipseElement, LineElement } from "@/types";

// Section Header
export function SectionHeader({ title }: { title: string }) {
  return <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">{title}</span>;
}

// Icons
export const RotateIcon = () => (
  <svg
    className="size-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    transform="scale(-1, 1)"
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

export const WeightIcon = () => (
  <svg
    className="size-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="21" x2="3" y1="6" y2="6" />
    <line x1="21" x2="3" y1="12" y2="12" />
    <line x1="21" x2="3" y1="18" y2="18" />
  </svg>
);

export const EyeIcon = () => (
  <svg
    className="size-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = () => <HugeiconsIcon icon={ViewOffSlashIcon} className="size-3.5" />;

// Helper Types
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

// Helper to get bounds from element
export function getElementBounds(element: CanvasElement): Bounds {
  if (element.type === "rect") {
    return {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation || 0,
    };
  }
  if (element.type === "ellipse") {
    const el = element as EllipseElement;
    return {
      x: el.cx - el.rx,
      y: el.cy - el.ry,
      width: el.rx * 2,
      height: el.ry * 2,
      rotation: el.rotation || 0,
    };
  }
  if (element.type === "line") {
    const el = element as LineElement;
    const dx = el.x2 - el.x1;
    const dy = el.y2 - el.y1;
    return {
      x: (el.x1 + el.x2) / 2,
      y: (el.y1 + el.y2) / 2,
      width: Math.sqrt(dx * dx + dy * dy),
      height: 0,
      rotation: Math.atan2(dy, dx),
    };
  }
  if (element.type === "image") {
    return {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation || 0,
    };
  }
  return { x: 0, y: 0, width: 0, height: 0, rotation: element.rotation || 0 };
}
