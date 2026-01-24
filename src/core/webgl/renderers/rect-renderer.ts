import type { RectElement } from "@/types";
import { drawLineBetweenPoints, resetRotation } from "../primitives";
import type { RenderContext } from "../types";
import { cssColorToRGBA, getRotatedCorners } from "../utils";

function drawRectSimple(ctx: RenderContext, element: RectElement): void {
  const { gl, program, positionBuffer, vertexPool } = ctx;
  const { x, y, width, height, fill, rotation, opacity } = element;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  gl.uniform2f(gl.getUniformLocation(program, "u_offset"), 0, 0);

  if (fill) {
    const color = cssColorToRGBA(fill);
    color[3] *= (element.fillOpacity ?? 1) * opacity;

    const vertices = vertexPool;
    vertices[0] = x;
    vertices[1] = y;
    vertices[2] = x + width;
    vertices[3] = y;
    vertices[4] = x;
    vertices[5] = y + height;
    vertices[6] = x;
    vertices[7] = y + height;
    vertices[8] = x + width;
    vertices[9] = y;
    vertices[10] = x + width;
    vertices[11] = y + height;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices.subarray(0, 12), gl.DYNAMIC_DRAW);
    gl.uniform4f(gl.getUniformLocation(program, "u_color"), ...color);
    gl.uniform1f(gl.getUniformLocation(program, "u_rotation"), rotation);
    gl.uniform2f(gl.getUniformLocation(program, "u_rotationCenter"), centerX, centerY);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

export function drawRoundedRect(ctx: RenderContext, element: RectElement, scale: number): void {
  const { gl, program, positionBuffer } = ctx;
  const { x, y, width, height, fill, stroke, rotation, opacity } = element;

  const r = Math.min(element.rx || 0, width / 2, height / 2);
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  const segments = Math.max(16, Math.min(256, Math.ceil(r * scale)));

  const drawFan = (pts: number[]) => {
    const cx = pts[0],
      cy = pts[1];
    const tris: number[] = [];
    for (let i = 2; i < pts.length - 2; i += 2) {
      tris.push(cx, cy, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
    }
    const fV = new Float32Array(tris);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, fV, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, tris.length / 2);
  };

  const cNW = { x: x + r, y: y + r };
  const cNE = { x: x + width - r, y: y + r };
  const cSE = { x: x + width - r, y: y + height - r };
  const cSW = { x: x + r, y: y + height - r };

  const getCornerVertices = (cx: number, cy: number, startAngle: number, endAngle: number) => {
    const verts: number[] = [];
    verts.push(cx, cy);
    for (let i = 0; i <= segments; i++) {
      const ang = startAngle + (i / segments) * (endAngle - startAngle);
      verts.push(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    }
    return verts;
  };

  if (fill) {
    const color = cssColorToRGBA(fill);
    color[3] *= (element.fillOpacity ?? 1) * opacity;

    const vRects: number[] = [];

    const rx = x + r;
    const ry = y;
    const rw = width - 2 * r;
    const rh = height;
    if (rw > 0) {
      vRects.push(rx, ry, rx + rw, ry, rx, ry + rh, rx, ry + rh, rx + rw, ry, rx + rw, ry + rh);
    }

    const lx = x;
    const ly = y + r;
    const lw = r;
    const lh = height - 2 * r;
    if (lh > 0) {
      vRects.push(lx, ly, lx + lw, ly, lx, ly + lh, lx, ly + lh, lx + lw, ly, lx + lw, ly + lh);
    }

    const rix = x + width - r;
    const riy = y + r;
    const riw = r;
    const rih = height - 2 * r;
    if (rih > 0) {
      vRects.push(rix, riy, rix + riw, riy, rix, riy + rih, rix, riy + rih, rix + riw, riy, rix + riw, riy + rih);
    }

    gl.uniform2f(gl.getUniformLocation(program, "u_offset"), 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vRects), gl.STATIC_DRAW);
    gl.uniform4f(gl.getUniformLocation(program, "u_color"), color[0], color[1], color[2], color[3]);
    gl.uniform1f(gl.getUniformLocation(program, "u_rotation"), rotation);
    gl.uniform2f(gl.getUniformLocation(program, "u_rotationCenter"), centerX, centerY);
    gl.drawArrays(gl.TRIANGLES, 0, vRects.length / 2);

    const c1 = getCornerVertices(cNW.x, cNW.y, Math.PI, 1.5 * Math.PI);
    const c2 = getCornerVertices(cNE.x, cNE.y, 1.5 * Math.PI, 2 * Math.PI);
    const c3 = getCornerVertices(cSE.x, cSE.y, 0, 0.5 * Math.PI);
    const c4 = getCornerVertices(cSW.x, cSW.y, 0.5 * Math.PI, Math.PI);

    drawFan(c1);
    drawFan(c2);
    drawFan(c3);
    drawFan(c4);
  }

  if (stroke) {
    const sColor = cssColorToRGBA(stroke.color);
    sColor[3] *= (stroke.opacity ?? 1) * opacity;

    gl.uniform4f(gl.getUniformLocation(program, "u_color"), sColor[0], sColor[1], sColor[2], sColor[3]);
    gl.uniform1f(gl.getUniformLocation(program, "u_rotation"), rotation);
    gl.uniform2f(gl.getUniformLocation(program, "u_rotationCenter"), centerX, centerY);

    const w = stroke.width;

    drawLineBetweenPoints(ctx, { x: x + r, y: y }, { x: x + width - r, y: y }, w, 1);
    drawLineBetweenPoints(ctx, { x: x + r, y: y + height }, { x: x + width - r, y: y + height }, w, 1);
    drawLineBetweenPoints(ctx, { x: x, y: y + r }, { x: x, y: y + height - r }, w, 1);
    drawLineBetweenPoints(ctx, { x: x + width, y: y + r }, { x: x + width, y: y + height - r }, w, 1);

    const drawArcStroke = (cx: number, cy: number, start: number, end: number) => {
      for (let i = 0; i < segments; i++) {
        const a1 = start + (i / segments) * (end - start);
        const a2 = start + ((i + 1) / segments) * (end - start);
        const p1 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r };
        const p2 = { x: cx + Math.cos(a2) * r, y: cy + Math.sin(a2) * r };
        drawLineBetweenPoints(ctx, p1, p2, w, 1);
      }
    };

    drawArcStroke(cNW.x, cNW.y, Math.PI, 1.5 * Math.PI);
    drawArcStroke(cNE.x, cNE.y, 1.5 * Math.PI, 2 * Math.PI);
    drawArcStroke(cSE.x, cSE.y, 0, 0.5 * Math.PI);
    drawArcStroke(cSW.x, cSW.y, 0.5 * Math.PI, Math.PI);
  }
}

export function drawRect(ctx: RenderContext, element: RectElement, scale: number): void {
  const { rx, ry } = element;
  if ((rx || 0) > 0 || (ry || 0) > 0) {
    drawRoundedRect(ctx, element, scale);
    return;
  }

  drawRectSimple(ctx, element);

  if (element.stroke) {
    const { stroke, opacity } = element;
    const { gl, program } = ctx;

    const strokeColor = cssColorToRGBA(stroke.color);
    strokeColor[3] *= (stroke.opacity ?? 1) * opacity;

    resetRotation(ctx);
    gl.uniform4f(gl.getUniformLocation(program, "u_color"), ...strokeColor);

    const corners = getRotatedCorners(element);
    for (let i = 0; i < 4; i++) {
      drawLineBetweenPoints(ctx, corners[i], corners[(i + 1) % 4], stroke.width, 1);
    }
  }
}
