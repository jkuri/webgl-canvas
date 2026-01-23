import { cssToRGBA } from "@/lib/colors";
import { parsePath, pathToFillVertices, pathToStrokeVertices } from "@/lib/path-parser";
import type {
  BoundingBox,
  CanvasElement,
  EllipseElement,
  GroupElement,
  ImageElement,
  LineElement,
  PathElement,
  RectElement,
  SelectionBox,
  Shape,
  TextElement,
  Transform,
} from "@/types";

const VERTEX_SHADER = `
  attribute vec2 a_position;
  uniform vec2 u_resolution;
  uniform vec2 u_translation;
  uniform vec2 u_offset;
  uniform float u_scale;
  uniform float u_rotation;
  uniform vec2 u_rotationCenter;

  void main() {

    vec2 pos = a_position + u_offset - u_rotationCenter;
    float cosR = cos(u_rotation);
    float sinR = sin(u_rotation);
    vec2 rotated = vec2(
      pos.x * cosR - pos.y * sinR,
      pos.x * sinR + pos.y * cosR
    );
    pos = rotated + u_rotationCenter;

    vec2 position = ((pos * u_scale) + u_translation) / u_resolution * 2.0 - 1.0;
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
  uniform vec3 u_bgColor;
  uniform float u_bgVisible;

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    fragCoord.y = u_resolution.y - fragCoord.y;
    vec2 worldPos = (fragCoord - u_translation) / u_scale;

    vec3 bgColor;

    if (u_bgVisible > 0.5) {
        bgColor = u_bgColor;
    } else {

        float size = 10.0;
        vec2 p = floor(worldPos / size);
        float pattern = mod(p.x + p.y, 2.0);
        bgColor = mix(vec3(1.0), vec3(0.95), pattern);
    }

    float baseSpacing = 10.0;
    float spacing = baseSpacing;

    vec2 gridPos = mod(worldPos, spacing);
    vec2 dist = min(gridPos, spacing - gridPos);


    float lineThickness = 1.0 / u_scale;
    float lineY = smoothstep(lineThickness, 0.0, dist.y);
    float lineX = smoothstep(lineThickness, 0.0, dist.x);
    float grid = max(lineX, lineY);


    vec3 gridColor = vec3(0.92);


    if (u_bgVisible > 0.5) {
        gl_FragColor = vec4(mix(bgColor, gridColor, grid), 1.0);
    } else {
        gl_FragColor = vec4(bgColor, 1.0);
    }
  }
`;

type GetStateFunc = () => {
  transform: Transform;
  elements: CanvasElement[];
  selectedIds: string[];
  selectionBox: SelectionBox | null;
  canvasBackground: string;
  canvasBackgroundVisible: boolean;
};

