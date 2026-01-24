import { type GroupElement, getFillColor, type PathElement, type TextElement } from "@/types";
import { forEachGlyphCompound, getFont } from "./text-renderer";

export interface TextConversionResult {
  group: GroupElement;
  paths: PathElement[];
}

export async function convertTextToPath(textElement: TextElement): Promise<TextConversionResult> {
  const { text, fontFamily, fontWeight = "400", fill, stroke, opacity, rotation, name } = textElement;

  const fontSize = Number(textElement.fontSize);
  const x = Number(textElement.x);
  const y = Number(textElement.y);

  const fonts = await getFont(fontFamily, fontWeight);

  if (!fonts || fonts.length === 0) {
    throw new Error(`Failed to load font: ${fontFamily}`);
  }

  const glyphInfos: { glyph: opentype.Glyph; x: number; font: opentype.Font }[] = [];

  forEachGlyphCompound(fonts, text, x, y, fontSize, (glyph, glyphX, _glyphY, font) => {
    glyphInfos.push({ glyph, x: glyphX, font });
  });

  const pathElements: PathElement[] = [];

  for (const { glyph, x: glyphX } of glyphInfos) {
    const glyphPath = glyph.getPath(glyphX, y, fontSize);

    const pathData = glyphPath.toPathData(15);

    if (!pathData || pathData === "") continue;

    const bbox = glyphPath.getBoundingBox();

    if (bbox.x1 === Infinity || bbox.x2 === -Infinity) continue;

    const charName = glyph.name || glyph.unicode ? String.fromCodePoint(glyph.unicode!) : "Glyph";

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
      fill: getFillColor(fill, "#000000"),
      stroke,
      opacity: opacity ?? 1,
    };

    pathElements.push(pathElement);
  }

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

export async function calculateTextBounds(textElement: TextElement): Promise<{ x: number; y: number; width: number; height: number }> {
  const { text, fontFamily, fontWeight = "400" } = textElement;
  const fontSize = Number(textElement.fontSize);
  const x = Number(textElement.x);
  const y = Number(textElement.y);

  const fonts = await getFont(fontFamily, fontWeight);

  if (!fonts || fonts.length === 0) {
    return { x, y, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  forEachGlyphCompound(fonts, text, x, y, fontSize, (glyph, gx, gy) => {
    const path = glyph.getPath(gx, gy, fontSize);
    const bbox = path.getBoundingBox();
    if (bbox.x1 < minX) minX = bbox.x1;
    if (bbox.y1 < minY) minY = bbox.y1;
    if (bbox.x2 > maxX) maxX = bbox.x2;
    if (bbox.y2 > maxY) maxY = bbox.y2;
  });

  if (minX === Infinity) return { x, y, width: 0, height: 0 };

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
