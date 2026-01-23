export type RGBAColor = [number, number, number, number];

export const TAILWIND_COLORS = {
  slate: "#64748b",
  gray: "#6b7280",
  zinc: "#71717a",
  neutral: "#737373",
  stone: "#78716c",

  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#22c55e",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  sky: "#0ea5e9",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  purple: "#a855f7",
  fuchsia: "#d946ef",
  pink: "#ec4899",
  rose: "#f43f5e",
} as const;

export const COLOR_PICKER_PRESETS = [
  "#000000",
  "#ffffff",
  "#f5f5f5",
  "#d4d4d4",
  "#737373",
  "#404040",
  "#171717",
  "#0a0a0a",

  "#fecaca",
  "#f87171",
  "#ef4444",
  "#dc2626",
  "#fed7aa",
  "#fb923c",
  "#f97316",
  "#ea580c",

  "#fef08a",
  "#facc15",
  "#eab308",
  "#ca8a04",
  "#bbf7d0",
  "#4ade80",
  "#22c55e",
  "#16a34a",

  "#a7f3d0",
  "#34d399",
  "#10b981",
  "#059669",
  "#a5f3fc",
  "#22d3ee",
  "#06b6d4",
  "#0891b2",

  "#bfdbfe",
  "#60a5fa",
  "#3b82f6",
  "#2563eb",
  "#c7d2fe",
  "#818cf8",
  "#6366f1",
  "#4f46e5",

  "#ddd6fe",
  "#a78bfa",
  "#8b5cf6",
  "#7c3aed",
  "#f5d0fe",
  "#e879f9",
  "#d946ef",
  "#c026d3",

  "#fbcfe8",
  "#f472b6",
  "#ec4899",
  "#db2777",
  "#fecdd3",
  "#fb7185",
  "#f43f5e",
  "#e11d48",
] as const;

export type ShapeColorName = "Blue" | "Cyan" | "Emerald" | "Fuchsia" | "Green" | "Indigo" | "Lime" | "Orange" | "Pink";

export const SHAPE_COLORS: Record<ShapeColorName, RGBAColor> = {
  Blue: [0.239, 0.525, 0.996, 1],
  Cyan: [0.063, 0.725, 0.82, 1],
  Emerald: [0.063, 0.725, 0.506, 1],
  Fuchsia: [0.851, 0.275, 0.937, 1],
  Green: [0.133, 0.773, 0.369, 1],
  Indigo: [0.388, 0.4, 0.945, 1],
  Lime: [0.518, 0.78, 0.086, 1],
  Orange: [0.976, 0.451, 0.086, 1],
  Pink: [0.925, 0.282, 0.6, 1],
};

export const SHAPE_COLORS_CSS: Record<ShapeColorName, string> = {
  Blue: "#3B82F6",
  Cyan: "#06B6D4",
  Emerald: "#10B981",
  Fuchsia: "#D946EF",
  Green: "#22C55E",
  Indigo: "#6366F1",
  Lime: "#84CC16",
  Orange: "#F97316",
  Pink: "#EC4899",
};

export const SHAPE_COLOR_NAMES = Object.keys(SHAPE_COLORS) as ShapeColorName[];

export function getRandomShapeColorCSS(): string {
  const colors = Object.values(TAILWIND_COLORS);
  return colors[Math.floor(Math.random() * colors.length)];
}

export function cssToRGBA(css: string): RGBAColor {
  if (css.startsWith("#")) {
    const hex = css.slice(1);
    if (hex.length === 3) {
      const r = Number.parseInt(hex[0] + hex[0], 16) / 255;
      const g = Number.parseInt(hex[1] + hex[1], 16) / 255;
      const b = Number.parseInt(hex[2] + hex[2], 16) / 255;
      return [r, g, b, 1];
    }
    if (hex.length === 6) {
      const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
      const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
      const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
      return [r, g, b, 1];
    }
    if (hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
      const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
      const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
      const a = Number.parseInt(hex.slice(6, 8), 16) / 255;
      return [r, g, b, a];
    }
  }

  const rgbaMatch = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return [
      Number.parseInt(rgbaMatch[1], 10) / 255,
      Number.parseInt(rgbaMatch[2], 10) / 255,
      Number.parseInt(rgbaMatch[3], 10) / 255,
      rgbaMatch[4] ? Number.parseFloat(rgbaMatch[4]) : 1,
    ];
  }

  return [0.5, 0.5, 0.5, 1];
}