interface PathCacheEntry {
  d: string;
  vertices: Float32Array;
  strokeVertices: Float32Array;
  nativeBounds: { x: number; y: number };
}

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

  private pathCache = new Map<string, PathCacheEntry>();

  private vertexPool12 = new Float32Array(24);

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
    canvasBackground: string;
    canvasBackgroundVisible: boolean;
  }): void {
    const gl = this.gl;
    const { transform, elements, selectedIds, selectionBox, canvasBackground, canvasBackgroundVisible } = state;
    const { x, y, scale } = transform;
    const dpr = window.devicePixelRatio;

    const bgColor = cssToRGBA(canvasBackground);

    if (canvasBackgroundVisible) {
      gl.clearColor(bgColor[0], bgColor[1], bgColor[2], 1);
    } else {
      gl.clearColor(1, 1, 1, 1);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    if (this.gridProgram) {
      // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
      gl.useProgram(this.gridProgram);
      const posLoc = gl.getAttribLocation(this.gridProgram, "a_position");
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(gl.getUniformLocation(this.gridProgram, "u_resolution"), this.canvas.width, this.canvas.height);
      gl.uniform2f(gl.getUniformLocation(this.gridProgram, "u_translation"), x * dpr, y * dpr);
      gl.uniform1f(gl.getUniformLocation(this.gridProgram, "u_scale"), scale);

      gl.uniform3f(gl.getUniformLocation(this.gridProgram, "u_bgColor"), bgColor[0], bgColor[1], bgColor[2]);
      gl.uniform1f(gl.getUniformLocation(this.gridProgram, "u_bgVisible"), canvasBackgroundVisible ? 1.0 : 0.0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    if (this.shapeProgram) {
      // biome-ignore lint/correctness/useHookAtTopLevel: not a hook
      gl.useProgram(this.shapeProgram);
      const posLoc = gl.getAttribLocation(this.shapeProgram, "a_position");
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram, "u_resolution"), this.canvas.width, this.canvas.height);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram, "u_translation"), x * dpr, y * dpr);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram, "u_offset"), 0, 0);
      gl.uniform1f(gl.getUniformLocation(this.shapeProgram, "u_scale"), scale);

      const visibleMinX = -x / scale;
      const visibleMinY = -y / scale;
      const visibleMaxX = (this.canvas.width / dpr - x) / scale;
      const visibleMaxY = (this.canvas.height / dpr - y) / scale;

      for (const element of elements) {
        if (element.visible === false) continue;
        if (element.parentId) continue;

        this.renderElement(element, elements, scale, {
          minX: visibleMinX,
          minY: visibleMinY,
          maxX: visibleMaxX,
          maxY: visibleMaxY,
        });
      }

      const selectedIdSet = new Set(selectedIds);
      const selectedElements = elements.filter((e) => selectedIdSet.has(e.id));
      const selectedShapes = this.collectShapes(selectedElements, elements);

      if (selectionBox) {
        for (const shape of selectedShapes) {
          this.drawShapeOutline(shape, scale);
        }
      } else {
        if (selectedShapes.length === 1 && selectedElements.length === 1 && selectedElements[0].type !== "group") {
          this.drawShapeOutlineWithHandles(selectedShapes[0], scale);
        } else if (selectedShapes.length > 0) {
          if (selectedElements.length === 1 && selectedElements[0].type === "group") {
            const group = selectedElements[0] as GroupElement;
            const obb = this.calculateGroupOBB(selectedShapes, group.rotation);
            this.drawShapesOutlines(selectedShapes, scale);
            this.drawShapeOutlineWithHandles(obb, scale);
          } else {
            this.drawShapesOutlines(selectedShapes, scale);
            const bounds = this.calculateBoundingBox(selectedShapes);
            this.drawBoundingBoxWithHandles(bounds, true, scale);
          }
        }
      }

      if (selectionBox) {
        this.drawSelectionBox(selectionBox, scale);
      }
    }
  }

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

  private renderElement(
    element: CanvasElement,
    allElements: CanvasElement[],
    scale: number,
    visibleBounds?: { minX: number; minY: number; maxX: number; maxY: number },
  ): void {
    if (element.visible === false) return;

    if (visibleBounds) {
      let ex = 0;
      let ey = 0;
      let ew = 0;
      let eh = 0;

      if (element.type === "group") {
      } else if (element.type === "rect" || element.type === "image") {
        ex = element.x;
        ey = element.y;
        ew = element.width;
        eh = element.height;
      } else if (element.type === "text") {
        const el = element as TextElement;
        ex = el.x;
        ey = el.y;

        if (el.bounds) {
          ew = el.bounds.width;
          eh = el.bounds.height;
        } else {
          ex = visibleBounds.minX;
          ey = visibleBounds.minY;
          ew = 1;
          eh = 1;
        }
      } else if (element.type === "ellipse") {
        const el = element as EllipseElement;
        ex = el.cx - el.rx;
        ey = el.cy - el.ry;
        ew = el.rx * 2;
        eh = el.ry * 2;
      } else if (element.type === "path") {
        const el = element as PathElement;
        if (el.bounds) {
          ex = el.bounds.x;
          ey = el.bounds.y;
          ew = el.bounds.width;
          eh = el.bounds.height;
        } else {
          ex = visibleBounds.minX;
          ey = visibleBounds.minY;
          ew = 1;
          eh = 1;
        }
      } else if (element.type === "line") {
        const el = element as LineElement;
        ex = Math.min(el.x1, el.x2);
        ey = Math.min(el.y1, el.y2);
        ew = Math.abs(el.x2 - el.x1);
        eh = Math.abs(el.y2 - el.y1);
      }

      if (ew > 0 && eh > 0) {
        if (
          ex + ew < visibleBounds.minX ||
          ex > visibleBounds.maxX ||
          ey + eh < visibleBounds.minY ||
          ey > visibleBounds.maxY
        ) {
          return;
        }
      }
    }

    switch (element.type) {
      case "rect":
        this.drawRect(element as RectElement, scale);
        break;
      case "ellipse":
        this.drawEllipse(element as EllipseElement, scale);
        break;
      case "line":
        this.drawLine(element as LineElement, scale);
        break;
      case "path":
        this.drawPath(element as PathElement);
        break;
      case "group":
        for (const childId of element.childIds) {
          const child = allElements.find((e) => e.id === childId);
          if (child) {
            this.renderElement(child, allElements, scale, visibleBounds);
          }
        }
        break;
    }
  }

  private cssColorToRGBA(
    color: string | { ref: string; type: "gradient" | "pattern" } | null,
  ): [number, number, number, number] {
    if (!color) return [0, 0, 0, 0];

    if (typeof color === "object" && "ref" in color) {
      return [0.5, 0.5, 0.5, 1];
    }
    return cssToRGBA(color);
  }

  private drawRect(element: RectElement, scale: number): void {
    const { x, y, width, height, fill, stroke, rotation, opacity } = element;
    const rx = element.rx || 0;
    const ry = element.ry || 0;

    if (rx > 0 || ry > 0) {
      this.drawRoundedRect(element, scale);
      return;
    }

    const gl = this.gl;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_offset"), 0, 0);

    if (fill) {
      const color = this.cssColorToRGBA(fill);
      color[3] *= (element.fillOpacity ?? 1) * opacity;

      const vertices = this.vertexPool12;
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
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices.subarray(0, 12), gl.DYNAMIC_DRAW);
      gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...color);
      gl.uniform1f(gl.getUniformLocation(this.shapeProgram!, "u_rotation"), rotation);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_rotationCenter"), centerX, centerY);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    if (stroke) {
      const strokeColor = this.cssColorToRGBA(stroke.color);
      strokeColor[3] *= (stroke.opacity ?? 1) * opacity;
      this.resetRotation();
      gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...strokeColor);

      const corners = this.getRotatedCorners(element);
      for (let i = 0; i < 4; i++) {
        this.drawLineBetweenPoints(corners[i], corners[(i + 1) % 4], stroke.width, 1);
      }
    }
  }

  private drawRoundedRect(element: RectElement, scale: number): void {
    const { x, y, width, height, fill, stroke, rotation, opacity } = element;
    const gl = this.gl;

    const r = Math.min(element.rx || 0, width / 2, height / 2);
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    const segments = Math.max(16, Math.min(256, Math.ceil(r * scale)));

    const color = fill ? this.cssColorToRGBA(fill) : [0, 0, 0, 0];
    color[3] *= (element.fillOpacity ?? 1) * opacity;

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

      gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_offset"), 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vRects), gl.STATIC_DRAW);
      gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), color[0], color[1], color[2], color[3]);
      gl.uniform1f(gl.getUniformLocation(this.shapeProgram!, "u_rotation"), rotation);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_rotationCenter"), centerX, centerY);
      gl.drawArrays(gl.TRIANGLES, 0, vRects.length / 2);

      const drawFan = (pts: number[]) => {
        const cx = pts[0],
          cy = pts[1];
        const tris: number[] = [];
        for (let i = 2; i < pts.length - 2; i += 2) {
          tris.push(cx, cy, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
        }
        const fV = new Float32Array(tris);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, fV, gl.STATIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, tris.length / 2);
      };

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
      const sColor = this.cssColorToRGBA(stroke.color);
      sColor[3] *= (stroke.opacity ?? 1) * opacity;

      gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), sColor[0], sColor[1], sColor[2], sColor[3]);
      gl.uniform1f(gl.getUniformLocation(this.shapeProgram!, "u_rotation"), rotation);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_rotationCenter"), centerX, centerY);

      const w = stroke.width;

      this.drawLineBetweenPoints({ x: x + r, y: y }, { x: x + width - r, y: y }, w, 1);

      this.drawLineBetweenPoints({ x: x + r, y: y + height }, { x: x + width - r, y: y + height }, w, 1);

      this.drawLineBetweenPoints({ x: x, y: y + r }, { x: x, y: y + height - r }, w, 1);

      this.drawLineBetweenPoints({ x: x + width, y: y + r }, { x: x + width, y: y + height - r }, w, 1);

      const drawArcStroke = (cx: number, cy: number, start: number, end: number) => {
        const halfW = w / 2;

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const drawRotatedDisc = (px: number, py: number, radius: number) => {
          const dx = px - centerX;
          const dy = py - centerY;
          const rx = centerX + dx * cos - dy * sin;
          const ry = centerY + dx * sin + dy * cos;
          this.drawDisc(rx, ry, radius, gl);

          gl.uniform1f(gl.getUniformLocation(this.shapeProgram!, "u_rotation"), rotation);
          gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_rotationCenter"), centerX, centerY);
          gl.uniform4f(
            gl.getUniformLocation(this.shapeProgram!, "u_color"),
            sColor[0],
            sColor[1],
            sColor[2],
            sColor[3],
          );
        };

        for (let i = 0; i < segments; i++) {
          const a1 = start + (i / segments) * (end - start);
          const a2 = start + ((i + 1) / segments) * (end - start);
          const p1 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r };
          const p2 = { x: cx + Math.cos(a2) * r, y: cy + Math.sin(a2) * r };
          this.drawLineBetweenPoints(p1, p2, w, 1);

          drawRotatedDisc(p1.x, p1.y, halfW);
        }

        const endP = { x: cx + Math.cos(end) * r, y: cy + Math.sin(end) * r };
        drawRotatedDisc(endP.x, endP.y, halfW);
      };

      drawArcStroke(cNW.x, cNW.y, Math.PI, 1.5 * Math.PI);
      drawArcStroke(cNE.x, cNE.y, 1.5 * Math.PI, 2 * Math.PI);
      drawArcStroke(cSE.x, cSE.y, 0, 0.5 * Math.PI);
      drawArcStroke(cSW.x, cSW.y, 0.5 * Math.PI, Math.PI);
    }
  }

  private drawEllipse(element: EllipseElement, _scale: number): void {
    const { cx, cy, rx, ry, fill, stroke, rotation, opacity } = element;
    const gl = this.gl;
    const segments = Math.max(32, Math.ceil(Math.max(rx, ry) / 2));

    if (fill) {
      const color = this.cssColorToRGBA(fill);
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

      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleVertices), gl.STATIC_DRAW);
      gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...color);
      gl.uniform1f(gl.getUniformLocation(this.shapeProgram!, "u_rotation"), rotation);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_offset"), 0, 0);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_rotationCenter"), cx, cy);
      gl.drawArrays(gl.TRIANGLES, 0, segments * 3);
    }

    if (stroke) {
      const strokeColor = this.cssColorToRGBA(stroke.color);
      strokeColor[3] *= (stroke.opacity ?? 1) * opacity;
      this.resetRotation();
      gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...strokeColor);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_offset"), 0, 0);

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

        this.drawLineBetweenPoints(p1, p2, stroke.width, 1);
      }
    }
  }

  private drawLine(element: LineElement, scale: number): void {
    const { x1, y1, x2, y2, stroke, opacity, markerStart, markerEnd } = element;
    if (!stroke) return;

    const gl = this.gl;
    const color = this.cssColorToRGBA(stroke.color);
    color[3] *= (stroke.opacity ?? 1) * opacity;

    this.resetRotation();
    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...color);
    gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_offset"), 0, 0);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx * dx + dy * dy);

    const markerSize = Math.max(stroke.width * 3, 10);

    let startOffset = 0;
    let endOffset = 0;

    if (markerStart && markerStart !== "none") {
      startOffset = markerStart === "arrow" ? 0 : markerSize;
    }
    if (markerEnd && markerEnd !== "none") {
      endOffset = markerEnd === "arrow" ? 0 : markerSize;
    }

    if (length > startOffset + endOffset) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const adjustedStart = {
        x: x1 + cos * startOffset,
        y: y1 + sin * startOffset,
      };
      const adjustedEnd = {
        x: x2 - cos * endOffset,
        y: y2 - sin * endOffset,
      };

      if (stroke.dashArray && stroke.dashArray.length > 0) {
        this.drawDashedLine(adjustedStart, adjustedEnd, stroke.width, stroke.dashArray);
      } else {
        this.drawLineBetweenPoints(adjustedStart, adjustedEnd, stroke.width, 1);
      }
    }

    if (markerStart && markerStart !== "none") {
      this.drawMarker(x1, y1, angle + Math.PI, stroke.width, scale, markerStart);
    }
    if (markerEnd && markerEnd !== "none") {
      this.drawMarker(x2, y2, angle, stroke.width, scale, markerEnd);
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
    if (len === 0) return;

    const dirX = dx / len;
    const dirY = dy / len;
    let currentDist = 0;
    let index = 0;

    while (currentDist < len) {
      const dashLen = dashArray[index % dashArray.length];
      if (index % 2 === 0) {
        const drawLen = Math.min(dashLen, len - currentDist);
        const p1 = {
          x: start.x + dirX * currentDist,
          y: start.y + dirY * currentDist,
        };
        const p2 = {
          x: start.x + dirX * (currentDist + drawLen),
          y: start.y + dirY * (currentDist + drawLen),
        };
        this.drawLineBetweenPoints(p1, p2, width, 1);
      }
      currentDist += dashLen;
      index++;
    }
  }

  private drawMarker(
    x: number,
    y: number,
    angle: number,
    lineWidth: number,
    _scale: number,
    type: "arrow" | "triangle" | "reversed_triangle" | "circle" | "diamond" | "round" | "square",
  ): void {
    const gl = this.gl;
    const size = Math.max(lineWidth * 3, 10);
    const halfSize = size / 2;

    let vertices: Float32Array;

    const transform = (p: { x: number; y: number }) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        x: x + p.x * cos - p.y * sin,
        y: y + p.x * sin + p.y * cos,
      };
    };

    if (type === "arrow") {
      const pTip = { x: 0, y: 0 };
      const pTop = { x: -size, y: -halfSize };
      const pBot = { x: -size, y: halfSize };

      const vTip = transform(pTip);
      const vTop = transform(pTop);
      const vBot = transform(pBot);

      this.drawLineBetweenPoints(vTop, vTip, lineWidth, 1);
      this.drawLineBetweenPoints(vBot, vTip, lineWidth, 1);

      const radius = lineWidth / 2;
      this.drawDisc(vTip.x, vTip.y, radius, gl);
      this.drawDisc(vTop.x, vTop.y, radius, gl);
      this.drawDisc(vBot.x, vBot.y, radius, gl);

      return;
    } else if (type === "triangle") {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: -size, y: -halfSize };
      const p3 = { x: -size, y: halfSize };
      const v1 = transform(p1);
      const v2 = transform(p2);
      const v3 = transform(p3);
      vertices = new Float32Array([v1.x, v1.y, v2.x, v2.y, v3.x, v3.y]);
    } else if (type === "reversed_triangle") {
      const p1 = { x: -size, y: 0 };
      const p2 = { x: 0, y: -halfSize };
      const p3 = { x: 0, y: halfSize };
      const v1 = transform(p1);
      const v2 = transform(p2);
      const v3 = transform(p3);
      vertices = new Float32Array([v1.x, v1.y, v2.x, v2.y, v3.x, v3.y]);
    } else if (type === "circle" || type === "round") {
      const segments = 16;
      const radius = halfSize;
      const center = { x: -radius, y: 0 };
      const circleVerts = [];
      for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * Math.PI * 2;
        const a2 = ((i + 1) / segments) * Math.PI * 2;
        const cp1 = { x: center.x + Math.cos(a1) * radius, y: center.y + Math.sin(a1) * radius };
        const cp2 = { x: center.x + Math.cos(a2) * radius, y: center.y + Math.sin(a2) * radius };
        const cv1 = transform(center);
        const cv2 = transform(cp1);
        const cv3 = transform(cp2);
        circleVerts.push(cv1.x, cv1.y, cv2.x, cv2.y, cv3.x, cv3.y);
      }
      vertices = new Float32Array(circleVerts);
    } else if (type === "diamond") {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: -halfSize, y: -halfSize };
      const p3 = { x: -size, y: 0 };
      const p4 = { x: -halfSize, y: halfSize };
      const v1 = transform(p1);
      const v2 = transform(p2);
      const v3 = transform(p3);
      const v4 = transform(p4);

      vertices = new Float32Array([v1.x, v1.y, v2.x, v2.y, v3.x, v3.y, v1.x, v1.y, v3.x, v3.y, v4.x, v4.y]);
    } else if (type === "square") {
      const p1 = { x: 0, y: -halfSize };
      const p2 = { x: -size, y: -halfSize };
      const p3 = { x: -size, y: halfSize };
      const p4 = { x: 0, y: halfSize };

      const v1 = transform(p1);
      const v2 = transform(p2);
      const v3 = transform(p3);
      const v4 = transform(p4);

      vertices = new Float32Array([v1.x, v1.y, v2.x, v2.y, v3.x, v3.y, v1.x, v1.y, v3.x, v3.y, v4.x, v4.y]);
    } else {
      vertices = new Float32Array([]);
    }

    if (vertices.length > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      this.resetRotation();
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
    }
  }

  private drawPath(element: PathElement): void {
    const { id, d, bounds, fill, stroke, opacity, rotation } = element;
    if (!fill && !stroke) return;

    const gl = this.gl;
    const { x, y, width, height } = bounds;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    let cached = this.pathCache.get(id);

    if (cached && cached.d !== d) {
      cached = undefined;
    }

    if (!cached) {
      const commands = parsePath(d);
      if (commands.length === 0) return;

      let fillVertices: Float32Array;
      let strokeVertices: Float32Array;

      try {
        fillVertices = fill ? new Float32Array(pathToFillVertices(commands)) : new Float32Array(0);
        strokeVertices = stroke ? new Float32Array(pathToStrokeVertices(commands, stroke.width)) : new Float32Array(0);
      } catch (e) {
        console.warn("Failed to parse path:", id, e);
        fillVertices = new Float32Array(0);
        strokeVertices = new Float32Array(0);
      }

      let minX = Infinity;
      let minY = Infinity;

      const samples = fillVertices.length > 0 ? fillVertices : strokeVertices;
      if (samples.length > 0) {
        for (let i = 0; i < samples.length; i += 2) {
          if (samples[i] < minX) minX = samples[i];
          if (samples[i + 1] < minY) minY = samples[i + 1];
        }
      } else {
        minX = element.bounds.x;
        minY = element.bounds.y;
      }

      cached = {
        d,
        vertices: fillVertices,
        strokeVertices: strokeVertices,
        nativeBounds: { x: minX, y: minY },
      };
      this.pathCache.set(id, cached);
    }

    const dx = element.bounds.x - cached.nativeBounds.x;
    const dy = element.bounds.y - cached.nativeBounds.y;
    gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_offset"), dx, dy);

    if (fill && cached.vertices.length >= 6) {
      const color = this.cssColorToRGBA(fill);
      color[3] *= (element.fillOpacity ?? 1) * opacity;

      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, cached.vertices, gl.STATIC_DRAW);
      gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...color);
      gl.uniform1f(gl.getUniformLocation(this.shapeProgram!, "u_rotation"), rotation);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_rotationCenter"), centerX, centerY);
      gl.drawArrays(gl.TRIANGLES, 0, cached.vertices.length / 2);
    }

    if (stroke && cached.strokeVertices.length >= 6) {
      const strokeColor = typeof stroke.color === "string" ? stroke.color : "#000000";
      const color = this.cssColorToRGBA(strokeColor);
      color[3] *= (stroke.opacity ?? 1) * opacity;

      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, cached.strokeVertices, gl.STATIC_DRAW);
      gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...color);
      gl.uniform1f(gl.getUniformLocation(this.shapeProgram!, "u_rotation"), rotation);
      gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_rotationCenter"), centerX, centerY);
      gl.drawArrays(gl.TRIANGLES, 0, cached.strokeVertices.length / 2);
    }
  }

  private drawDisc(x: number, y: number, radius: number, gl: WebGLRenderingContext): void {
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
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, floatVertices, gl.STATIC_DRAW);

    this.resetRotation();
    gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_offset"), 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
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

  private calculateGroupOBB(shapes: Shape[], rotation: number): RectElement {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);

    for (const shape of shapes) {
      const corners = this.getRotatedCorners(shape);
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

  private resetRotation(): void {
    const gl = this.gl;
    gl.uniform1f(gl.getUniformLocation(this.shapeProgram!, "u_rotation"), 0);
    gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_rotationCenter"), 0, 0);
    gl.uniform2f(gl.getUniformLocation(this.shapeProgram!, "u_offset"), 0, 0);
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

    const v = this.vertexPool12;
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
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, v.subarray(0, 12), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private drawHandle(x: number, y: number, scale: number): void {
    const gl = this.gl;
    const handleSize = 6 / scale;
    const handleBorder = 1 / scale;
    const hs = handleSize / 2;
    const hb = handleBorder;

    const strokeColor: [number, number, number, number] = [0, 0.6, 1, 1];

    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...strokeColor);
    const v = this.vertexPool12;
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
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, v.subarray(0, 12), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), 1, 1, 1, 1);
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
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, v.subarray(0, 12), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private drawShapeOutline(shape: Shape, scale: number): void {
    const gl = this.gl;

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

  private drawShapesOutlines(shapes: Shape[], scale: number): void {
    if (shapes.length === 0) return;

    const gl = this.gl;
    const strokeColor: [number, number, number, number] = [0, 0.6, 1, 1];
    const borderWidth = 1.5;
    const adjustedWidth = borderWidth / scale;
    const halfWidth = adjustedWidth / 2;

    this.resetRotation();
    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...strokeColor);

    const vertices: number[] = [];

    for (const shape of shapes) {
      const corners = this.getRotatedCorners(shape);
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
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
    }
  }

  private drawShapeOutlineWithHandles(shape: Shape, scale: number): void {
    const gl = this.gl;

    const strokeColor: [number, number, number, number] = [0, 0.6, 1, 1];
    const borderWidth = 1.5;

    const corners = this.getRotatedCorners(shape);
    this.resetRotation();

    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), ...strokeColor);

    if (shape.type === "line") {
      this.drawLineBetweenPoints(corners[0], corners[1], borderWidth, scale);

      this.drawHandle(corners[0].x, corners[0].y, scale);
      this.drawHandle(corners[1].x, corners[1].y, scale);
    } else {
      for (let i = 0; i < 4; i++) {
        this.drawLineBetweenPoints(corners[i], corners[(i + 1) % 4], borderWidth, scale);
      }

      for (const corner of corners) {
        this.drawHandle(corner.x, corner.y, scale);
      }
    }
  }

  private drawBoundingBoxWithHandles(bounds: BoundingBox, _isMultiSelect: boolean, scale: number): void {
    const { x, y, width, height } = bounds;
    const gl = this.gl;

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

    gl.uniform4f(gl.getUniformLocation(this.shapeProgram!, "u_color"), 0, 0.6, 1, 0.1);
    const fillVerts = new Float32Array([x, y, x + w, y, x, y + h, x, y + h, x + w, y, x + w, y + h]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, fillVerts, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

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
