import opentype from "opentype.js";
import type { GroupElement, PathElement, TextElement } from "@/types";

// Return type for text conversion
export interface TextConversionResult {
  group: GroupElement;
  paths: PathElement[];
}

// Map fonts to their file paths (using WOFF format)
const FONT_FILES: Record<string, Record<string, string>> = {
  Inter: {
    "400": "/fonts/Inter-Regular.woff",
    normal: "/fonts/Inter-Regular.woff",
    "700": "/fonts/Inter-Bold.woff",
    bold: "/fonts/Inter-Bold.woff",
  },
};

/**
 * Convert text to actual glyph outlines using opentype.js
 * Processes each glyph individually with proper kerning using forEachGlyph
 */
export async function convertTextToPath(textElement: TextElement): Promise<TextConversionResult> {
  const { text, fontSize, fontFamily, fontWeight = "400", x, y, fill, stroke, opacity, rotation, name } = textElement;

  // Extract font name
  const fontName = fontFamily.split(",")[0].trim().replace(/['"]/g, "");
  const weight = String(fontWeight);

  // Get font file path
  let fontPath = FONT_FILES[fontName]?.[weight] || FONT_FILES[fontName]?.["400"];

  if (!fontPath) {
    fontPath = "/fonts/Inter-Regular.woff";
  }

  // Load the font
  const font = await opentype.load(fontPath);

  // Collect glyph information with proper kerning using forEachGlyph
  const glyphInfos: { glyph: opentype.Glyph; x: number }[] = [];

  // forEachGlyph handles kerning automatically and returns the advance width
  font.forEachGlyph(text, x, y, fontSize, { kerning: true }, (glyph, glyphX) => {
    glyphInfos.push({ glyph, x: glyphX });
  });

  // Create a separate path element for each glyph
  const pathElements: PathElement[] = [];

  for (const { glyph, x: glyphX } of glyphInfos) {
    // Get the path for this glyph at its computed position (with kerning applied)
    const glyphPath = glyph.getPath(glyphX, y, fontSize);

    // Convert to path data with maximum precision
    const pathData = glyphPath.toPathData(15);

    // Skip empty glyphs (like spaces)
    if (!pathData || pathData === "") continue;

    // Get accurate bounding box
    const bbox = glyphPath.getBoundingBox();

    // Skip glyphs with no bounds (spaces, etc.)
    if (bbox.x1 === Infinity || bbox.x2 === -Infinity) continue;

    // Get the character name from the glyph
    const charName = glyph.name || glyph.unicode ? String.fromCodePoint(glyph.unicode!) : "Glyph";

    // Create path element
    const pathElement: PathElement = {
      id: crypto.randomUUID(),
      type: "path",
      name: charName,
      d: pathData,
      bounds: {
        x: bbox.x1,
        y: bbox.y1,
        width: bbox.x2 - bbox.x1,
        height: bbox.y2 - bbox.y1,
      },
      rotation: 0,
      fill: fill || "#000000",
      stroke,
      opacity: opacity ?? 1,
    };

    pathElements.push(pathElement);
  }

  // Create a group containing all the letter paths
  const groupElement: GroupElement = {
    id: crypto.randomUUID(),
    type: "group",
    name: `${name} (Outlined)`,
    childIds: pathElements.map((p) => p.id),
    rotation: rotation || 0,
    opacity: opacity ?? 1,
    visible: true,
    locked: false,
  };

  return {
    group: groupElement,
    paths: pathElements,
  };
}

/**
 * Calculate accurate text bounds using Canvas API
 */
export function calculateTextBounds(textElement: TextElement): { x: number; y: number; width: number; height: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const { text, fontSize, fontFamily, fontWeight = "normal", x, y } = textElement;

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);

  const width = metrics.width;
  const height = fontSize * 1.2;
  const baseline = fontSize * 0.2;

  return {
    x,
    y: y - height + baseline,
    width,
    height,
  };
}
