import { cssToRGBA } from "@/lib/colors";
import type {
  BoundingBox,
  CanvasElement,
  EllipseElement,
  LineElement,
  PathElement,
  RectElement,
  SelectionBox,
  Shape,
  Transform,
} from "@/types";

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
    vec3 bgColor = vec3(0.985);
    vec3 dotColor = vec3(0.92);
    gl_FragColor = vec4(mix(bgColor, dotColor, dot), 1.0);
  }
`;

type GetStateFunc = () => {
  transform: Transform;
  elements: CanvasElement[];
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
    if (this.getState) {
      this.renderFrame(this.getState());
    }
  }

  markDirty(): void {
    this.needsRender = true;
  }

  startRenderLoop(getState: GetStateFunc): void {
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
    elements: CanvasElement[];
    selectedIds: string[];
    selectionBox: SelectionBox | null;
  }): void {
    const gl = this.gl;
    const { transform, elements, selectedIds, selectionBox } = state;
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

    // Elements
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

      // Render elements in order (groups are virtual, render their children)
      for (const element of elements) {
        if (element.visible === false) continue;
        if (element.parentId) continue; // Skip elements with parents (rendered by parent group)
        this.renderElement(element, elements, scale);
      }

      // Draw selection outlines
      const selectedElements = elements.filter((e) => selectedIds.includes(e.id));
      const selectedShapes = this.collectShapes(selectedElements, elements);

      if (selectedShapes.length === 1 && selectedElements.length === 1 && selectedElements[0].type !== "group") {
        // Single shape: draw rotated outline with handles
        this.drawShapeOutlineWithHandles(selectedShapes[0], scale);
      } else if (selectedShapes.length > 0) {
        // Multiple shapes or group: draw individual outlines + axis-aligned bounding box
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

  // Collect all shapes from elements (expanding groups)
  private collectShapes(elements: CanvasElement[], allElements: CanvasElement[]): Shape[] {
    const shapes: Shape[] = [];
    for (const element of elements) {
      if (element.type === "group") {
        for (const childId of element.childIds) {
          const child = allElements.find((e) => e.id === childId);
          if (child) {
            shapes.push(...this.collectShapes([child], allElements));
          }
        }
      } else {
        shapes.push(element as Shape);
      }
    }
    return shapes;
  }

  private renderElement(element: CanvasElement, allElements: CanvasElement[], scale: number): void {
    if (element.visible === false) return;

    switch (element.type) {
      case "rect":
        this.drawRect(element);
        break;
      case "ellipse":
        this.drawEllipse(element, scale);
        break;
      case "line":
        this.drawLine(element, scale);
        break;
      case "path":
        // Path rendering would require parsing the d attribute
        // For now, just draw the bounding box
        this.drawPathPlaceholder(element);
        break;
      case "group":
        // Render children
        for (const childId of element.childIds) {
          const child = allElements.find((e) => e.id === childId);
          if (child) {
            this.renderElement(child, allElements, scale);
          }
        }
        break;
    }
  }

  private cssColorToRGBA(color: string | null): [number, number, number, number] {
    if (!color) return [0, 0, 0, 0];
    return cssToRGBA(color);
  }

  private drawRect(element: RectElement): void {
    const { x, y, width, height, fill, stroke, rotation, opacity } = element;
    const gl = this.gl;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Draw fill
    if (fill) {
      const color = this.cssColorToRGBA(fill);
      color[3] *= opacity;
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

    // Draw stroke
    if (stroke) {
      const strokeColor = this.cssColorToRGBA(stroke.color);
      strokeColor[3] *= opacity;
      this.resetRotation();
      gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...strokeColor);

      const corners = this.getRotatedCorners(element);
      for (let i = 0; i < 4; i++) {
        this.drawLineBetweenPoints(corners[i], corners[(i + 1) % 4], stroke.width, 1);
      }
    }
  }

  private drawEllipse(element: EllipseElement, _scale: number): void {
    const { cx, cy, rx, ry, fill, stroke, rotation, opacity } = element;
    const gl = this.gl;
    const segments = Math.max(32, Math.ceil(Math.max(rx, ry) / 2));

    // Draw fill
    if (fill) {
      const color = this.cssColorToRGBA(fill);
      color[3] *= opacity;

      // Create triangle fan vertices
      const vertices: number[] = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        vertices.push(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
      }
      // Close the fan
      vertices.push(cx + rx, cy); // Back to start

      // Convert fan to triangles
      const triangleVertices: number[] = [];
      for (let i = 0; i < segments; i++) {
        // Center point
        triangleVertices.push(cx, cy);
        // Current point
        triangleVertices.push(vertices[i * 2], vertices[i * 2 + 1]);
        // Next point
        triangleVertices.push(vertices[(i + 1) * 2], vertices[(i + 1) * 2 + 1]);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleVertices), gl.STATIC_DRAW);
      gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...color);
      gl.uniform1f(gl.getUniformLocation(this.shapeProgram!, "u_rotation"), rotation);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_rotationCenter"), cx, cy);
      gl.drawArrays(gl.TRIANGLES, 0, segments * 3);
    }

    // Draw stroke
    if (stroke) {
      const strokeColor = this.cssColorToRGBA(stroke.color);
      strokeColor[3] *= opacity;
      this.resetRotation();
      gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...strokeColor);

      // Draw ellipse outline as line segments
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i + 1) / segments) * Math.PI * 2;

        // Local coordinates
        const lx1 = Math.cos(angle1) * rx;
        const ly1 = Math.sin(angle1) * ry;
        const lx2 = Math.cos(angle2) * rx;
        const ly2 = Math.sin(angle2) * ry;

        // Rotate and translate
        const p1 = {
          x: cx + lx1 * cos - ly1 * sin,
          y: cy + lx1 * sin + ly1 * cos,
        };
        const p2 = {
          x: cx + lx2 * cos - ly2 * sin,
          y: cy + lx2 * sin + ly2 * cos,
        };

        this.drawLineBetweenPoints(p1, p2, stroke.width, 1);
      }
    }
  }

  private drawLine(element: LineElement, scale: number): void {
    const { x1, y1, x2, y2, stroke, opacity, markerStart, markerEnd } = element;
    if (!stroke) return;

    const gl = this.gl;
    const color = this.cssColorToRGBA(stroke.color);
    color[3] *= opacity;

    this.resetRotation();
    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...color);

    // Calculate line angle
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);

    // Draw main line
    // TODO: Adjust start/end points if markers are present to avoid overlap
    if (stroke.dashArray && stroke.dashArray.length > 0) {
      this.drawDashedLine({ x: x1, y: y1 }, { x: x2, y: y2 }, stroke.width, stroke.dashArray);
    } else {
      this.drawLineBetweenPoints({ x: x1, y: y1 }, { x: x2, y: y2 }, stroke.width, 1);
    }

    // Draw markers
    if (markerStart === "arrow") {
      this.drawArrowhead(x1, y1, angle + Math.PI, stroke.width, scale);
    }
    if (markerEnd === "arrow") {
      this.drawArrowhead(x2, y2, angle, stroke.width, scale);
    }
  }

  private drawDashedLine(
    start: { x: number; y: number },
    end: { x: number; y: number },
    width: number,
    dashArray: number[],
  ): void {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const dir = { x: dx / len, y: dy / len };

    let dist = 0;
    let dashIdx = 0;
    let draw = true;

    while (dist < len) {
      const dashLen = dashArray[dashIdx % dashArray.length];
      const nextDist = Math.min(dist + dashLen, len);

      if (draw) {
        const p1 = {
          x: start.x + dir.x * dist,
          y: start.y + dir.y * dist,
        };
        const p2 = {
          x: start.x + dir.x * nextDist,
          y: start.y + dir.y * nextDist,
        };
        this.drawLineBetweenPoints(p1, p2, width, 1);
      }

      dist = nextDist;
      dashIdx++;
      draw = !draw;
    }
  }

  private drawArrowhead(x: number, y: number, angle: number, lineWidth: number, _scale: number): void {
    const gl = this.gl;
    const size = Math.max(lineWidth * 3, 10);
    const halfSize = size / 2;

    // Arrow shape (triangle)
    // Tip at (0,0), base at (-size, -halfSize) and (-size, halfSize)
    const p1 = { x: 0, y: 0 };
    const p2 = { x: -size, y: -halfSize };
    const p3 = { x: -size, y: halfSize };

    // Rotate points
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const transform = (p: { x: number; y: number }) => ({
      x: x + p.x * cos - p.y * sin,
      y: y + p.x * sin + p.y * cos,
    });

    const v1 = transform(p1);
    const v2 = transform(p2);
    const v3 = transform(p3);

    const vertices = new Float32Array([v1.x, v1.y, v2.x, v2.y, v3.x, v3.y]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Use reset rotation since we applied it manually
    this.resetRotation();

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private drawPathPlaceholder(element: PathElement): void {
    // For now, just draw the bounding box outline
    const { bounds, fill, opacity } = element;
    if (!fill) return;

    const gl = this.gl;
    const color = this.cssColorToRGBA(fill);
    color[3] *= opacity * 0.5; // Make it semi-transparent to indicate placeholder

    const { x, y, width, height } = bounds;
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
    gl.uniform1f(gl.getUniformLocation(this.shapeProgram!, "u_rotation"), element.rotation);
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_rotationCenter"), centerX, centerY);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private calculateBoundingBox(shapes: Shape[]): BoundingBox {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

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

  private resetRotation(): void {
    const gl = this.gl;
    gl.uniform1f(gl.getUniformLocation(this.shapeProgram!, "u_rotation"), 0);
    gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_rotationCenter"), 0, 0);
  }

  private getRotatedCorners(shape: Shape): { x: number; y: number }[] {
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
    }
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
    const handleSize = 6 / scale;
    const handleBorder = 1 / scale;
    const hs = handleSize / 2;
    const hb = handleBorder;
    // Blue border #0099ff
    const strokeColor: [number, number, number, number] = [0, 0.6, 1, 1];

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
    // Blue outline #0099ff
    const strokeColor: [number, number, number, number] = [0, 0.6, 1, 1];
    const borderWidth = 1.5;

    const corners = this.getRotatedCorners(shape);
    this.resetRotation();

    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...strokeColor);

    if (shape.type === "line") {
      this.drawLineBetweenPoints(corners[0], corners[1], borderWidth, scale);
    } else {
      for (let i = 0; i < 4; i++) {
        this.drawLineBetweenPoints(corners[i], corners[(i + 1) % 4], borderWidth, scale);
      }
    }
  }

  private drawShapeOutlineWithHandles(shape: Shape, scale: number): void {
    const gl = this.gl;
    // Blue outline #0099ff
    const strokeColor: [number, number, number, number] = [0, 0.6, 1, 1];
    const borderWidth = 1.5;

    const corners = this.getRotatedCorners(shape);
    this.resetRotation();

    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...strokeColor);

    if (shape.type === "line") {
      this.drawLineBetweenPoints(corners[0], corners[1], borderWidth, scale);
      // Draw handles at endpoints
      this.drawHandle(corners[0].x, corners[0].y, scale);
      this.drawHandle(corners[1].x, corners[1].y, scale);
    } else {
      // Draw outline
      for (let i = 0; i < 4; i++) {
        this.drawLineBetweenPoints(corners[i], corners[(i + 1) % 4], borderWidth, scale);
      }
      // Draw handles at corners
      for (const corner of corners) {
        this.drawHandle(corner.x, corner.y, scale);
      }
    }
  }

  private drawBoundingBoxWithHandles(bounds: BoundingBox, _isMultiSelect: boolean, scale: number): void {
    const { x, y, width, height } = bounds;
    const gl = this.gl;
    // Blue outline #0099ff
    const strokeColor: [number, number, number, number] = [0, 0.6, 1, 1];
    const borderWidth = 1 / scale;

    this.resetRotation();

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

    const cornerHandles = [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
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

    this.resetRotation();

    // Fill - Blue with low opacity (0.1)
    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), 0, 0.6, 1, 0.1);
    const fillVerts = new Float32Array([x, y, x + w, y, x, y + h, x, y + h, x + w, y, x + w, y + h]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, fillVerts, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Border - Blue #0099ff
    const lw = 1 / scale;
    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), 0, 0.6, 1, 1);
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
