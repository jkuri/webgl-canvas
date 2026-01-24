import type { EllipseElement } from "@/types";
import { drawLineBetweenPoints, resetRotation } from "../primitives";
import type { RenderContext } from "../types";
import { cssColorToRGBA } from "../utils";

export function drawEllipse(ctx: RenderContext, element: EllipseElement, _scale: number): void {
  const { cx, cy, rx, ry, fill, stroke, rotation, opacity } = element;
  const { gl, positionBuffer } = ctx;
  const segments = Math.max(32, Math.ceil(Math.max(rx, ry) / 2));

  if (fill) {
    const color = cssColorToRGBA(fill);
    color[3] *= (element.fillOpacity ?? 1) * opacity;

    const vertices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      vertices.push(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
    }

    vertices.push(cx + rx, cy);

    const triangleVertices: number[] = [];
    for (let i = 0; i < segments; i++) {
      triangleVertices.push(cx, cy);
      triangleVertices.push(vertices[i * 2], vertices[i * 2 + 1]);
      triangleVertices.push(vertices[(i + 1) * 2], vertices[(i + 1) * 2 + 1]);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleVertices), gl.STATIC_DRAW);

    const { program } = ctx;
    gl.uniform4f(gl.getUniformLocation(program, "u_color"), ...color);
    gl.uniform1f(gl.getUniformLocation(program, "u_rotation"), rotation);
    gl.uniform2f(gl.getUniformLocation(program, "u_offset"), 0, 0);
    gl.uniform2f(gl.getUniformLocation(program, "u_rotationCenter"), cx, cy);
    gl.drawArrays(gl.TRIANGLES, 0, segments * 3);
  }

  if (stroke) {
    const strokeColor = cssColorToRGBA(stroke.color);
    strokeColor[3] *= (stroke.opacity ?? 1) * opacity;

    resetRotation(ctx);
    const { program } = ctx;
    gl.uniform4f(gl.getUniformLocation(program, "u_color"), ...strokeColor);
    gl.uniform2f(gl.getUniformLocation(program, "u_offset"), 0, 0);

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;

      const lx1 = Math.cos(angle1) * rx;
      const ly1 = Math.sin(angle1) * ry;
      const lx2 = Math.cos(angle2) * rx;
      const ly2 = Math.sin(angle2) * ry;

      const p1 = {
        x: cx + lx1 * cos - ly1 * sin,
        y: cy + lx1 * sin + ly1 * cos,
      };
      const p2 = {
        x: cx + lx2 * cos - ly2 * sin,
        y: cy + lx2 * sin + ly2 * cos,
      };

      drawLineBetweenPoints(ctx, p1, p2, stroke.width, 1);
    }
  }
}
