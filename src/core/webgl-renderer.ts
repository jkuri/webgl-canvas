import type { BoundingBox, SelectionBox, Shape, Transform } from "@/types";

const VERTEX_SHADER = `
  attribute vec2 a_position;
  uniform vec2 u_resolution;
  uniform vec2 u_translation;
  uniform float u_scale;
  uniform float u_rotation;
  uniform vec2 u_rotationCenter;

  void main() {
    // Apply rotation around center
    vec2 pos = a_position - u_rotationCenter;
    float cosR = cos(u_rotation);
    float sinR = sin(u_rotation);
    vec2 rotated = vec2(
      pos.x * cosR - pos.y * sinR,
      pos.x * sinR + pos.y * cosR
    );
    pos = rotated + u_rotationCenter;

    vec2 position = (pos * u_scale + u_translation) / u_resolution * 2.0 - 1.0;
    gl_Position = vec4(position * vec2(1, -1), 0, 1);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec4 u_color;

  void main() {
    gl_FragColor = u_color;
  }
`;

const GRID_VERTEX_SHADER = `
  attribute vec2 a_position;

  void main() {
    gl_Position = vec4(a_position, 0, 1);
  }
`;

const GRID_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform vec2 u_translation;
  uniform float u_scale;

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    fragCoord.y = u_resolution.y - fragCoord.y;
    vec2 worldPos = (fragCoord - u_translation) / u_scale;

    float baseSpacing = 20.0;
    float spacing = baseSpacing;
    if (u_scale < 0.5) spacing = baseSpacing * 4.0;
    else if (u_scale < 1.0) spacing = baseSpacing * 2.0;

    vec2 gridPos = mod(worldPos + spacing * 0.5, spacing);
    vec2 center = vec2(spacing * 0.5);
    float dist = length(gridPos - center);
    float dotSize = 1.5 / u_scale;
    float dot = 1.0 - smoothstep(dotSize * 0.5, dotSize, dist);

    // Gray dots on light background (0.985)
    // Mix background color with dot color based on dot intensity
    vec3 bgColor = vec3(0.985);
    vec3 dotColor = vec3(0.92);
    gl_FragColor = vec4(mix(bgColor, dotColor, dot), 1.0);
  }
