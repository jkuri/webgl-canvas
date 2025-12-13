// Tailwind color palette (500 shades) for shapes
// Values are RGBA arrays normalized to 0-1 range for WebGL

export type ShapeColorName = "Blue" | "Cyan" | "Emerald" | "Fuchsia" | "Green" | "Indigo" | "Lime" | "Orange" | "Pink";

export type RGBAColor = [number, number, number, number];

export const SHAPE_COLORS: Record<ShapeColorName, RGBAColor> = {
  Blue: [0.239, 0.525, 0.996, 1], // #3B82F6
  Cyan: [0.063, 0.725, 0.82, 1], // #06B6D4
  Emerald: [0.063, 0.725, 0.506, 1], // #10B981
  Fuchsia: [0.851, 0.275, 0.937, 1], // #D946EF
  Green: [0.133, 0.773, 0.369, 1], // #22C55E
  Indigo: [0.388, 0.4, 0.945, 1], // #6366F1
  Lime: [0.518, 0.78, 0.086, 1], // #84CC16
  Orange: [0.976, 0.451, 0.086, 1], // #F97316
  Pink: [0.925, 0.282, 0.6, 1], // #EC4899
};

// CSS color versions for SVG-style Fill property
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

export function getRandomShapeColor(): RGBAColor {
  const names = SHAPE_COLOR_NAMES;
  return SHAPE_COLORS[names[Math.floor(Math.random() * names.length)]];
}

export function getRandomShapeColorCSS(): string {
  const names = SHAPE_COLOR_NAMES;
  return SHAPE_COLORS_CSS[names[Math.floor(Math.random() * names.length)]];
}

export function rgbaToCSS(color: RGBAColor): string {
  return `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${color[3]})`;
}

export function cssToRGBA(css: string): RGBAColor {
  // Handle hex colors
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
  // Handle rgba()
  const rgbaMatch = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return [
      Number.parseInt(rgbaMatch[1], 10) / 255,
      Number.parseInt(rgbaMatch[2], 10) / 255,
      Number.parseInt(rgbaMatch[3], 10) / 255,
      rgbaMatch[4] ? Number.parseFloat(rgbaMatch[4]) : 1,
    ];
  }
  // Default fallback
  return [0.5, 0.5, 0.5, 1];
}
