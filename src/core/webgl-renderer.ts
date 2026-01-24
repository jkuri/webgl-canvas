import { cssToRGBA } from "@/lib/colors";
import type {
  CanvasElement,
  EllipseElement,
  GroupElement,
  LineElement,
  PathElement,
  RectElement,
  SelectionBox,
  Shape,
  Transform,
} from "@/types";
import { drawEllipse } from "./webgl/renderers/ellipse-renderer";
import { drawLine } from "./webgl/renderers/line-renderer";
import {
  calculateBoundingBox,
  calculateGroupOBB,
  drawBoundingBoxWithHandles,
  drawSelectionBox,
  drawShapeOutline,
  drawShapeOutlineWithHandles,
  drawShapesOutlines,
} from "./webgl/renderers/overlay-renderer";
import { drawPath } from "./webgl/renderers/path-renderer";
import { drawRect } from "./webgl/renderers/rect-renderer";
import { FRAGMENT_SHADER, GRID_FRAGMENT_SHADER, GRID_VERTEX_SHADER, VERTEX_SHADER } from "./webgl/shaders";
import type { RenderContext } from "./webgl/types";
import { createProgram } from "./webgl/utils";

type GetStateFunc = () => {
  transform: Transform;
  elements: CanvasElement[];
  selectedIds: string[];
  selectionBox: SelectionBox | null;
  canvasBackground: string;
  canvasBackgroundVisible: boolean;
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

  private vertexPool12 = new Float32Array(24);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
    if (!gl) throw new Error("WebGL not supported");
    this.gl = gl;
    this.init();
  }

  private init(): void {
    this.shapeProgram = createProgram(this.gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.gridProgram = createProgram(this.gl, GRID_VERTEX_SHADER, GRID_FRAGMENT_SHADER);
    this.positionBuffer = this.gl.createBuffer();
    this.quadBuffer = this.gl.createBuffer();

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      this.gl.STATIC_DRAW,
    );
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

  private getRenderContext(): RenderContext {
    return {
      gl: this.gl,
      program: this.shapeProgram!,
      positionBuffer: this.positionBuffer!,
      vertexPool: this.vertexPool12,
    };
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
      // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook
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
      // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook
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
      const visibleBounds = { minX: visibleMinX, minY: visibleMinY, maxX: visibleMaxX, maxY: visibleMaxY };

      const ctx = this.getRenderContext();

      for (const element of elements) {
        if (element.visible === false) continue;
        if (element.parentId) continue;

        this.renderElement(ctx, element, elements, scale, visibleBounds);
      }

      const selectedIdSet = new Set(selectedIds);
      const selectedElements = elements.filter((e) => selectedIdSet.has(e.id));
      const selectedShapes = this.collectShapes(selectedElements, elements);

      if (selectionBox) {
        for (const shape of selectedShapes) {
          drawShapeOutline(ctx, shape, scale);
        }
      } else {
        if (selectedShapes.length === 1 && selectedElements.length === 1 && selectedElements[0].type !== "group") {
          drawShapeOutlineWithHandles(ctx, selectedShapes[0], scale);
        } else if (selectedShapes.length > 0) {
          if (selectedElements.length === 1 && selectedElements[0].type === "group") {
            const group = selectedElements[0] as GroupElement;
            const obb = calculateGroupOBB(selectedShapes, group.rotation);
            drawShapesOutlines(ctx, selectedShapes, scale);
            drawShapeOutlineWithHandles(ctx, obb, scale);
          } else {
            drawShapesOutlines(ctx, selectedShapes, scale);
            const bounds = calculateBoundingBox(selectedShapes);
            drawBoundingBoxWithHandles(ctx, bounds, true, scale);
          }
        }
      }

      if (selectionBox) {
        drawSelectionBox(ctx, selectionBox, scale);
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
    ctx: RenderContext,
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
        ex = element.x;
        ey = element.y;
        ew = 100;
        eh = 20;
      } else if (element.type === "ellipse") {
        const el = element as EllipseElement;
        ex = el.cx - el.rx;
        ey = el.cy - el.ry;
        ew = el.rx * 2;
        eh = el.ry * 2;
      } else if (element.type === "path") {
        const el = element as PathElement;
        ex = el.bounds.x;
        ey = el.bounds.y;
        ew = el.bounds.width;
        eh = el.bounds.height;
      } else if (element.type === "line") {
        const el = element as LineElement;
        ex = Math.min(el.x1, el.x2);
        ey = Math.min(el.y1, el.y2);
        ew = Math.abs(el.x2 - el.x1);
        eh = Math.abs(el.y2 - el.y1);
      }

      if (element.type !== "group" && ew > 0 && eh > 0) {
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
        drawRect(ctx, element as RectElement, scale);
        break;
      case "ellipse":
        drawEllipse(ctx, element as EllipseElement, scale);
        break;
      case "line":
        drawLine(ctx, element as LineElement, scale);
        break;
      case "path":
        drawPath(ctx, element as PathElement);
        break;
      case "group":
        for (const childId of element.childIds) {
          const child = allElements.find((e) => e.id === childId);
          if (child) {
            this.renderElement(ctx, child, allElements, scale, visibleBounds);
          }
        }
        break;
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
