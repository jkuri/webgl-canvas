/**
 * SVGO Optimization Utility
 *
 * Provides SVG optimization using svgo for cleaner, smaller SVG output.
 */

import { type Config, optimize } from "svgo/browser";

const SVGO_CONFIG: Config = {
  multipass: true,
  plugins: [
    "preset-default",
    "removeDoctype",
    "removeXMLProcInst",
    "removeComments",
    "removeMetadata",
    "removeEditorsNSData",
    "cleanupAttrs",
    "mergeStyles",
    "minifyStyles",
    "cleanupIds",
    "removeUselessDefs",
    "cleanupNumericValues",
    "convertColors",
    "removeUnknownsAndDefaults",
    "removeNonInheritableGroupAttrs",
    "removeUselessStrokeAndFill",
    "cleanupEnableBackground",
    "removeEmptyContainers",
    "removeEmptyAttrs",
    "convertPathData",
    "convertTransform",
    "removeEmptyText",
    "mergePaths",
    "sortAttrs",
    "sortDefsChildren",
  ],
};

/**
 * Optimize an SVG string using svgo
 */
export function optimizeSVG(svgString: string): string {
  try {
    const result = optimize(svgString, SVGO_CONFIG);
    return result.data;
  } catch (error) {
    console.warn("SVGO optimization failed, returning original:", error);
    return svgString;
  }
}
