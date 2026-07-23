# spillkit

WebGL shader surfaces for UI elements. Compose a generative **shader**, an optional CSS-driven **mask**, and optional edge **effects** onto a canvas you own.

Framework-agnostic TypeScript. React bindings can come later as a separate package.

## Install

```bash
npm install spillkit
```

Peer runtime: [OGL](https://github.com/oframe/ogl) (bundled as a dependency).

## Concepts

| Piece | Required | Role |
|-------|----------|------|
| **Shader** | yes | Draws the visual field (`domainWarp`, or your own GLSL). |
| **Mask** | no | Clips to a shape from a DOM element's box + `border-radius`. |
| **Effect** | no | Pre (UV warp) and/or post (color) passes; can use the mask edge. |

Mask and effects are independent: you can mask without an effect, or run effects without a mask (unless the effect needs an edge).

## Quick start

Provide a canvas and a target element for shape sync. Size/position the canvas yourself (e.g. absolute fill inside the button).

```html
<button id="btn" style="position: relative; border-radius: 18px; overflow: hidden">
  <canvas id="canvas" style="position: absolute; inset: 0; width: 100%; height: 100%"></canvas>
  <span style="position: relative">Get started</span>
</button>
```

```ts
import { createSurface, shaders, masks, effects } from 'spillkit'

const surface = createSurface({
  canvas: document.querySelector('#canvas')!,
  target: document.querySelector('#btn')!,
  shader: shaders.domainWarp({
    colors: ['#ffb25e', '#ff6f91', '#9d7bff', '#56d6ff'],
    warp: 0.4,
    scale: 0.72,
  }),
  mask: masks.cssRoundedRect(),
  effects: [effects.edgeBulge({ strength: 0.28 })],
})

// Tune at runtime
surface.setUniform('uWarp', 0.8)
surface.setUniform('uBulgeStrength', 0.4)

// Lifecycle
surface.pause()
surface.resume()
surface.destroy()
```

Circles work as a square host with `border-radius: 50%`.

## API

### `createSurface(options)`

| Option | Default | Description |
|--------|---------|-------------|
| `canvas` | — | Caller-owned `<canvas>`. |
| `target` | — | DOM node whose layout + `border-radius` drive the mask. Required when `mask` is set. |
| `shader` | — | Shader instance. |
| `mask` | `undefined` | Optional mask. |
| `effects` | `[]` | Optional effects, in order. |
| `autoPause` | `true` | Pause when off-screen or the tab is hidden. |
| `resolutionScale` | `1` | Scale vs device pixel ratio (e.g. `0.85` for cheaper fills). |

Returns a `Surface`: `setShader`, `setMask`, `setEffects`, `setUniform`, `pause`, `resume`, `destroy`.

### Built-in shader — `shaders.domainWarp(options?)`

Animated domain-warped color field (fbm → warp → OKLab mix → grain).

| Option | Default | Uniform |
|--------|---------|---------|
| `colors` | pastel quartet | `uColor0`–`uColor3` |
| `speed` | `0.21` | `uSpeed` |
| `warp` | `0.4` | `uWarp` |
| `scale` | `0.72` | `uScale` |
| `grain` | `0.02` | `uGrain` |
| `saturation` | `1.5` | `uSaturation` |
| `contrast` | `1.6` | `uContrast` |

### Built-in mask — `masks.cssRoundedRect()`

Reads `clientWidth` / `clientHeight` and computed `border-radius` (per corner). Syncs on resize and polls lightly for CSS changes.

### Built-in effect — `effects.edgeBulge(options?)`

Pre-effect: warps sample UVs near the masked edge for a soft protruding / fisheye look. Needs an active mask.

| Option | Default | Uniform |
|--------|---------|---------|
| `strength` | `0.22` | `uBulgeStrength` |
| `falloff` | `0.35` | `uBulgeFalloff` |

## Custom shaders

A shader exposes GLSL that defines `vec4 spillShade(vec2 uv)` plus optional uniforms:

```ts
import type { Shader } from 'spillkit'

const myShader: Shader = {
  uniforms: { uTime: 0, uResolution: [1, 1] },
  update(t, u) {
    u.uTime = t
  },
  shade: /* glsl */ `
    uniform float uTime;
    uniform vec2 uResolution;

    vec4 spillShade(vec2 uv) {
      vec3 col = vec3(uv, 0.5 + 0.5 * sin(uTime));
      return vec4(col, 1.0);
    }
  `,
}
```

Mask helpers (`spillMaskSD`, `spillMaskAlpha`) and effect snippets are composed around your shade function automatically.

## Develop

```bash
npm install
npm run dev      # local Vite playground
npm run build    # emit dist/
npm run typecheck
```

## Releasing

Merges into `main` that carry a SemVer label create a git tag automatically:

| PR label | Bump |
|----------|------|
| `patch` | `0.1.0` → `0.1.1` |
| `minor` | `0.1.0` → `0.2.0` |
| `major` | `0.1.0` → `1.0.0` |

Add exactly one of those labels before merge (if several are present, `major` wins over `minor` over `patch`). No label → no tag. The workflow bumps `package.json`, commits `chore: release vX.Y.Z`, and pushes annotated tag `vX.Y.Z`.

## License

MIT
