/**
 * Whole-lake ambient water, in the renderer's 540 × 960 design coordinates.
 * Draw AFTER the original scene and BEFORE fish, rig, reeds and shore grass.
 * Replaces the old paintWater pass; never layer both ambient-water passes.
 *
 * `cover` is the existing imageCover result: { sx, sy, sw, sh, scale }.
 * `texture` is the loaded lake-ripple-texture.webp image. It is a translucent
 * lighting material, not a replacement background. Missing texture is safe.
 * `time` is seconds from the parent's already pause-frozen motion clock.
 * This function has no internal clock/state; reducedMotion fixes time at zero.
 */
export const LAKE_WATER_TEXTURE_URL = './assets/lake-ripple-texture.webp';
export const LAKE_WATER_LIMITS = Object.freeze({
  width: 540, height: 960, textureStripHeight: 2, reflectionStripHeight: 4,
  maxDrawImageCalls: 510,
});

const W = 540, H = 960;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const size = image => ({ w: image?.naturalWidth || image?.width || 0, h: image?.naturalHeight || image?.height || 0 });

/** Named mask geometry keeps the distant bank and photographic plants fixed.
 * The lower-left inset follows the original foreground plant cluster; the
 * separate animated reed/grass assets are painted over this layer as before.
 */
export function traceLakeWaterMask(ctx, waterline = 314) {
  ctx.beginPath();
  ctx.moveTo(0, waterline + 4);
  ctx.lineTo(458, waterline + 4);
  ctx.lineTo(491, waterline + 14);
  ctx.lineTo(W, waterline + 25);
  ctx.lineTo(W, H);
  ctx.lineTo(171, H);
  ctx.lineTo(161, 914);
  ctx.lineTo(149, 888);
  ctx.lineTo(137, 862);
  ctx.lineTo(125, 842);
  ctx.lineTo(128, 822);
  ctx.lineTo(116, 800);
  ctx.lineTo(98, 782);
  ctx.lineTo(56, 768);
  ctx.lineTo(44, 735);
  ctx.lineTo(22, 715);
  ctx.lineTo(0, 699);
  ctx.closePath();
}

/** Continuous, non-repeating perspective mapping, exposed for validation. */
export function lakeWaterSample(y, time = 0, waterline = 314) {
  const depth = clamp((y - waterline) / (H - waterline), 0, 1);
  const t = finite(time);
  const perspective = .22 + .73 * (1 - depth) ** 1.52;
  const rise = Math.log1p(depth * 11) / Math.log(12);
  // Several unrelated wavelengths: no modulo/tile wrap, scrolling reset or
  // repeating horizontal stripe grid. Every sample stays inside the texture.
  return {
    depth,
    sourceWidth: perspective,
    sourceX: (1 - perspective) * .5 + Math.sin(t * .29 + depth * 3.1) * .012
      + Math.sin(t * .17 - depth * 5.6) * .006,
    sourceY: .025 + rise * .90 + Math.sin(t * .32 + depth * 5.8) * .010
      + Math.sin(t * .21 - depth * 9.3) * .004,
    // Fine in the distance, broader and more legible toward the camera.
    alpha: (.34 + depth * .18) * smooth((y - waterline - 3) / 20),
  };
}

export function drawLakeWater(ctx, {
  scene = null, cover = null, texture = null, time = 0,
  reducedMotion = false, waterline = 314,
} = {}) {
  waterline = clamp(finite(waterline, 314), 260, 410);
  const t = reducedMotion ? 0 : finite(time);
  let reflectionDraws = 0, textureDraws = 0;
  ctx.save(); traceLakeWaterMask(ctx, waterline); ctx.clip();

  if (scene && cover && cover.scale > 0) {
    // Re-sample ONLY the scene's own reflection. Geometry displacement tapers
    // out at the shallow bed; surface lighting continues to the foreground.
    const step = LAKE_WATER_LIMITS.reflectionStripHeight;
    for (let y = Math.ceil(waterline + 4); y < 872; y += step) {
      const depth = clamp((y - waterline) / 550, 0, 1);
      const fade = smooth((y - waterline - 4) / 38) * (1 - smooth((y - 708) / 160));
      const dx = (Math.sin(y * .037 + t * .62 + Math.sin(y * .011) * 1.5) * 2.1
        + Math.sin(y * .019 - t * .39) * 1.25) * (.22 + depth * 1.32) * fade;
      const dy = (Math.sin(y * .061 + t * .54) * .95
        + Math.sin(y * .026 - t * .31) * .4) * depth * fade;
      const sy = cover.sy + (y + dy) / cover.scale;
      const sh = Math.min((step + .2) / cover.scale, cover.sy + cover.sh - sy);
      if (sh <= 0) continue;
      ctx.globalAlpha = .84 * fade;
      // Overscan a few pixels within the source crop, keeping both sides filled.
      ctx.drawImage(scene, cover.sx, sy, cover.sw, sh, dx - 5, y, W + 10, sh * cover.scale);
      reflectionDraws++;
    }
  }

  const tex = size(texture);
  if (tex.w && tex.h && texture.complete !== false) {
    // Soft-light keeps the original blue/green colour and photographic detail.
    // Each row has a unique continuous UV; the generated image never repeats.
    ctx.globalCompositeOperation = 'soft-light';
    const step = LAKE_WATER_LIMITS.textureStripHeight;
    for (let y = Math.ceil(waterline + 4); y < H; y += step) {
      const h = Math.min(step, H - y);
      const a = lakeWaterSample(y, t, waterline);
      const b = lakeWaterSample(y + h, t, waterline);
      const sw = a.sourceWidth * tex.w;
      const sx = clamp(a.sourceX * tex.w, 0, tex.w - sw);
      const sy = clamp(a.sourceY * tex.h, 0, tex.h - 1);
      const sh = Math.max(.12, Math.min((b.sourceY - a.sourceY) * tex.h, tex.h - sy));
      ctx.globalAlpha = a.alpha;
      ctx.drawImage(texture, sx, sy, sw, sh, 0, y, W, h);
      textureDraws++;
    }
  }
  ctx.restore();
  return { reflectionDraws, textureDraws, drawImageCalls: reflectionDraws + textureDraws };
}

export default drawLakeWater;