`;

type GetStateFunc = () => {
  transform: Transform;
  shapes: Shape[];
  selectedIds: string[];
  selectionBox: SelectionBox | null;
};

export class WebGLRenderer {
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;
  private shapeProgram: WebGLProgram | null = null;
  private gridProgram: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private animationId: number | null = null;
  private needsRender = true;
  private lastTransform: Transform | null = null;
  private getState: GetStateFunc | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
    if (!gl) throw new Error("WebGL not supported");
    this.gl = gl;
    this.init();
  }

  private init(): void {
    this.shapeProgram = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
    this.gridProgram = this.createProgram(GRID_VERTEX_SHADER, GRID_FRAGMENT_SHADER);
    this.positionBuffer = this.gl.createBuffer();
    this.quadBuffer = this.gl.createBuffer();

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      this.gl.STATIC_DRAW,
    );
  }

  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${info}`);
    }
    return shader;
  }

  private createProgram(vertexSrc: string, fragmentSrc: string): WebGLProgram {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSrc);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSrc);
    const program = this.gl.createProgram();
    if (!program) throw new Error("Failed to create program");
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${this.gl.getProgramInfoLog(program)}`);
    }
    return program;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width * window.devicePixelRatio;
    this.canvas.height = height * window.devicePixelRatio;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // Render immediately to prevent flicker
    if (this.getState) {
      this.renderFrame(this.getState());
    }
  }

  markDirty(): void {
    this.needsRender = true;
  }

  startRenderLoop(
    getState: () => {
      transform: Transform;
      shapes: Shape[];
      selectedIds: string[];
      selectionBox: SelectionBox | null;
    },
  ): void {
    this.getState = getState;
    const loop = () => {
      const state = getState();
      const { transform } = state;

      const changed =
        !this.lastTransform ||
        this.lastTransform.x !== transform.x ||
        this.lastTransform.y !== transform.y ||
        this.lastTransform.scale !== transform.scale;

      if (changed) {
        this.lastTransform = { ...transform };
        this.needsRender = true;
      }

      if (this.needsRender) {
        this.renderFrame(state);
        this.needsRender = false;
      }

      this.animationId = requestAnimationFrame(loop);
    };
    loop();
  }

  stopRenderLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private renderFrame(state: {
    transform: Transform;
    shapes: Shape[];
    selectedIds: string[];
    selectionBox: SelectionBox | null;
  }): void {
    const gl = this.gl;
    const { transform, shapes, selectedIds, selectionBox } = state;
    const { x, y, scale } = transform;
    const dpr = window.devicePixelRatio;

    gl.clearColor(0.985, 0.985, 0.985, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Grid
    if (this.gridProgram) {
      // biome-ignore lint/correctness/useHookAtTopLevel: WebGL method, not React hook
      gl.useProgram(this.gridProgram);
      const posLoc = gl.getAttribLocation(this.gridProgram, "a_position");
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(gl.getUniformLocation(this.gridProgram, "u_resolution"), this.canvas.width, this.canvas.height);
      gl.uniform2f(gl.getUniformLocation(this.gridProgram, "u_translation"), x * dpr, y * dpr);
      gl.uniform1f(gl.getUniformLocation(this.gridProgram, "u_scale"), scale);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Shapes
    if (this.shapeProgram) {
      // biome-ignore lint/correctness/useHookAtTopLevel: WebGL method, not React hook
      gl.useProgram(this.shapeProgram);
      const posLoc = gl.getAttribLocation(this.shapeProgram, "a_position");
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram, "u_resolution"), this.canvas.width, this.canvas.height);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram, "u_translation"), x * dpr, y * dpr);
      gl.uniform1f(gl.getUniformLocation(this.shapeProgram, "u_scale"), scale);

      for (const shape of shapes) {
        this.drawRect(shape);
      }

      const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));

      if (selectedShapes.length === 1) {
        // Single shape: draw rotated outline with handles
        this.drawShapeOutlineWithHandles(selectedShapes[0], scale);
      } else if (selectedShapes.length > 1) {
        // Multiple shapes: draw individual outlines + axis-aligned bounding box
        for (const shape of selectedShapes) {
          this.drawShapeOutline(shape, scale);
        }
        const bounds = this.calculateBoundingBox(selectedShapes);
        this.drawBoundingBoxWithHandles(bounds, true, scale);
      }

      if (selectionBox) {
        this.drawSelectionBox(selectionBox, scale);
      }
    }
  }

  private calculateBoundingBox(shapes: Shape[]): BoundingBox {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    // Use rotated corners for accurate bounding box
    for (const shape of shapes) {
      const corners = this.getRotatedCorners(shape);
      for (const corner of corners) {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
      }
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private drawRect(shape: Shape): void {
    const { x, y, width, height, color, rotation } = shape;
    const gl = this.gl;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    const vertices = new Float32Array([
      x,
      y,
      x + width,
      y,
      x,
      y + height,
      x,
      y + height,
      x + width,
      y,
      x + width,
      y + height,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...color);
    gl.uniform1f(gl.getUniformLocation(this.shapeProgram!, "u_rotation"), rotation);
    gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_rotationCenter"), centerX, centerY);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private resetRotation(): void {
    const gl = this.gl;
    gl.uniform1f(gl.getUniformLocation(this.shapeProgram!, "u_rotation"), 0);
    gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_rotationCenter"), 0, 0);
  }

  private getRotatedCorners(shape: Shape): { x: number; y: number }[] {
    const { x, y, width, height, rotation } = shape;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    const corners = [
      { x: x, y: y }, // top-left
      { x: x + width, y: y }, // top-right
      { x: x + width, y: y + height }, // bottom-right
      { x: x, y: y + height }, // bottom-left
    ];

    return corners.map((corner) => {
      const dx = corner.x - centerX;
      const dy = corner.y - centerY;
      return {
        x: centerX + dx * cos - dy * sin,
        y: centerY + dx * sin + dy * cos,
      };
    });
  }

  private drawLineBetweenPoints(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    lineWidth: number,
    scale: number,
  ): void {
    const gl = this.gl;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    // Make line width zoom-independent
    const adjustedWidth = lineWidth / scale;
    const nx = (-dy / len) * (adjustedWidth / 2);
    const ny = (dx / len) * (adjustedWidth / 2);

    const v = new Float32Array([
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
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private drawHandle(x: number, y: number, scale: number): void {
    const gl = this.gl;
    // Make handle size zoom-independent
    const handleSize = 6 / scale;
    const handleBorder = 1 / scale;
    const hs = handleSize / 2;
    const hb = handleBorder;
    const strokeColor: [number, number, number, number] = [0.1, 0.1, 0.1, 1];

    // Outer (border)
    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...strokeColor);
    const outerVerts = new Float32Array([
      x - hs - hb,
      y - hs - hb,
      x + hs + hb,
      y - hs - hb,
      x - hs - hb,
      y + hs + hb,
      x - hs - hb,
      y + hs + hb,
      x + hs + hb,
      y - hs - hb,
      x + hs + hb,
      y + hs + hb,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, outerVerts, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Inner (white fill)
    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), 1, 1, 1, 1);
    const innerVerts = new Float32Array([
      x - hs,
      y - hs,
      x + hs,
      y - hs,
      x - hs,
      y + hs,
      x - hs,
      y + hs,
      x + hs,
      y - hs,
      x + hs,
      y + hs,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, innerVerts, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private drawShapeOutline(shape: Shape, scale: number): void {
    const gl = this.gl;
    const strokeColor: [number, number, number, number] = [0.1, 0.1, 0.1, 1];
    const borderWidth = 1.5;

    const rotatedCorners = this.getRotatedCorners(shape);
    this.resetRotation();

    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...strokeColor);

    // Draw lines between corners
    for (let i = 0; i < 4; i++) {
      this.drawLineBetweenPoints(rotatedCorners[i], rotatedCorners[(i + 1) % 4], borderWidth, scale);
    }
  }

  private drawShapeOutlineWithHandles(shape: Shape, scale: number): void {
    const gl = this.gl;
    const strokeColor: [number, number, number, number] = [0.1, 0.1, 0.1, 1];
    const borderWidth = 1.5;

    const rotatedCorners = this.getRotatedCorners(shape);
    this.resetRotation();

    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...strokeColor);

    // Draw lines between corners
    for (let i = 0; i < 4; i++) {
      this.drawLineBetweenPoints(rotatedCorners[i], rotatedCorners[(i + 1) % 4], borderWidth, scale);
    }

    // Draw handles only at corners: nw(0), ne(1), se(2), sw(3)
    // Edge resize is done by clicking on the lines themselves
    for (const corner of rotatedCorners) {
      this.drawHandle(corner.x, corner.y, scale);
    }
  }

  private drawBoundingBoxWithHandles(bounds: BoundingBox, _isMultiSelect: boolean, scale: number): void {
    const { x, y, width, height } = bounds;
    const gl = this.gl;
    const strokeColor: [number, number, number, number] = [0.1, 0.1, 0.1, 1];
    // Make border width zoom-independent
    const borderWidth = 1 / scale;

    // Reset rotation for bounding box
    this.resetRotation();

    // No fill for multi-selection - transparent background
    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...strokeColor);

    const borders = [
      [x, y - borderWidth, x + width, y],
      [x, y + height, x + width, y + height + borderWidth],
      [x - borderWidth, y - borderWidth, x, y + height + borderWidth],
      [x + width, y - borderWidth, x + width + borderWidth, y + height + borderWidth],
    ];

    for (const [x1, y1, x2, y2] of borders) {
      const v = new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Only draw corner handles - edge resize is done by clicking on lines
    const cornerHandles = [
      { x, y }, // nw
      { x: x + width, y }, // ne
      { x: x + width, y: y + height }, // se
      { x, y: y + height }, // sw
    ];

    for (const handle of cornerHandles) {
      this.drawHandle(handle.x, handle.y, scale);
    }
  }

  private drawSelectionBox(box: SelectionBox, scale: number): void {
    const gl = this.gl;
    const x = Math.min(box.startX, box.endX);
    const y = Math.min(box.startY, box.endY);
    const w = Math.abs(box.endX - box.startX);
    const h = Math.abs(box.endY - box.startY);

    // Reset rotation for selection box
    this.resetRotation();

    // Monochrome fill (light gray with transparency)
    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), 0.1, 0.1, 0.1, 0.08);
    const fillVerts = new Float32Array([x, y, x + w, y, x, y + h, x, y + h, x + w, y, x + w, y + h]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, fillVerts, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Monochrome border (same as selection outline) - zoom-independent
    const lw = 1 / scale;
    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), 0.1, 0.1, 0.1, 1);
    const borders = [
      [x, y, x + w, y + lw],
      [x, y + h - lw, x + w, y + h],
      [x, y, x + lw, y + h],
      [x + w - lw, y, x + w, y + h],
    ];
    for (const [x1, y1, x2, y2] of borders) {
      const v = new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  destroy(): void {
    this.stopRenderLoop();
    if (this.shapeProgram) this.gl.deleteProgram(this.shapeProgram);
    if (this.gridProgram) this.gl.deleteProgram(this.gridProgram);
    if (this.positionBuffer) this.gl.deleteBuffer(this.positionBuffer);
    if (this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer);
  }
}
