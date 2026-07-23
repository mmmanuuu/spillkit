export type EffectStage = 'pre' | 'post' | 'both';

export type UniformValue =
  | number
  | boolean
  | number[]
  | Float32Array
  | Int32Array;

export type UniformMap = Record<string, UniformValue>;

/** Fragment shader that exposes `vec4 spillShade(vec2 uv)`. */
export interface Shader {
  /** GLSL helpers + `vec4 spillShade(vec2 uv)` implementation. */
  shade: string;
  uniforms?: UniformMap;
  update?(t: number, uniforms: UniformMap): void;
}

export interface MaskSyncContext {
  target: HTMLElement;
  canvas: HTMLCanvasElement;
  /** CSS pixel size of the canvas. */
  width: number;
  height: number;
  /** drawingBufferWidth / CSS width. */
  bufferScaleX: number;
  /** drawingBufferHeight / CSS height. */
  bufferScaleY: number;
}

/**
 * Corner radii in drawing-buffer pixels, CSS order:
 * TL, TR, BR, BL — each [rx, ry].
 */
export type MaskRadii = [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
];

export interface MaskUniforms {
  /** x, y, w, h in drawing-buffer pixels. */
  uMaskRect: [number, number, number, number];
  /** Packed: TLxy, TRxy, BRxy, BLxy. */
  uMaskRadii: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  uMaskEnabled: number;
}

export interface Mask {
  sync(ctx: MaskSyncContext): MaskUniforms;
}

/**
 * Effect that injects GLSL into the composed fragment program.
 * Pre snippets run after `vec2 uv = vUv;` and may reassign `uv`.
 * Post snippets run after `vec4 color = spillShade(uv);` and may reassign `color`.
 */
export interface Effect {
  stage: EffectStage;
  /** Optional GLSL helpers (functions) included once in the program. */
  helpers?: string;
  /** Statements that may modify `uv`. */
  pre?: string;
  /** Statements that may modify `color`. */
  post?: string;
  uniforms?: UniformMap;
  update?(t: number, uniforms: UniformMap): void;
}

export interface CreateSurfaceOptions {
  canvas: HTMLCanvasElement;
  /** Shape source for mask sync. Required when `mask` is set. */
  target?: HTMLElement;
  shader: Shader;
  mask?: Mask;
  effects?: Effect[];
  /** Pause when off-screen or tab hidden. Default true. */
  autoPause?: boolean;
  /** Render-buffer scale vs device pixels. Default 1. */
  resolutionScale?: number;
}

export interface Surface {
  readonly canvas: HTMLCanvasElement;
  setShader(shader: Shader): void;
  setMask(mask: Mask | null): void;
  setEffects(effects: Effect[]): void;
  setUniform(name: string, value: UniformValue): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
