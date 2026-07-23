import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { defaultVertex, maskHelpers } from './glsl/common';
import type {
  CreateSurfaceOptions,
  Effect,
  Mask,
  MaskUniforms,
  Shader,
  Surface,
  UniformMap,
  UniformValue,
} from './types';

const DISABLED_MASK: MaskUniforms = {
  uMaskRect: [0, 0, 1, 1],
  uMaskRadii: [0, 0, 0, 0, 0, 0, 0, 0],
  uMaskEnabled: 0,
};

const MASK_POLL_MS = 200;

function toOglUniforms(map: UniformMap): Record<string, { value: UniformValue }> {
  const out: Record<string, { value: UniformValue }> = {};
  for (const [key, value] of Object.entries(map)) {
    out[key] = { value };
  }
  return out;
}

function buildFragment(shader: Shader, effects: Effect[]): string {
  const helpers = effects
    .map((e) => e.helpers ?? '')
    .filter(Boolean)
    .join('\n');

  const pre = effects
    .filter((e) => e.stage === 'pre' || e.stage === 'both')
    .map((e) => e.pre ?? '')
    .filter(Boolean)
    .join('\n  ');

  const post = effects
    .filter((e) => e.stage === 'post' || e.stage === 'both')
    .map((e) => e.post ?? '')
    .filter(Boolean)
    .join('\n  ');

  return /* glsl */ `
#extension GL_OES_standard_derivatives : enable
precision highp float;

varying vec2 vUv;

${maskHelpers}
${helpers}
${shader.shade}

void main() {
  vec2 uv = vUv;
  ${pre}
  vec4 color = spillShade(uv);
  ${post}
  color.a *= spillMaskAlpha(gl_FragCoord.xy);
  gl_FragColor = color;
}
`;
}

export function createSurface(options: CreateSurfaceOptions): Surface {
  const {
    canvas,
    target,
    resolutionScale = 1,
    autoPause = true,
  } = options;

  if (options.mask && !target) {
    throw new Error('createSurface: `target` is required when a mask is set');
  }

  let shader = options.shader;
  let mask: Mask | null = options.mask ?? null;
  let effects = options.effects ? [...options.effects] : [];

  const dpr = Math.min(window.devicePixelRatio || 1, 2) * resolutionScale;
  const renderer = new Renderer({
    canvas,
    alpha: true,
    antialias: false,
    dpr,
    webgl: 1,
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  gl.getExtension('OES_standard_derivatives');

  const geometry = new Triangle(gl);
  let program!: Program;
  let mesh!: Mesh;

  let rafId = 0;
  let running = false;
  let startTime = performance.now();
  let elapsed = 0;
  let destroyed = false;
  let visible = true;
  let pageVisible = document.visibilityState !== 'hidden';
  let lastMaskKey = '';
  let pollTimer = 0;

  const observeEl = target ?? canvas;

  const applyMaskUniforms = (m: MaskUniforms) => {
    const u = program.uniforms;
    if (u.uMaskRect) u.uMaskRect.value = m.uMaskRect;
    if (u.uMaskRadii) u.uMaskRadii.value = m.uMaskRadii;
    if (u.uMaskEnabled) u.uMaskEnabled.value = m.uMaskEnabled;
  };

  const renderFrame = () => {
    renderer.render({ scene: mesh });
  };

  const syncMask = (force = false) => {
    if (!mask || !target) {
      applyMaskUniforms(DISABLED_MASK);
      lastMaskKey = 'off';
      return;
    }

    const width = observeEl.clientWidth || 1;
    const height = observeEl.clientHeight || 1;
    const bufferScaleX = width > 0 ? gl.drawingBufferWidth / width : 1;
    const bufferScaleY = height > 0 ? gl.drawingBufferHeight / height : 1;

    const next = mask.sync({
      target,
      canvas,
      width,
      height,
      bufferScaleX,
      bufferScaleY,
    });

    const key = JSON.stringify(next);
    if (!force && key === lastMaskKey) return;
    lastMaskKey = key;
    applyMaskUniforms(next);
  };

  const resize = () => {
    // Size from the layout host, not the canvas — OGL setSize writes
    // inline width/height and would otherwise lock the default 300×150.
    const w = observeEl.clientWidth || 1;
    const h = observeEl.clientHeight || 1;
    renderer.setSize(w, h);
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'none',
    });
    const res = program.uniforms.uResolution;
    if (res) {
      res.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
    }
    syncMask(true);
    if (!running) renderFrame();
  };

  const rebuildProgram = () => {
    const uniforms: UniformMap = {
      uMaskRect: [...DISABLED_MASK.uMaskRect],
      uMaskRadii: [...DISABLED_MASK.uMaskRadii],
      uMaskEnabled: 0,
      ...(shader.uniforms ?? {}),
    };
    for (const effect of effects) {
      Object.assign(uniforms, effect.uniforms ?? {});
    }

    program = new Program(gl, {
      vertex: defaultVertex,
      fragment: buildFragment(shader, effects),
      uniforms: toOglUniforms(uniforms),
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    mesh = new Mesh(gl, { geometry, program });
    resize();
  };

  const canRun = () => {
    if (destroyed) return false;
    if (!autoPause) return true;
    return visible && pageVisible;
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(rafId);
  };

  const start = () => {
    if (running || !canRun()) return;
    running = true;
    startTime = performance.now();
    rafId = requestAnimationFrame(loop);
  };

  const loop = (now: number) => {
    if (!running || destroyed) return;
    elapsed += (now - startTime) / 1000;
    startTime = now;

    const live: UniformMap = {};
    for (const [name, u] of Object.entries(program.uniforms)) {
      live[name] = u.value as UniformValue;
    }
    shader.update?.(elapsed, live);
    for (const effect of effects) {
      effect.update?.(elapsed, live);
    }
    for (const [name, value] of Object.entries(live)) {
      const u = program.uniforms[name];
      if (u) u.value = value;
    }

    renderFrame();
    rafId = requestAnimationFrame(loop);
  };

  const onVisibility = () => {
    pageVisible = document.visibilityState !== 'hidden';
    if (canRun()) start();
    else stop();
  };

  rebuildProgram();

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(canvas);
  if (target && target !== canvas) resizeObserver.observe(target);

  let intersectionObserver: IntersectionObserver | null = null;
  if (autoPause) {
    intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (canRun()) start();
        else stop();
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(canvas);
    document.addEventListener('visibilitychange', onVisibility);
  }

  if (mask) {
    pollTimer = window.setInterval(() => syncMask(false), MASK_POLL_MS);
  }

  start();
  if (!running) renderFrame();

  return {
    canvas,

    setShader(next) {
      shader = next;
      rebuildProgram();
      if (!running) renderFrame();
    },

    setMask(next) {
      if (next && !target) {
        throw new Error('createSurface: `target` is required when a mask is set');
      }
      mask = next;
      window.clearInterval(pollTimer);
      pollTimer = 0;
      if (mask) {
        pollTimer = window.setInterval(() => syncMask(false), MASK_POLL_MS);
      }
      syncMask(true);
      if (!running) renderFrame();
    },

    setEffects(next) {
      effects = [...next];
      rebuildProgram();
      if (!running) renderFrame();
    },

    setUniform(name, value) {
      const u = program.uniforms[name];
      if (u) {
        u.value = value;
        if (!running) renderFrame();
      }
    },

    pause: stop,

    resume() {
      if (autoPause && !canRun()) return;
      start();
    },

    destroy() {
      destroyed = true;
      stop();
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
      window.clearInterval(pollTimer);
      if (autoPause) {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    },
  };
}
