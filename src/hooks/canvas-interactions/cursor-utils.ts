import type { ResizeHandle } from "@/types";

const cursorCache = new Map<string, string>();

export function createRotatedResizeCursor(angle: number): string {
  const normalizedAngle = ((angle % 360) + 360) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><g transform="rotate(${normalizedAngle} 10 10)"><path d="M3 3L7 3L7 5L5 5L5 7L3 7Z" fill="#fff"/><path d="M17 17L13 17L13 15L15 15L15 13L17 13Z" fill="#fff"/><path d="M5 5L15 15" stroke="#fff" stroke-width="2.5"/><path d="M3 3L7 3L7 5L5 5L5 7L3 7Z" fill="#000"/><path d="M17 17L13 17L13 15L15 15L15 13L17 13Z" fill="#000"/><path d="M5 5L15 15" stroke="#000" stroke-width="1.2"/></g></svg>`;

  const base64 = btoa(svg);
  return `url("data:image/svg+xml;base64,${base64}") 10 10, auto`;
}

export function createRotationCursor(angle: number): string {
  const normalizedAngle = ((angle % 360) + 360) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g transform="rotate(${normalizedAngle} 12 12)"><path d="M12 5C8.13 5 5 8.13 5 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M12 5C8.13 5 5 8.13 5 12" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M12 2L15 5L12 8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 2L15 5L12 8" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L5 15L8 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L5 15L8 12" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

  const base64 = btoa(svg);
  return `url("data:image/svg+xml;base64,${base64}") 12 12, auto`;
}

export function getRotatedRotationCursor(handle: ResizeHandle, shapeRotation: number): string {
  const cornerAngles: Record<string, number> = {
    nw: 0,
    ne: 90,
    se: 180,
    sw: 270,
  };

  if (!handle || !(handle in cornerAngles)) {
    const rotationDegrees = (shapeRotation * 180) / Math.PI;
    const roundedAngle = Math.round(rotationDegrees / 5) * 5;
    const cacheKey = `rotate-${roundedAngle}`;
    if (!cursorCache.has(cacheKey)) {
      cursorCache.set(cacheKey, createRotationCursor(roundedAngle));
    }
    return cursorCache.get(cacheKey)!;
  }

  const baseAngle = cornerAngles[handle];
  const rotationDegrees = (shapeRotation * 180) / Math.PI;
  const finalAngle = baseAngle + rotationDegrees;
  const roundedAngle = Math.round(finalAngle / 5) * 5;
  const cacheKey = `rotate-${roundedAngle}`;

  if (!cursorCache.has(cacheKey)) {
    cursorCache.set(cacheKey, createRotationCursor(roundedAngle));
  }

  return cursorCache.get(cacheKey)!;
}

export function getRotatedCursor(handle: ResizeHandle, rotation: number): string {
  if (!handle) return "default";

  const baseAngles: Record<string, number> = {
    nw: 0,
    se: 0,
    ne: 90,
    sw: 90,
    n: 45,
    s: 45,
    e: -45,
    w: -45,
  };

  const baseAngle = baseAngles[handle] ?? 0;
  const rotationDegrees = (rotation * 180) / Math.PI;
  const finalAngle = baseAngle + rotationDegrees;

  const roundedAngle = Math.round(finalAngle / 5) * 5;
  const cacheKey = `resize-${roundedAngle}`;

  if (!cursorCache.has(cacheKey)) {
    cursorCache.set(cacheKey, createRotatedResizeCursor(roundedAngle));
  }

  return cursorCache.get(cacheKey)!;
}
