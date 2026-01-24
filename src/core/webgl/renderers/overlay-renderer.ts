import type { BoundingBox, RectElement, SelectionBox, Shape } from "@/types";
import { drawHandle, drawLineBetweenPoints, resetRotation } from "../primitives";
import type { RenderContext } from "../types";
import { getRotatedCorners } from "../utils";

export function drawShapeOutline(ctx: RenderContext, shape: Shape, scale: number): void {
  const { gl, program } = ctx;
  const strokeColor: [number, number, number, number] = [0, 0.6, 1, 1];
  const borderWidth = 1.5;

  const corners = getRotatedCorners(shape);
  resetRotation(ctx);

  gl.uniform4f(gl.getUniformLocation(program, "u_color"), ...strokeColor);

  if (shape.type === "line") {
    drawLineBetweenPoints(ctx, corners[0], corners[1], borderWidth, scale);
  } else {
    for (let i = 0; i < 4; i++) {
      drawLineBetweenPoints(ctx, corners[i], corners[(i + 1) % 4], borderWidth, scale);
    }
  }
}

export function drawShapesOutlines(ctx: RenderContext, shapes: Shape[], scale: number): void {
  if (shapes.length === 0) return;

  const { gl, program, positionBuffer } = ctx;
  const strokeColor: [number, number, number, number] = [0, 0.6, 1, 1];
  const borderWidth = 1.5;
  const adjustedWidth = borderWidth / scale;
  const halfWidth = adjustedWidth / 2;

  resetRotation(ctx);
  gl.uniform4f(gl.getUniformLocation(program, "u_color"), ...strokeColor);

  const vertices: number[] = [];

  for (const shape of shapes) {
    const corners = getRotatedCorners(shape);
    const segments: { p1: { x: number; y: number }; p2: { x: number; y: number } }[] = [];

    if (shape.type === "line") {
      segments.push({ p1: corners[0], p2: corners[1] });
    } else {
      for (let i = 0; i < 4; i++) {
        segments.push({ p1: corners[i], p2: corners[(i + 1) % 4] });
      }
    }

    for (const { p1, p2 } of segments) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      const nx = (-dy / len) * halfWidth;
      const ny = (dx / len) * halfWidth;

      vertices.push(
        p1.x - nx,
        p1.y - ny,
        p1.x + nx,
        p1.y + ny,
        p2.x - nx,
        p2.y - ny,
        p2.x - nx,
        p2.y - ny,
        p1.x + nx,
        p1.y + ny,
        p2.x + nx,
        p2.y + ny,
      );
    }
  }

  if (vertices.length > 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
  }
}

export function drawShapeOutlineWithHandles(ctx: RenderContext, shape: Shape, scale: number): void {
  const { gl, program } = ctx;
  const strokeColor: [number, number, number, number] = [0, 0.6, 1, 1];
  const borderWidth = 1.5;

  const corners = getRotatedCorners(shape);
  resetRotation(ctx);

  gl.uniform4f(gl.getUniformLocation(program, "u_color"), ...strokeColor);

  if (shape.type === "line") {
    drawLineBetweenPoints(ctx, corners[0], corners[1], borderWidth, scale);
    drawHandle(ctx, corners[0].x, corners[0].y, scale);
    drawHandle(ctx, corners[1].x, corners[1].y, scale);
  } else {
    for (let i = 0; i < 4; i++) {
      drawLineBetweenPoints(ctx, corners[i], corners[(i + 1) % 4], borderWidth, scale);
    }
    for (const corner of corners) {
      drawHandle(ctx, corner.x, corner.y, scale);
    }
  }
}

export function drawBoundingBoxWithHandles(ctx: RenderContext, bounds: BoundingBox, _isMultiSelect: boolean, scale: number): void {
  const { x, y, width, height } = bounds;
  const { gl, program, positionBuffer } = ctx;

  const strokeColor: [number, number, number, number] = [0, 0.6, 1, 1];
  const borderWidth = 1 / scale;

  resetRotation(ctx);

  gl.uniform4f(gl.getUniformLocation(program, "u_color"), ...strokeColor);

  const borders = [
    [x, y - borderWidth, x + width, y],
    [x, y + height, x + width, y + height + borderWidth],
    [x - borderWidth, y - borderWidth, x, y + height + borderWidth],
    [x + width, y - borderWidth, x + width + borderWidth, y + height + borderWidth],
  ];

  for (const [x1, y1, x2, y2] of borders) {
    const v = new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  const cornerHandles = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];

  for (const handle of cornerHandles) {
    drawHandle(ctx, handle.x, handle.y, scale);
  }
}

export function drawSelectionBox(ctx: RenderContext, box: SelectionBox, scale: number): void {
  const { gl, program, positionBuffer } = ctx;
  const x = Math.min(box.startX, box.endX);
  const y = Math.min(box.startY, box.endY);
  const w = Math.abs(box.endX - box.startX);
  const h = Math.abs(box.endY - box.startY);

  resetRotation(ctx);

  gl.uniform4f(gl.getUniformLocation(program, "u_color"), 0, 0.6, 1, 0.1);
  const fillVerts = new Float32Array([x, y, x + w, y, x, y + h, x, y + h, x + w, y, x + w, y + h]);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, fillVerts, gl.STATIC_DRAW);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  const lw = 1 / scale;
  gl.uniform4f(gl.getUniformLocation(program, "u_color"), 0, 0.6, 1, 1);
  const borders = [
    [x, y, x + w, y + lw],
    [x, y + h - lw, x + w, y + h],
    [x, y, x + lw, y + h],
    [x + w - lw, y, x + w, y + h],
  ];
  for (const [x1, y1, x2, y2] of borders) {
    const v = new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

export function calculateBoundingBox(shapes: Shape[]): BoundingBox {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const shape of shapes) {
    const corners = getRotatedCorners(shape);
    for (const corner of corners) {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    }
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function calculateGroupOBB(shapes: Shape[], rotation: number): RectElement {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);

  for (const shape of shapes) {
    const corners = getRotatedCorners(shape);
    for (const corner of corners) {
      const rx = corner.x * cos - corner.y * sin;
      const ry = corner.x * sin + corner.y * cos;

      minX = Math.min(minX, rx);
      minY = Math.min(minY, ry);
      maxX = Math.max(maxX, rx);
      maxY = Math.max(maxY, ry);
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;

  const alignedCenterX = minX + width / 2;
  const alignedCenterY = minY + height / 2;

  const cosBack = Math.cos(rotation);
  const sinBack = Math.sin(rotation);

  const worldCenterX = alignedCenterX * cosBack - alignedCenterY * sinBack;
  const worldCenterY = alignedCenterX * sinBack + alignedCenterY * cosBack;

  return {
    type: "rect",
    id: "group-obb",
    name: "Group Bounds",
    x: worldCenterX - width / 2,
    y: worldCenterY - height / 2,
    width,
    height,
    rotation,
    fill: null,
    stroke: { color: "#0099ff", width: 1 },
    opacity: 1,
  };
}
