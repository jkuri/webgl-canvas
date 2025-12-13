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

export const SHAPE_COLOR_NAMES = Object.keys(SHAPE_COLORS) as ShapeColorName[];

export function getRandomShapeColor(): RGBAColor {
  const names = SHAPE_COLOR_NAMES;
  return SHAPE_COLORS[names[Math.floor(Math.random() * names.length)]];
}

export function rgbaToCSS(color: RGBAColor): string {
  return `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, ${color[3]})`;
}
