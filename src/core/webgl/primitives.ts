import type { RenderContext } from "./types";

export function resetRotation(ctx: RenderContext): void {
  const { gl, program } = ctx;
  gl.uniform1f(gl.getUniformLocation(program, "u_rotation"), 0);
  gl.uniform2f(gl.getUniformLocation(program, "u_rotationCenter"), 0, 0);
  gl.uniform2f(gl.getUniformLocation(program, "u_offset"), 0, 0);
}

export function drawLineBetweenPoints(
  ctx: RenderContext,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  lineWidth: number,
  scale: number,
): void {
  const { gl, positionBuffer, vertexPool } = ctx;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  const adjustedWidth = lineWidth / scale;
  const nx = (-dy / len) * (adjustedWidth / 2);
  const ny = (dx / len) * (adjustedWidth / 2);

  const v = vertexPool;
  v[0] = p1.x - nx;
  v[1] = p1.y - ny;
  v[2] = p1.x + nx;
  v[3] = p1.y + ny;
  v[4] = p2.x - nx;
  v[5] = p2.y - ny;
  v[6] = p2.x - nx;
  v[7] = p2.y - ny;
  v[8] = p1.x + nx;
  v[9] = p1.y + ny;
  v[10] = p2.x + nx;
  v[11] = p2.y + ny;
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, v.subarray(0, 12), gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

export function drawHandle(ctx: RenderContext, x: number, y: number, scale: number): void {
  const { gl, program, positionBuffer, vertexPool } = ctx;
  const handleSize = 6 / scale;
  const handleBorder = 1 / scale;
  const hs = handleSize / 2;
  const hb = handleBorder;

  const strokeColor: [number, number, number, number] = [0, 0.6, 1, 1];

  gl.uniform4f(gl.getUniformLocation(program, "u_color"), ...strokeColor);
  const v = vertexPool;
  v[0] = x - hs - hb;
  v[1] = y - hs - hb;
  v[2] = x + hs + hb;
  v[3] = y - hs - hb;
  v[4] = x - hs - hb;
  v[5] = y + hs + hb;
  v[6] = x - hs - hb;
  v[7] = y + hs + hb;
  v[8] = x + hs + hb;
  v[9] = y - hs - hb;
  v[10] = x + hs + hb;
  v[11] = y + hs + hb;
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, v.subarray(0, 12), gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  gl.uniform4f(gl.getUniformLocation(program, "u_color"), 1, 1, 1, 1);
  v[0] = x - hs;
  v[1] = y - hs;
  v[2] = x + hs;
  v[3] = y - hs;
  v[4] = x - hs;
  v[5] = y + hs;
  v[6] = x - hs;
  v[7] = y + hs;
  v[8] = x + hs;
  v[9] = y - hs;
  v[10] = x + hs;
  v[11] = y + hs;
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, v.subarray(0, 12), gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

export function drawDisc(ctx: RenderContext, x: number, y: number, radius: number): void {
  const { gl, positionBuffer } = ctx;
  const segments = 12;
  const vertices: number[] = [];

  for (let i = 0; i < segments; i++) {
    const theta1 = (i / segments) * Math.PI * 2;
    const theta2 = ((i + 1) / segments) * Math.PI * 2;

    const p1x = x + Math.cos(theta1) * radius;
    const p1y = y + Math.sin(theta1) * radius;
    const p2x = x + Math.cos(theta2) * radius;
    const p2y = y + Math.sin(theta2) * radius;

    vertices.push(x, y, p1x, p1y, p2x, p2y);
  }

  const floatVertices = new Float32Array(vertices);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, floatVertices, gl.STATIC_DRAW);

  resetRotation(ctx);

  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
}
