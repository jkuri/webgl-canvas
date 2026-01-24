import { cssToRGBA } from "@/lib/colors";
import type { ImageElement, Shape, TextElement } from "@/types";

export function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

export function createProgram(gl: WebGLRenderingContext, vertexSrc: string, fragmentSrc: string): WebGLProgram {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

export function cssColorToRGBA(color: string | { ref: string; type: "gradient" | "pattern" } | null): [number, number, number, number] {
  if (!color) return [0, 0, 0, 0];

  if (typeof color === "object" && "ref" in color) {
    return [0.5, 0.5, 0.5, 1];
  }
  return cssToRGBA(color);
}

export function getRotatedCorners(shape: Shape): { x: number; y: number }[] {
  switch (shape.type) {
    case "rect": {
      const { x, y, width, height, rotation } = shape;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      return [
        { x: x, y: y },
        { x: x + width, y: y },
        { x: x + width, y: y + height },
        { x: x, y: y + height },
      ].map((corner) => ({
        x: centerX + (corner.x - centerX) * cos - (corner.y - centerY) * sin,
        y: centerY + (corner.x - centerX) * sin + (corner.y - centerY) * cos,
      }));
    }
    case "ellipse": {
      const { cx, cy, rx, ry, rotation } = shape;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      return [
        { x: cx - rx, y: cy - ry },
        { x: cx + rx, y: cy - ry },
        { x: cx + rx, y: cy + ry },
        { x: cx - rx, y: cy + ry },
      ].map((corner) => ({
        x: cx + (corner.x - cx) * cos - (corner.y - cy) * sin,
        y: cy + (corner.x - cx) * sin + (corner.y - cy) * cos,
      }));
    }
    case "line":
      return [
        { x: shape.x1, y: shape.y1 },
        { x: shape.x2, y: shape.y2 },
      ];
    case "path": {
      const { x, y, width, height } = shape.bounds;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const cos = Math.cos(shape.rotation);
      const sin = Math.sin(shape.rotation);
      return [
        { x: x, y: y },
        { x: x + width, y: y },
        { x: x + width, y: y + height },
        { x: x, y: y + height },
      ].map((corner) => ({
        x: centerX + (corner.x - centerX) * cos - (corner.y - centerY) * sin,
        y: centerY + (corner.x - centerX) * sin + (corner.y - centerY) * cos,
      }));
    }
    case "text": {
      let width: number;
      let height: number;
      let boundsX: number;
      let boundsY: number;

      const textShape = shape as TextElement;

      if (textShape.bounds) {
        width = textShape.bounds.width;
        height = textShape.bounds.height;

        boundsX = textShape.x + textShape.bounds.x;
        boundsY = textShape.y + textShape.bounds.y;
      } else {
        width = textShape.text.length * textShape.fontSize * 0.6;
        height = textShape.fontSize * 1.2;
        boundsX = textShape.x;
        boundsY = textShape.y - textShape.fontSize;
      }

      const centerX = boundsX + width / 2;
      const centerY = boundsY + height / 2;
      const cos = Math.cos(shape.rotation);
      const sin = Math.sin(shape.rotation);

      return [
        { x: boundsX, y: boundsY },
        { x: boundsX + width, y: boundsY },
        { x: boundsX + width, y: boundsY + height },
        { x: boundsX, y: boundsY + height },
      ].map((corner) => ({
        x: centerX + (corner.x - centerX) * cos - (corner.y - centerY) * sin,
        y: centerY + (corner.x - centerX) * sin + (corner.y - centerY) * cos,
      }));
    }
    case "image": {
      const imageShape = shape as ImageElement;
      const { x, y, width, height, rotation } = imageShape;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      return [
        { x: x, y: y },
        { x: x + width, y: y },
        { x: x + width, y: y + height },
        { x: x, y: y + height },
      ].map((corner) => ({
        x: centerX + (corner.x - centerX) * cos - (corner.y - centerY) * sin,
        y: centerY + (corner.x - centerX) * sin + (corner.y - centerY) * cos,
      }));
    }
    default:
      return [];
  }
}
