export type {
  CreateSurfaceOptions,
  Effect,
  EffectStage,
  Mask,
  MaskRadii,
  MaskSyncContext,
  MaskUniforms,
  Shader,
  Surface,
  UniformMap,
  UniformValue,
} from './types';

export { createSurface } from './createSurface';
export { shaders, domainWarp } from './shaders/domainWarp';
export type { DomainWarpOptions } from './shaders/domainWarp';
export { masks, cssRoundedRect } from './masks/cssRoundedRect';
export { effects, edgeBulge } from './effects/edgeBulge';
export type { EdgeBulgeOptions } from './effects/edgeBulge';
