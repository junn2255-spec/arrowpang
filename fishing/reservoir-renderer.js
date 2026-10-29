import {paintDistantFish} from './distant-fish.js';
import {traceLakeWaterMask} from './lake-water-layer.js';
import {paintEnvironmentLight,paintRain} from './environment-renderer.js';
import {paintApprovedReservoirWater,paintApprovedShore} from './approved-water-v12.js';
/**
 * V3.6 reservoir presentation. Geometry is supplied by the fixed-line controller;
 * this module never invents rod/line positions or changes the cast simulation.
 * Native Canvas2D only. All coordinates use a 540 × 960 portrait design space.
 */
export const RESERVOIR_LAYOUT = Object.freeze({
  width: 540, height: 960, waterline: 314,
  water: Object.freeze({ x: 0, y: 314, width: 540, height: 646 }),
  aim: Object.freeze({ left: 125, right: 430, top: 395, bottom: 645 }),
  foreground: Object.freeze({ top: 795, bottom: 960 }),
});

const W = 540, H = 960, TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const imageSize = im => ({ width: im?.naturalWidth || im?.width || 0, height: im?.naturalHeight || im?.height || 0 });
const smooth = n => (n = clamp(n, 0, 1), n * n * (3 - 2 * n));

// The reflected image moves visibly while the bank and lake bed stay still.
// Amplitudes remain a few pixels: sheltered reservoir ripples, never sea waves.
const WATER_CONTRAST = 1.68, NEAR_WAVE_AMPLITUDE = 1.46, REFLECTION_WARP = 2.05;
// Stable, scattered crests avoid a fresh particle field each frame or parallel
// full-width bands. More samples occupy far water, with several wave lengths.
const WIND_RIDGES = Object.freeze(Array.from({ length: 228 }, (_, i) => Object.freeze({
  x: rand(i + 80) * 610 - 35,
  depth: .018 + Math.pow(rand(i + 12), 1.65) * .95,
  frequency: .34 + rand(i + 9) * .28,
  phase: rand(i + 277) * TAU,
  width: 9 + rand(i + 400) * 29,
  scale: [.58, 1, 1.62][i % 3],
  bend: rand(i + 708) * 2 - 1,
})));

function imageCover(im) {
  const size = imageSize(im);
  if (!size.width || !size.height || im?.complete === false) return null;
  const scale = Math.max(W / size.width, H / size.height);
  return { sx: (size.width - W / scale) / 2, sy: (size.height - H / scale) / 2,
    sw: W / scale, sh: H / scale, scale };
}

function ellipse(ctx, x, y, rx, ry, stroke, width = 1) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU);
  ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.stroke();
}

function fallbackScene(ctx, waterline) {
  const sky = ctx.createLinearGradient(0, 0, 0, waterline);
  sky.addColorStop(0, '#58a0d3'); sky.addColorStop(1, '#d7e7e5');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle = ['#729591', '#456f61', '#365a3c'][layer];
    ctx.beginPath(); ctx.moveTo(-20, waterline + 5);
    for (let x = -20; x <= 560; x += 12) {
      const y = waterline - 40 - (2 - layer) * 24 + Math.sin(x * .017 + layer) * 26 + Math.sin(x * .042 + layer * 3) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(560, waterline + 8); ctx.closePath(); ctx.fill();
  }
  const lake = ctx.createLinearGradient(0, waterline, 0, H);
  lake.addColorStop(0, '#608779'); lake.addColorStop(.25, '#548f9d');
  lake.addColorStop(.72, '#316f81'); lake.addColorStop(1, '#294e4c');
  ctx.fillStyle = lake; ctx.fillRect(0, waterline, W, H - waterline);
}

function paintWater(ctx, image, cover, t, waterline, moving) {
  ctx.save(); ctx.beginPath();
  // Keep the existing distant shore, including the right-bank hut, intact.
  ctx.moveTo(0, waterline + 4); ctx.lineTo(458, waterline + 4);
  ctx.lineTo(491, waterline + 10); ctx.lineTo(W, waterline + 23);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip();
  if (cover && moving) {
    // Re-sample the scene's own reflected water, never the skyline or trees.
    // Incommensurate, phase-modulated waves break up rhythmic striping. Small
    // overlapping samples stay seamless; distortion fades before the visible
    // shallow bottom so its stones and plants do not swim with the reflection.
    for (let y = waterline + 4; y < H - 82; y += 2) {
      const depth = clamp((y - waterline) / 500, 0, 1);
      const envelope = smooth((y - waterline) / 54) * (1 - smooth((y - 675) / 203));
      const phase = y * .041 + Math.sin(y * .013 + t * .09) * 1.6;
      const dx = (Math.sin(phase + t * .47) * 1.27 + Math.sin(y * .017 - t * .31) * .72) * depth * envelope * REFLECTION_WARP;
      const dy = (Math.sin(y * .093 + Math.sin(y * .021) + t * .51) * .42
        + Math.sin(y * .034 - t * .27) * .10) * depth * envelope * REFLECTION_WARP;
      const sourceY = cover.sy + (y + dy) / cover.scale;
      const sh = Math.min(2.3 / cover.scale, cover.sy + cover.sh - sourceY);
      if (sh > 0) ctx.drawImage(image, cover.sx, sourceY, cover.sw, sh, dx, y, W, sh * cover.scale);
    }
  }
  // Very slow, transparent depth colour leaves the photographed plants and
  // lake bed visible. No moving gradient edge or changing shoreline.
  const breath = Math.sin(t * .12) * .004;
  const tint = ctx.createLinearGradient(0, waterline, 0, H);
  tint.addColorStop(0, 'rgba(97,142,112,0)');
  tint.addColorStop(.26, `rgba(113,157,159,${(.014 + breath).toFixed(4)})`);
  tint.addColorStop(.64, `rgba(94,143,162,${(.021 + breath).toFixed(4)})`);
  tint.addColorStop(1, 'rgba(69,112,100,.012)');
  ctx.fillStyle = tint; ctx.fillRect(0, waterline, W, H - waterline);
  for (const ridge of WIND_RIDGES) {
    const depth = ridge.depth, phase = ridge.phase + t * ridge.frequency;
    const nearAmplitude = lerp(1, NEAR_WAVE_AMPLITUDE, smooth(depth));
    const x = ridge.x + Math.sin(phase * .43) * (.35 + depth * 2.5);
    const y = waterline + 8 + depth * (H - waterline - 18)
      + Math.sin(phase * .61 + ridge.bend) * (.12 + depth * .7) * nearAmplitude;
    const length = (3 + depth * ridge.width) * ridge.scale;
    const amplitude = (.10 + depth * depth * .92) * ridge.scale * nearAmplitude;
    const flicker = .5 + .5 * Math.sin(phase);
    const alpha = (.012 + flicker * .048) * (.3 + depth * .7) * WATER_CONTRAST;
    // Two unequal curves form a broken wind crest rather than an ellipse. The
    // trough is quiet and the short sun-facing edge catches reflected daylight.
    const crest = offset => {
      ctx.beginPath(); ctx.moveTo(x, y + offset);
      ctx.bezierCurveTo(x + length * .17, y + offset - amplitude * (1 + ridge.bend * .25),
        x + length * .39, y + offset + amplitude * .45, x + length * .61, y + offset - amplitude * .2);
      ctx.quadraticCurveTo(x + length * .81, y + offset - amplitude * .75, x + length, y + offset + amplitude * ridge.bend * .22);
    };
    ctx.lineCap = 'round'; ctx.lineWidth = .4 + depth * .7;
    ctx.strokeStyle = `rgba(13,57,71,${(alpha * .42).toFixed(4)})`; crest(.4 + depth * .55); ctx.stroke();
    ctx.strokeStyle = `rgba(237,249,231,${alpha.toFixed(4)})`; crest(0); ctx.stroke();
  }
  ctx.restore();
}

function fallbackReeds(ctx, t) {
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 31; i++) {
      const r = rand(i + side * 41), baseX = side ? W - r * 88 : r * 93;
      const length = 48 + rand(i + 341) * 91;
      const sway = Math.sin(t * .55 + i * .7) * 2.1;
      const tipX = baseX + (side ? -1 : 1) * (12 + r * 28) + sway;
      ctx.strokeStyle = ['#637b36', '#7d953d', '#a0a654', '#384f2a'][i % 4];
      ctx.lineWidth = 1 + r * 1.6; ctx.beginPath(); ctx.moveTo(baseX, H + 5);
      ctx.quadraticCurveTo(baseX, H - length * .53, tipX, H - length); ctx.stroke();
      if (i % 3 === 0) {
        ctx.strokeStyle = '#a18c50'; ctx.lineWidth = 2.3;
        ctx.beginPath(); ctx.moveTo(tipX, H - length); ctx.lineTo(tipX + 2, H - length - 11); ctx.stroke();
      }
    }
  }
}

function paintReeds(ctx, image, t) {
  const c = imageCover(image);
  if (!c) return fallbackReeds(ctx, t);
  // The portrait cutout is a sparse lower-left cluster. Keep it small and
  // anchored below the screen; its tallest plumes begin around y=750.
  ctx.save(); ctx.translate(-12, H + 40);
  ctx.transform(1, 0, Math.sin(t * .43) * .009, 1, 0, 0);
  ctx.drawImage(image, c.sx, c.sy, c.sw, c.sh, 0, -338, 190, 338);
  ctx.restore();
}

function paintTarget(ctx, cast, t) {
  const target = cast.target || cast.landingTarget;
  if (!point(target) || !['ready', 'preparing', 'charging', 'charge', 'aiming', 'backswing'].includes(cast.phase)) return;
  const charge = clamp(finite(cast.charge) / 100, 0, 1);
  const green = charge >= .70 && charge <= .85, orange = charge >= .90;
  const rgb = orange ? '244,169,71' : green ? '162,232,139' : '238,248,219';
  const breathing = .85 + Math.sin(t * 1.5) * .06;
  ctx.save(); ctx.globalAlpha = breathing;
  ellipse(ctx, target.x, target.y, 21, 5.9, 'rgba(15,44,44,.25)', 3);
  ctx.setLineDash([3, 5]); ellipse(ctx, target.x, target.y, 21, 5.9, `rgba(${rgb},.72)`, .95); ctx.setLineDash([]);
  ellipse(ctx, target.x, target.y, 8, 2.5, `rgba(${rgb},.52)`, .8);
  ctx.fillStyle = `rgba(${rgb},.75)`; ctx.beginPath(); ctx.ellipse(target.x, target.y, 1.3, .8, 0, 0, TAU); ctx.fill();
  if (charge > .02) {
    ctx.translate(target.x, target.y); ctx.scale(1, .28);
    ctx.strokeStyle = `rgba(${rgb},.9)`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 25, -Math.PI / 2, -Math.PI / 2 + TAU * charge); ctx.stroke();
  }
  ctx.restore();
}

function paintSplash(ctx, cast) {
  if (cast.rigVisible === false || cast.floatVisible === false) return;
  const age = cast.splashAge ?? cast.impactAge ?? cast.splash?.age;
  const impact = cast.impact || cast.splash || cast.landing || cast.float;
  if (!point(impact) || !Number.isFinite(age) || age < 0 || age > 2.1) return;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const a = age - i * .115; if (a < 0) continue;
    const fade = Math.max(0, 1 - a / (1.7 + i * .13));
    const depth = clamp((impact.y - RESERVOIR_LAYOUT.waterline) / 480, 0, 1);
    const radius = (3 + Math.sqrt(a) * 34) * (.63 + depth * .68);
    const flatten = .09 + depth * .19;
    ellipse(ctx, impact.x, impact.y + 2, radius, radius * flatten,
      `rgba(231,246,225,${(fade * .36).toFixed(3)})`, .8);
    if (i === 0) ellipse(ctx, impact.x, impact.y + 2.5, radius + 1.3, radius * flatten + .4,
      `rgba(22,57,61,${(fade * .16).toFixed(3)})`, .65);
  }
  if (age < .46) {
    for (let i = 0; i < 10; i++) {
      const angle = i * 2.399, speed = 20 + rand(i + 180) * 26;
      const x = impact.x + Math.cos(angle) * speed * age;
      const y = impact.y - (22 + rand(i + 98) * 33) * age + 128 * age * age;
      ctx.globalAlpha = (1 - age / .46) * .78;
      ctx.fillStyle = '#e9f4e6'; ctx.beginPath(); ctx.ellipse(x, y, .6, 1.2, angle * .14, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

function segmentWaterContact(a, b) {
  if (!point(a) || !point(b) || !Number.isFinite(a.z) || !Number.isFinite(b.z)
    || a.z < 0 || b.z > 0) return null;
  const u = a.z === b.z ? 0 : a.z / (a.z - b.z);
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: 0 };
}

// The scene projection is affine: interpolate the same rope samples used below,
// rather than projecting the submerged mouth vertically onto the lake.
export function lineWaterContact(cast) {
  if (cast.rigVisible === false || cast.lineVisible === false) return null;
  const points = Array.isArray(cast.linePoints) ? cast.linePoints.filter(point) : [];
  for (let i = 1; i < points.length; i++) {
    const p = segmentWaterContact(points[i - 1], points[i]);
    if (p) return p;
  }
  return null;
}

function paintLine(ctx, cast) {
  if (cast.rigVisible === false || cast.lineVisible === false) return;
  const fish = activeFish(cast);
  const endpoint = fish && point(fish.mouth) ? fish.mouth : cast.float;
  if (!point(cast.tip) || !point(endpoint)) return;
  const supplied = Array.isArray(cast.linePoints) ? cast.linePoints.filter(point) : [];
  // A fighting fish is the true fixed-line endpoint. The float is only a point
  // on that same rope; replacing its last sample would detach line from mouth.
  const points = supplied.length ? (fish ? supplied : [cast.tip, ...supplied.slice(1, -1), endpoint]) : [cast.tip, endpoint];
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const contact = a.z * b.z < 0 ? segmentWaterContact(a, b) || segmentWaterContact(b, a) : null;
    if (contact) segments.push([a, contact], [contact, b]);
    else segments.push([a, b]);
  }
  for (const [a, b] of segments) {
    const submerged = Number.isFinite(a.z) && Number.isFinite(b.z) && (a.z + b.z) / 2 < 0;
    // Real slack may project below the float while remaining above world water.
    // Preserve its geometry, but avoid a bright doubled-antenna/reflection illusion.
    const lowSlack = !fish && (cast.float?.onWater || cast.float?.wet) ? clamp((Math.max(a.y, b.y) - cast.float.y - 2) / 14, 0, 1) : 0;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = submerged ? 'rgba(26,63,57,.06)' : `rgba(27,49,39,${lerp(.23, .025, lowSlack).toFixed(3)})`; ctx.lineWidth = 1.25; ctx.stroke();
    const tension = fish ? clamp(finite(fish.tension, 35) / 100, 0, 1) : 0;
    const pull=fish?.phase==='fight'?clamp(finite(fish.resistance),0,1):0;
    ctx.strokeStyle = submerged ? `rgba(154,187,164,${(.10+pull*.09).toFixed(3)})` : `rgba(231,244,231,${lerp(Math.min(.98,.64 + tension * .20+pull*.15), .07, lowSlack).toFixed(3)})`; ctx.lineWidth = .62 + tension * .18+pull*.35; ctx.stroke();
  }
  ctx.restore();
}

function distanceAlong(points, wanted) {
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (walked + length >= wanted || i === points.length - 1) {
      const p = length ? clamp((wanted - walked) / length, 0, 1) : 0;
      return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), nx: -(b.y - a.y) / (length || 1), ny: (b.x - a.x) / (length || 1) };
    }
    walked += length;
  }
  return null;
}

/** The only centreline is the controller's articulated rod. Tube shading and
 * diameter do not shift a point, the tip or the fixed-line attachment. */
function paintRod(ctx, cast) {
  const supplied = Array.isArray(cast.rodPoints) ? cast.rodPoints.filter(point) : [];
  if (supplied.length < 2) return;
  const points = supplied.map(p => ({ ...p }));
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = lengths.at(-1) || 1;
  const radius = fraction => .62 + 10.8 * Math.pow(1 - clamp(fraction, 0, 1), 1.47);
  // The short rigid handle continues behind the physical grip and out of view.
  // It never alters the simulated rod or its line anchor.
  const grip = points[0], next = points[1], dx = grip.x - next.x, dy = grip.y - next.y;
  if (dy > .01 && grip.y < H + 28) {
    const factor = (H + 28 - grip.y) / dy;
    const end = { x: grip.x + dx * factor, y: H + 28 };
    points.unshift(end); lengths.unshift(-Math.hypot(end.x - grip.x, end.y - grip.y));
  }
  const vertices = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { ...p, nx: -(b.y - a.y) / d, ny: (b.x - a.x) / d,
      r: lengths[i] < 0 ? radius(0) + Math.min(3, -lengths[i] / 42) : radius(lengths[i] / total) };
  });
  const outline = () => {
    ctx.beginPath();
    vertices.forEach((v, i) => ctx[i ? 'lineTo' : 'moveTo'](v.x + v.nx * v.r, v.y + v.ny * v.r));
    for (let i = vertices.length - 1; i >= 0; i--) { const v = vertices[i]; ctx.lineTo(v.x - v.nx * v.r, v.y - v.ny * v.r); }
    ctx.closePath();
  };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(3,10,15,.46)'; ctx.shadowBlur = 4.2; ctx.shadowOffsetX = 1.6; ctx.shadowOffsetY = 1.1;
  outline(); ctx.fillStyle = '#05090f'; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  // Curved-surface graphite gradient: black occlusion, broad cool reflected sky,
  // narrow bright specular, then a dark edge. Shared normals prevent joint seams.
  for (let i = 1; i < vertices.length; i++) {
    const a = vertices[i - 1], b = vertices[i], nx = (a.nx + b.nx) / 2, ny = (a.ny + b.ny) / 2;
    const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, r = (a.r + b.r) / 2;
    const shade = ctx.createLinearGradient(x - nx * r, y - ny * r, x + nx * r, y + ny * r);
    for (const [stop, color] of [[0, '#03070d'], [.14, '#080f18'], [.35, '#172333'], [.49, '#364759'], [.565, '#8593a0'], [.60, '#c3c5bf'], [.635, '#71808d'], [.71, '#253441'], [.91, '#080e17'], [1, '#18212a']]) shade.addColorStop(stop, color);
    ctx.fillStyle = shade; ctx.beginPath();
    ctx.moveTo(a.x + a.nx * a.r, a.y + a.ny * a.r); ctx.lineTo(b.x + b.nx * b.r, b.y + b.ny * b.r);
    ctx.lineTo(b.x - b.nx * b.r, b.y - b.ny * b.r); ctx.lineTo(a.x - a.nx * a.r, a.y - a.ny * a.r); ctx.closePath(); ctx.fill();
  }
  // Continuous fine glints follow the real flex, rather than a straight overlay.
  for (const [offset, color, width] of [[.21, 'rgba(240,235,214,.64)', .6], [-.86, 'rgba(2,7,13,.64)', .8], [.91, 'rgba(179,193,202,.40)', .5]]) {
    ctx.beginPath(); vertices.forEach((v, i) => ctx[i ? 'lineTo' : 'moveTo'](v.x + v.nx * v.r * offset, v.y + v.ny * v.r * offset));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  const sections = [.045, .065, .205, .39, .575, .74, .865, .945];
  for (let index = 0; index < sections.length; index++) {
    const fraction = sections[index], p = distanceAlong(supplied, total * fraction); if (!p) continue;
    const r = radius(fraction) + .3, width = lerp(4.8, 1.4, fraction), gold = index % 3 !== 2;
    const shade = ctx.createLinearGradient(p.x - p.nx * r, p.y - p.ny * r, p.x + p.nx * r, p.y + p.ny * r);
    const colors = gold ? ['#483321', '#927049', '#f4d79b', '#fff2c5', '#a47d45', '#493722'] : ['#303942', '#8c969e', '#e7eee9', '#f4f7ef', '#727e89', '#25313d'];
    [0, .28, .53, .61, .78, 1].forEach((stop, i) => shade.addColorStop(stop, colors[i]));
    ctx.beginPath(); ctx.moveTo(p.x - p.nx * r, p.y - p.ny * r); ctx.lineTo(p.x + p.nx * r, p.y + p.ny * r);
    ctx.lineCap = 'butt'; ctx.strokeStyle = shade; ctx.lineWidth = width; ctx.stroke();
    // Hairline black ferrule seat makes the sleeve sit around the tube.
    const tx = p.ny, ty = -p.nx;
    ctx.beginPath(); ctx.moveTo(p.x - p.nx * r + tx * width * .58, p.y - p.ny * r + ty * width * .58);
    ctx.lineTo(p.x + p.nx * r + tx * width * .58, p.y + p.ny * r + ty * width * .58);
    ctx.strokeStyle = 'rgba(2,6,9,.8)'; ctx.lineWidth = .65; ctx.stroke();
  }
  ctx.restore();
}

function paintLiftOut(ctx, cast) {
  if (cast.rigVisible === false || cast.floatVisible === false) return;
  const lift = cast.liftOut;
  if (!lift || lift.active === false || !point(lift.position) || !Number.isFinite(lift.age) || lift.age < 0 || lift.age > .72) return;
  const p = lift.position, age = lift.age, depth = clamp((p.y - RESERVOIR_LAYOUT.waterline) / 480, 0, 1);
  ctx.save();
  const fade = 1 - age / .72;
  ellipse(ctx, p.x, p.y + 2, (7 + age * 27) * (.65 + depth), (1.7 + age * 6) * (.55 + depth), `rgba(221,240,230,${(fade * .38).toFixed(3)})`, .8);
  for (let i = 0; i < 7; i++) {
    const delay = i * .034, a = age - delay; if (a < 0 || a > .48) continue;
    const x = p.x + (rand(i + 602) - .5) * 39 * a;
    const y = p.y - (25 + rand(i + 613) * 21) * a + 120 * a * a;
    ctx.globalAlpha = Math.max(0, 1 - a / .48) * .78;
    ctx.fillStyle = '#e4f5ee'; ctx.beginPath(); ctx.ellipse(x, y, .65, 1.65, -.12 + i * .035, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// First slender float in the cleaned 1548 × 1016 user-supplied atlas. Its
// silhouette is clipped geometrically, never by deleting red/yellow pixels.
// This excludes the source's nearly transparent coloured fringe while keeping
// the actual body shading and bands. The physical tail stays at local y=8.
const FLOAT_ART = Object.freeze({ x: 612, y: 622, width: 30, height: 326,
  atlasWidth: 1548, atlasHeight: 1016, top: -31, bottom: 8, centerX: 627, widthScale: 1.4 });
const FLOAT_ART_PROFILE = Object.freeze([
  [623, 626, 630], [627, 622, 634], [635, 619.2, 636.2],
  [679, 618.7, 636.2], [701, 618.3, 635.7], [710, 617.1, 637.1],
  [736, 614.1, 639.8], [753, 614.4, 639.2], [781, 616.1, 637.4],
  [813, 618, 635.8], [835, 617.5, 636], [868, 615.5, 638],
  [905, 614, 639.6], [920, 616.2, 637.2], [936, 620.4, 633.1],
  [946, 624.6, 628.6], [948, 627, 627],
].map(row => Object.freeze(row)));

function paintAtlasFloat(ctx, atlas) {
  const image = imageSize(atlas);
  if (!image.width || !image.height || atlas.complete === false
    || (typeof atlas.naturalWidth === 'number' && (!atlas.naturalWidth || !atlas.naturalHeight))) return false;
  const art = FLOAT_ART, k = (art.bottom - art.top) / art.height;
  // Constant horizontal art legibility adjustment, independent of phase and
  // distance. The same world-derived outer scale and physical height remain.
  const local = (x, y) => [(x - art.centerX) * k * art.widthScale, art.top + (y - art.y) * k];
  ctx.save(); ctx.beginPath();
  FLOAT_ART_PROFILE.forEach(([y, left], i) => ctx[i ? 'lineTo' : 'moveTo'](...local(left, y)));
  for (let i = FLOAT_ART_PROFILE.length - 1; i >= 0; i--) {
    const [y, , right] = FLOAT_ART_PROFILE[i]; ctx.lineTo(...local(right, y));
  }
  ctx.closePath(); ctx.clip();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const sx = image.width / art.atlasWidth, sy = image.height / art.atlasHeight;
  ctx.drawImage(atlas, art.x * sx, art.y * sy, art.width * sx, art.height * sy,
    (art.x - art.centerX) * k * art.widthScale, art.top, art.width * k * art.widthScale, art.bottom - art.top);
  ctx.restore();
  return true;
}

function paintProceduralFloat(ctx) {
  ctx.lineCap = 'round';
  const shaft = (a, b, colors, width = 3.5) => {
    const gradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
    gradient.addColorStop(0, colors[0]); gradient.addColorStop(.36, colors[1]); gradient.addColorStop(.52, colors[2]); gradient.addColorStop(1, colors[0]);
    ctx.strokeStyle = gradient; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(0, a); ctx.lineTo(0, b); ctx.stroke();
  };
  shaft(-31, -18, ['#c42713', '#ff5626', '#ffe2a5'], 3.6);
  shaft(-16.7, -14.3, ['#05090b', '#263b42', '#53615b'], 3.5);
  shaft(-12.8, -7.7, ['#bda20d', '#fff63b', '#fffdb7'], 3.4);
  shaft(-6.2, -3.6, ['#030708', '#1d292b', '#78816f'], 3.3);
  const bodyGradient = ctx.createLinearGradient(-3.25, 0, 3.25, 0);
  bodyGradient.addColorStop(0, '#9c2c11'); bodyGradient.addColorStop(.3, '#f96723'); bodyGradient.addColorStop(.49, '#ffd999'); bodyGradient.addColorStop(.64, '#ff8d32'); bodyGradient.addColorStop(1, '#7f210b');
  ctx.fillStyle = bodyGradient; ctx.beginPath(); ctx.ellipse(0, 1.5, 3.25, 6.7, 0, 0, TAU); ctx.fill();
  shaft(-2.1, -.7, ['#ad9a0a', '#f8ed30', '#ffffa9'], 4.7);
  shaft(8, 12, ['#111a17', '#30392a', '#626b4b'], 1.1);
}

function paintFloat(ctx, cast, fishing, t, atlas, environment = {}) {
  if (cast.rigVisible === false || cast.floatVisible === false) return;
  const p = cast.float; if (!point(p)) return;
  const phase = cast.phase || 'ready';
  const wet = p.onWater ?? p.wet ?? cast.onWater ?? ['impact', 'settling', 'settled', 'landed', 'waiting', 'bite', 'fighting'].includes(phase);
  const depth = clamp((p.y - RESERVOIR_LAYOUT.waterline) / 480, 0, 1);
  // The controller derives scale from actual 3D camera distance. Screen y and
  // phase are deliberately excluded: rising in flight cannot fake getting near.
  const size = 2 * clamp(finite(p.scale, 1), .72, 1.5);
  const bite = wet && fishing?.phase === 'bite';
  const visualDip = bite ? 42 * smooth(clamp(finite(fishing.phaseElapsed) / .28, 0, 1)) : 0;
  // Surface stays fixed while the controller's genuine z displacement dips and
  // restores the body. The lower half is clipped beneath the water surface.
  const surfaceY = wet ? (!activeFish(cast) && point(cast.impact) ? cast.impact.y : p.y + finite(p.z) * 115) : p.y;
  const contact = wet ? lineWaterContact(cast) : null;
  const ripple = contact || { x: p.x, y: surfaceY };
  let angle = finite(p.angle, finite(p.rotation));
  if (!Number.isFinite(p.angle) && !Number.isFinite(p.rotation) && point(p.velocity) && Math.hypot(p.velocity.x, p.velocity.y) > 5) angle = Math.atan2(p.velocity.x, -p.velocity.y);
  ctx.save();
  if (wet) {
    for (let i = 0; i < 2; i++) {
      const wave = (t * (bite ? .40 : .27) + i / 2) % 1;
      const rx = (3 + wave * (bite ? 16 : 14)) * (.68 + depth * .62), ry = rx * (.09 + depth * .16);
      ellipse(ctx, ripple.x, ripple.y + (contact ? 0 : 1.2), rx, ry,
        `rgba(228,245,232,${((1 - wave) * (bite ? .19 : .17)).toFixed(3)})`, .55 + depth * .2);
      ellipse(ctx, ripple.x, ripple.y + (contact ? 0 : 2), rx + .8, ry + .3,
        `rgba(13,53,62,${((1 - wave) * .075).toFixed(3)})`, .45);
    }
    // A short, soft, broken reflection. Never draw a second mirrored float.
    const reflectionFade = clamp(1 - visualDip / 29, 0, 1);
    for (let i = 0; i < 4; i++) {
      const y = surfaceY + 2.6 + i * 1.35; // final soft strip ends within 7.2 px
      const width = (1.75 - i * .27) * size, drift = Math.sin(t * 1.2 + i * 1.3) * .65;
      ctx.fillStyle = i < 1 ? `rgba(243,183,49,${(.070 * reflectionFade).toFixed(3)})` : `rgba(255,85,36,${((.065 - i * .012) * reflectionFade).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(p.x + drift, y, width, .48, 0, 0, TAU); ctx.fill();
    }
    ctx.beginPath(); ctx.rect(p.x - 18 * size, p.y - 85 * size, 36 * size, Math.max(0, surfaceY + 1.5 - (p.y - 85 * size))); ctx.clip();
  }
  ctx.translate(p.x, p.y); ctx.scale(size, size); ctx.rotate(wet ? 0 : angle); ctx.translate(0, visualDip);
  if (!paintAtlasFloat(ctx, atlas)) paintProceduralFloat(ctx);
  if(environment.isNight){
    // Chemical-light tip belongs to the same float transform and surface clip.
    // It sinks out of view with the real bite; it is never a second bobber.
    ctx.save();ctx.shadowColor='#baff56';ctx.shadowBlur=9;ctx.strokeStyle='#d8ff89';ctx.lineWidth=2.4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,-30);ctx.lineTo(0,-19);ctx.stroke();ctx.restore();
  }
  ctx.restore();
  if (!wet && !activeFish(cast)) {
    const sinker = point(cast.sinker) ? cast.sinker : { x: p.x + .5, y: p.y + 17 * size };
    const hook = point(cast.hook) ? cast.hook : { x: sinker.x + .6, y: sinker.y + 7 * size };
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(224,230,199,.71)'; ctx.lineWidth = .5;
    const tail = { x: p.x - Math.sin(angle) * 8 * size, y: p.y + Math.cos(angle) * 8 * size };
    ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(sinker.x, sinker.y); ctx.lineTo(hook.x, hook.y); ctx.stroke();
    const lead = ctx.createLinearGradient(sinker.x - 1.1, sinker.y, sinker.x + 1.1, sinker.y);
    lead.addColorStop(0, '#232b2d'); lead.addColorStop(.5, '#a5afaa'); lead.addColorStop(1, '#343c3c');
    ctx.fillStyle = lead; ctx.beginPath(); ctx.ellipse(sinker.x, sinker.y, 1.15, 1.8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d2d7c4'; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(hook.x, hook.y - 2); ctx.lineTo(hook.x, hook.y + 1.1); ctx.bezierCurveTo(hook.x + .2, hook.y + 4, hook.x + 3.9, hook.y + 2.7, hook.x + 3.1, hook.y + .8); ctx.stroke();
    ctx.restore();
  }
}

// Gameplay fish/effects consume projected simulation anchors. The final landed
// showcase alone may be reframed in screen space, without changing world data.
const FISH_ROWS = Object.freeze({ 'pale-chub': 0, 'rainbow-trout': 1, 'cherry-salmon': 2, 'golden-carp': 3 });
// Measured from the final generated RGBA atlas, preserving every tail and fin.
// The source is intentionally not regridded/rescaled: each pose gets its own
// true nose and tail anchor, so switching poses cannot detach or slide the head.
const FISH_ATLAS_ROWS = [[0, 245], [245, 245], [490, 234], [724, 300]];
const FISH_ATLAS_ANCHORS = [
  [[491, 153, 50], [476, 149, 52], [475, 147.5, 37]],
  [[493, 132.5, 40], [478, 136, 38], [480, 135, 29]],
  [[494, 139.5, 44], [478, 139.5, 41], [478, 139.5, 28]],
  [[496, 142.5, 47], [478, 145.5, 54], [477, 149, 24]],
];
export const FISH_ATLAS_LAYOUT = Object.freeze({ width: 1536, height: 1024, columns: 3, rows: 4, slices: 18,
  frames: Object.freeze(FISH_ATLAS_ANCHORS.map((row, r) => Object.freeze(row.map(([mouthX, mouthY, tailX], c) => Object.freeze({
    x: c * 512, y: FISH_ATLAS_ROWS[r][0], width: 512, height: FISH_ATLAS_ROWS[r][1], mouthX, mouthY, tailX,
  }))))),
});
export const SCENE_EFFECT_LIMITS = Object.freeze({ fishRipples: 4, dropletsPerRipple: 16, leaves: 2, fishSlices: 18 });
const FISH_PHASES = new Set(['hook', 'fight', 'catch']);
function activeFish(cast) {
  const f = cast.fishVisual;
  if (cast.rigVisible === false || ['ready', 'retrieving', 'escaped'].includes(cast.phase)
    || !f?.active || !FISH_PHASES.has(f.phase)) return null;
  return f;
}

function paintFishRipples(ctx, cast, reducedMotion) {
  const fish = activeFish(cast); if (!fish) return;
  const contact = !fish.airborne && ['hook', 'fight'].includes(fish.phase) ? lineWaterContact(cast) : null;
  ctx.save();
  const recent = Array.isArray(fish.ripples) ? fish.ripples.slice(-16) : [];
  // Preserve a real entry/hook burst when newer, quiet swimming wakes arrive.
  const events = recent.filter(e => e.kind !== 'wake').slice(-SCENE_EFFECT_LIMITS.fishRipples);
  const available = SCENE_EFFECT_LIMITS.fishRipples - events.length;
  if (available) events.push(...recent.filter(e => e.kind === 'wake').slice(-available));
  for (const event of events) {
    if (['hook','fight'].includes(fish.phase) && event.kind !== 'wake') continue;
    const p = event.kind === 'wake' && contact ? contact : event.position, age = event.age;
    if (!point(p) || !Number.isFinite(age) || age < 0 || age > 1.8) continue;
    const force = clamp(finite(event.strength, 1), .25, 1.6);
    const depth = clamp((p.y - RESERVOIR_LAYOUT.waterline) / 460, 0, 1);
    const scale = (.72 + depth * .42) * force;
    const fade = Math.pow(1 - age / 1.8, 1.3);
    if (event.kind === 'wake') {
      // Underwater swimming produces a modest surface wrinkle, not repeated
      // jump splashes. Burst particles belong only to actual contact events.
      const radius = (3 + Math.sqrt(age) * 25) * scale;
      ellipse(ctx, p.x, p.y + (contact ? 0 : 1), radius, radius * .18, `rgba(226,245,234,${(fade * .23).toFixed(3)})`, .6);
      continue;
    }
    for (let ring = 0; ring < 3; ring++) {
      const a = age - ring * .11; if (a < 0) continue;
      const radius = (4 + Math.sqrt(a) * 37) * scale;
      ellipse(ctx, p.x, p.y + 1.8, radius, radius * (.14 + depth * .12), `rgba(236,252,243,${(fade * (.48 - ring * .09)).toFixed(3)})`, ring ? .8 : 1.25);
      if (!ring) ellipse(ctx, p.x, p.y + 3.2, radius + 1.2, radius * (.14 + depth * .12) + .5, `rgba(15,58,68,${(fade * .26).toFixed(3)})`, 1.1);
    }
    if (reducedMotion || age > .68) continue;
    // A low, curved crown grows from the actual entry point and dissolves into
    // a small fixed set of ballistic drops. No accumulated particle objects.
    const lift = Math.sin(clamp(age / .46, 0, 1) * Math.PI), crownFade = Math.max(0, 1 - age / .52);
    ctx.lineCap = 'round';
    if (crownFade > 0) {
      ctx.strokeStyle = `rgba(219,248,247,${(crownFade * .62).toFixed(3)})`; ctx.lineWidth = 1.7;
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath(); ctx.moveTo(p.x + side * 3, p.y + 1);
        ctx.quadraticCurveTo(p.x + side * 14 * scale, p.y - 26 * scale * lift,
          p.x + side * 22 * scale * lift, p.y - 11 * scale * lift); ctx.stroke();
      }
    }
    for (let i = 0; i < SCENE_EFFECT_LIMITS.dropletsPerRipple; i++) {
      const seed = i + (event.kind === 'hook' ? 81 : event.kind === 'catch' ? 311 : 171);
      const a = age - (i % 3) * .014; if (a < 0 || a > .62) continue;
      const dx = (rand(seed) - .5) * 104 * scale;
      const vy = (41 + rand(seed + 93) * 63) * scale;
      const x = p.x + dx * a, y = p.y - vy * a + 150 * a * a;
      if (y > p.y + 4) continue;
      ctx.globalAlpha = (1 - a / .68) * .88;
      ctx.fillStyle = i % 4 ? '#e9faf4' : '#9fd9e3';
      ctx.beginPath(); ctx.ellipse(x, y, .58 + rand(seed + 64) * .50, 1.3 + rand(seed + 20) * 1.1,
        Math.atan2(-dx, vy - 300 * a) * .35, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function paintFishWake(ctx, fish, t, contact = null) {
  const p = !fish.airborne && contact ? contact : fish.waterAnchor; if (!point(p)) return;
  const length = clamp(finite(fish.bodyLength, 42), 8, 150);
  ctx.save();
  if (fish.airborne) {
    const height = clamp(finite(fish.jumpHeight), 0, 1.4);
    ctx.fillStyle = `rgba(9,47,57,${(.12 * (1 - height * .32)).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, length * (.32 + height * .08), 2.2 + height * 1.7, 0, 0, TAU); ctx.fill();
  } else {
    const direction = finite(fish.heading, 1) < 0 ? -1 : 1;
    const surge = (fish.surge ? 1.35 : 1) * (1 + clamp(finite(fish.resistance),0,1)*.8);
    const width = length * .7, pulse = .88 + Math.sin(t * 2.4) * .12;
    // At the rope contact, omit the upper wake branch that reads as a short
    // extra fishing line. Keep the lower wake and legacy free-water wake.
    for (const side of contact ? [1] : [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(p.x + (contact ? 0 : direction * length * .12), p.y);
      ctx.bezierCurveTo(p.x - direction * width * .12, p.y + side * 2,
        p.x - direction * width * .7, p.y + side * 4.2 * surge,
        p.x - direction * width, p.y + side * 7 * surge);
      const wakeColor = `rgba(225,247,239,${(.21 * pulse * surge).toFixed(3)})`;
      if (contact) {
        // Feather only the wake's shared root: two bright wake branches must
        // not look like a kink or extra strand attached to the fishing line.
        const rootFade = ctx.createLinearGradient(p.x, p.y, p.x - direction * width * .18, p.y);
        rootFade.addColorStop(0, 'rgba(225,247,239,0)');
        rootFade.addColorStop(1, wakeColor);
        ctx.strokeStyle = rootFade;
      } else ctx.strokeStyle = wakeColor;
      ctx.lineWidth = .75; ctx.stroke();
    }
  }
  ctx.restore();
}

// Approved 1254px 4×2 atlas: measured transparent gutters and water-contact
// anchors. Real distinct poses, never drawImage(animatedWebP)'s first frame.
export const RESISTANCE_SPLASH_FRAMES = Object.freeze(Array.from({length:8},(_,i)=>{
  const col=i%4,row=Math.floor(i/4),x=Math.round(col*1254/4),end=Math.round((col+1)*1254/4);
  return Object.freeze({x,y:row*627,width:end-x,height:627,anchorX:(end-x)/2,anchorY:row?478:485});
}));
export function paintResistanceSplash(ctx, cast, atlas, reducedMotion=false) {
  const fish=activeFish(cast);if(!fish||fish.phase!=='fight')return;
  const contact = !fish.airborne ? lineWaterContact(cast) : null;
  const bursts=(fish.ripples||[]).filter(e=>e.kind==='resistance'&&e.age>=0&&e.age<1.1).slice(-2);
  ctx.save();
  for(const e of bursts){
    const p=contact||e.position;if(!point(p))continue;
    const age=e.age,force=clamp(finite(e.strength,1),.35,1),depth=clamp((p.y-RESERVOIR_LAYOUT.waterline)/460,0,1);
    const width=(88+depth*35)*(.8+force*.2),side=finite(e.side,1)<0?-1:1;
    // A short low surface boil, not the former tall frame-stepped fountain.
    // Keep the two residual-water atlas poses and blend continuously. Actual
    // airborne droplets below follow individual gravity arcs and disappear.
    for(let ring=0;ring<3;ring++){
      const a=age-ring*.08;if(a<0)continue;
      const radius=width*(.16+Math.sqrt(a)*.54),fade=Math.pow(Math.max(0,1-age/1.1),1.6);
      ellipse(ctx,p.x+(contact?0:side*a*7),p.y+(contact?0:2),radius,radius*.15,`rgba(224,247,243,${(fade*(.36-ring*.075)*force).toFixed(3)})`,ring?.7:1.15);
    }
    if(reducedMotion)continue;
    const fade=smooth(age/.035)*(1-smooth((age-.12)/.40));
    if(usableFishAtlas(atlas)&&fade>0){
      const size=imageSize(atlas),blend=smooth(age/.40),k=width/280;
      for(const [index,alpha] of [[0,1-blend],[7,blend]]){
        if(alpha<.001)continue;
        const f=RESISTANCE_SPLASH_FRAMES[index];
        // Crop only the low water ellipse, preserving its measured anchor.
        const top=420,height=140;
        ctx.globalAlpha=fade*alpha*.58;
        ctx.drawImage(atlas,f.x*size.width/1254,(f.y+top)*size.height/1254,f.width*size.width/1254,height*size.height/1254,
          p.x-f.anchorX*k,p.y+(top-f.anchorY)*k*.72,f.width*k,height*k*.72);
      }
      ctx.globalAlpha=1;
    }
    if(age<.46){
      for(let i=0;i<14;i++){
        const seed=i*31+finite(e.resistanceId,1)*67,a=age-rand(seed)*.055;if(a<0)continue;
        const vx=side*(12+rand(seed+3)*45)+(rand(seed+7)-.5)*34;
        const vz=(45+rand(seed+11)*90)*(.7+force*.3),z=vz*a-210*a*a;
        if(z<=0)continue;
        const x=p.x+vx*a,y=p.y-z+(rand(seed+19)-.5)*9;
        ctx.globalAlpha=(1-a/.46)*(.45+rand(seed+23)*.35);ctx.fillStyle='#e9faf6';
        ctx.beginPath();ctx.ellipse(x,y,.55+rand(seed+29)*.65,1+rand(seed+37)*.85,-side*.3,0,TAU);ctx.fill();
      }
      ctx.globalAlpha=1;
    }
  }
  ctx.restore();
}

function usableFishAtlas(atlas) {
  const size = imageSize(atlas);
  return size.width >= 3 && size.height >= 4 && atlas.complete !== false
    && !(typeof atlas.naturalWidth === 'number' && (!atlas.naturalWidth || !atlas.naturalHeight));
}

// Rows are the four existing species; columns bend-up, neutral, bend-down.
// Eighteen vertical strips bend increasingly toward the tail, leaving the head
// and exact mouth/line attachment fixed. Adjacent poses cross-fade smoothly.
function paintFishAtlas(ctx, atlas, fish, length, flex, reducedMotion) {
  if (!usableFishAtlas(atlas)) return false;
  const size = imageSize(atlas), layout = FISH_ATLAS_LAYOUT;
  const sx = size.width / layout.width, sy = size.height / layout.height;
  const row = FISH_ROWS[fish.fish?.id] ?? 0;
  // Slow pose blends sit underneath faster geometric tail flex, avoiding rapid
  // whole-body brightness beats during the final catch flap.
  const amount = reducedMotion ? 0 : Math.sin(flex * .30), mix = Math.abs(amount);
  const frames = mix < .001 ? [[1, 1]] : [[1, 1 - mix], [amount < 0 ? 0 : 2, mix]];
  const alpha = ctx.globalAlpha;
  for (const [frame, weight] of frames) {
    if (weight < .001) continue;
    const art = layout.frames[row][frame], body = art.mouthX - art.tailX, k = length / body;
    ctx.globalAlpha = alpha * weight;
    for (let i = 0; i < layout.slices; i++) {
      const u = i / layout.slices, end = (i + 1) / layout.slices;
      const tail = clamp((art.mouthX - (u + end) * .5 * art.width) / body, 0, 1);
      const bend = reducedMotion ? 0 : Math.sin(flex - tail * 4.4) * length * .040 * tail * tail;
      const x = (u * art.width - art.mouthX) * k;
      // Source and destination overlaps stay inside this exact species/pose.
      // Full source height retains tail tips, dorsal fins and delicate barbels.
      const sw = Math.min(art.width - u * art.width, art.width / layout.slices + .35);
      ctx.drawImage(atlas, (art.x + u * art.width) * sx, art.y * sy, sw * sx, art.height * sy,
        x, -art.mouthY * k + bend, sw * k, art.height * k);
    }
  }
  ctx.globalAlpha = alpha;
  return true;
}

export const CRUCIAN_POSES = Object.freeze([
  [0,0,535,520,526,328.23],[535,0,517,520,506,358.55],[1052,0,484,520,471,358.75],
  [0,540,535,484,529,219.33],[535,540,517,484,512,237.14],[1052,540,484,484,472,237.16]
].map(a=>Object.freeze(a)));
function paintCrucianAtlas(ctx, atlas, fish, length, flex, reducedMotion) {
  if(!usableFishAtlas(atlas))return false;
  // Six genuine body/tail/fin poses. Time is the controller's pause-frozen
  // flex clock, not an independently running animated image decoder.
  const pose=reducedMotion?0:Math.floor(Math.abs(flex)*.54)%6;
  const [sx,sy,sw,sh,mx,my]=CRUCIAN_POSES[pose],k=length/500;
  const size=imageSize(atlas),xs=size.width/1536,ys=size.height/1024;
  for(let i=0;i<48;i++){
    const x=i/48*sw,ww=Math.min(sw-x,sw/48+.3),tail=clamp((mx-x)/(mx-35),0,1);
    const bend=reducedMotion?0:Math.sin(flex-tail*4)*length*.018*tail*tail;
    ctx.drawImage(atlas,(sx+x)*xs,sy*ys,ww*xs,sh*ys,(x-mx)*k,-my*k+bend,ww*k,sh*k);
  }
  return true;
}

export function paintSpeciesFish(ctx,image,fish,length,flex,reducedMotion){
  if(!usableFishAtlas(image))return false;
  const anchors={'striped-beakfish':[1507/1536,572/1024],'sea-bass':[1505/1536,526/1024],sogari:[1481/1511,491/978],carp:[1508/1536,543/993],catfish:[1424/1544,549/1011],eel:[1521/1543,404/863]};
  const anchor=anchors[fish.fish?.id]||[.96,.5],size=imageSize(image),mouthX=size.width*anchor[0],mouthY=size.height*anchor[1],k=length/(mouthX-size.width*.025);
  const strips=fish.fish?.id==='eel'?64:48;
  for(let i=0;i<strips;i++){
    const x=i/strips*size.width,ww=Math.min(size.width-x,size.width/strips+.35),tail=clamp((mouthX-x)/mouthX,0,1);
    const bend=reducedMotion?0:Math.sin(flex-tail*(fish.fish?.id==='eel'?5.4:4))*length*(fish.fish?.id==='eel'?.050:.025)*tail*tail;
    ctx.drawImage(image,x,0,ww,size.height,(x-mouthX)*k,-mouthY*k+bend,ww*k,size.height*k);
  }
  return true;
}

function paintProceduralFish(ctx, fish, length, flex, reducedMotion) {
  const row = FISH_ROWS[fish.fish?.id] ?? 0, deep = row === 3 ? .19 : .13;
  const tail = reducedMotion ? 0 : Math.sin(flex) * length * .13;
  const middle = reducedMotion ? 0 : Math.sin(flex - 1.2) * length * .032;
  const palette = [['#34535a', '#9ccbd0', '#e2e5bf'], ['#42595a', '#b5c1b0', '#e4bdba'], ['#344d43', '#b4bc95', '#e6dfb7'], ['#75531e', '#daa94c', '#fff0a0']][row];
  // Fins and tail are articulated with the same body bend, not a rigid icon.
  ctx.fillStyle = palette[1]; ctx.strokeStyle = palette[0]; ctx.lineWidth = .7;
  ctx.beginPath(); ctx.moveTo(-length * .79, middle);
  ctx.lineTo(-length, tail - length * .17); ctx.quadraticCurveTo(-length * .94, tail, -length, tail + length * .17);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-length * .60, middle - length * deep * .66);
  ctx.lineTo(-length * .57, middle - length * (deep + .095));
  ctx.lineTo(-length * .34, -length * deep * .66); ctx.closePath(); ctx.fill();
  const gradient = ctx.createLinearGradient(0, -length * deep, 0, length * deep);
  gradient.addColorStop(0, palette[0]); gradient.addColorStop(.33, palette[1]); gradient.addColorStop(.68, palette[2]); gradient.addColorStop(1, palette[1]);
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-length * .12, -length * deep, -length * .40, middle - length * deep * 1.32, -length * .83, middle);
  ctx.bezierCurveTo(-length * .48, middle + length * deep, -length * .12, length * deep, 0, 0);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = row === 1 ? '#bc7890' : 'rgba(245,253,237,.50)'; ctx.lineWidth = row === 1 ? 2.1 : .7;
  ctx.beginPath(); ctx.moveTo(-length * .13, length * .022); ctx.quadraticCurveTo(-length * .39, middle + length * .023, -length * .72, middle); ctx.stroke();
  // Small species markings are deterministic, so scales never shimmer randomly.
  if (row === 1 || row === 2) {
    ctx.fillStyle = row === 1 ? 'rgba(26,43,40,.65)' : 'rgba(60,87,62,.5)';
    for (let i = 0; i < 10; i++) {
      const x = -length * (.23 + rand(i + 91) * .43), y = middle * .5 + (rand(i + 232) - .65) * length * deep;
      ctx.beginPath(); ctx.ellipse(x, y, row === 2 ? 1.1 : .65, row === 2 ? 2.2 : .65, -.2, 0, TAU); ctx.fill();
    }
  }
  ctx.fillStyle = palette[0]; ctx.beginPath(); ctx.ellipse(-length * .095, -length * .028, 1.7, 1.9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fffce1'; ctx.beginPath(); ctx.ellipse(-length * .086, -length * .039, .55, .55, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = palette[0]; ctx.lineWidth = .7;
  ctx.beginPath(); ctx.moveTo(-length * .21, -length * deep * .67); ctx.quadraticCurveTo(-length * .15, 0, -length * .22, length * deep * .70); ctx.stroke();
}

// Requested visual multipliers are relative to V6 at the same camera distance.
// Never multiply 2 × 5, and never cap the resulting catch back down to phone width.
export function fishPresentation(fish, reducedMotion = false) {
  const extendedSpecies=['sogari','carp','catfish','eel','sea-bass'].includes(fish.fish?.id);
  const baseLength = clamp(finite(fish.baseBodyLength, finite(fish.bodyLength,42)),8,extendedSpecies?250:150);
  const caught = fish.phase === 'catch';
  const multiplier = caught ? (extendedSpecies?2.6:5) * 1.3 * .7 * 1.5 : 2 * (['crucian','golden-carp'].includes(fish.fish?.id)?1:4);
  const heading = caught ? 1 : (finite(fish.heading,1)<0?-1:1);
  const p = smooth(clamp(finite(fish.catchProgress)/.32,0,1));
  const targetAngle = -Math.PI/2 + (reducedMotion?0:Math.sin(finite(fish.flexPhase)*.19)*.055);
  const originalAngle = finite(fish.angle);
  const angle = caught ? originalAngle + Math.atan2(Math.sin(targetAngle-originalAngle),Math.cos(targetAngle-originalAngle))*p + finite(fish.catchDisplayAngle) : originalAngle;
  return { baseLength, multiplier, length:baseLength*multiplier, heading, angle, underwater:!caught };
}

// Measured visible-art envelopes (alpha > 4/255), in sixteen vertical regions.
// Regions retain delicate fins/whiskers and follow the same mouth anchors as
// the strip renderer. A two-pixel output guard includes filtered edge pixels.
// Keeping the silhouette, rather than its transparent image rectangle, lets
// large catches clear the lower controls without reducing the requested scale.
const CATCH_ART_PROFILES = Object.freeze({"striped-beakfish":[{"w":1024,"h":683,"mx":1004.6666666666666,"my":381.51953125,"regions":[[0,202,64,499],[64,204,128,496],[128,234,192,465],[192,278,256,422],[256,114,320,570],[320,114,384,566],[384,134,448,548],[448,106,512,548],[512,74,576,537],[576,70,640,629],[640,70,704,614],[704,82,768,564],[768,123,832,523],[832,193,896,501],[896,239,960,470],[960,313,1024,437]]}],"sea-bass":[{"w":1024,"h":683,"mx":1003.3333333333334,"my":350.837890625,"regions":[[0,209,64,474],[64,221,128,459],[128,261,192,420],[192,302,256,391],[256,248,320,494],[320,181,384,486],[384,182,448,448],[448,229,512,451],[512,166,576,454],[576,142,640,527],[640,144,704,529],[704,200,768,469],[768,235,832,446],[832,254,896,437],[896,280,960,420],[960,304,1024,404]]}],
  "crucian": [{"w":535,"h":520,"mx":526,"my":328.23,"regions":[[25,223,34,388],[34,223,67,392],[67,228,101,384],[101,247,134,398],[134,259,168,429],[168,207,201,423],[201,174,235,401],[235,150,268,476],[268,148,301,473],[301,154,335,447],[335,182,368,415],[368,210,402,411],[402,223,435,402],[435,242,469,387],[469,274,502,372],[502,297,528,357]]},{"w":517,"h":520,"mx":506,"my":358.55,"regions":[[1,142,33,289],[33,151,65,302],[65,186,97,388],[97,232,130,394],[130,248,162,390],[162,207,194,407],[194,182,227,484],[227,165,259,481],[259,161,291,459],[291,163,324,439],[324,186,356,439],[356,234,388,436],[388,250,421,428],[421,274,453,414],[453,305,485,399],[485,327,508,384]]},{"w":484,"h":520,"mx":471,"my":358.75,"regions":[[6,158,31,215],[31,97,61,304],[61,81,91,336],[91,88,121,370],[121,205,152,474],[152,196,182,477],[182,199,212,471],[212,191,242,456],[242,186,273,450],[273,190,303,451],[303,215,333,450],[333,249,363,445],[363,261,394,434],[394,284,424,417],[424,310,454,400],[454,333,473,383]]},{"w":535,"h":484,"mx":529,"my":219.33,"regions":[[17,122,34,272],[34,122,67,273],[67,132,101,265],[101,149,134,282],[134,156,168,308],[168,100,201,306],[201,69,235,294],[235,51,268,360],[268,45,301,359],[301,49,335,335],[335,69,368,306],[368,105,402,304],[402,116,435,295],[435,133,469,281],[469,162,502,264],[502,185,533,248]]},{"w":517,"h":484,"mx":512,"my":237.14,"regions":[[8,206,33,266],[33,197,65,345],[65,191,97,340],[97,176,130,298],[130,151,162,304],[162,104,194,304],[194,76,227,280],[227,57,259,341],[259,53,291,339],[291,53,324,319],[324,65,356,300],[356,101,388,300],[388,118,421,296],[421,144,453,287],[453,175,485,277],[485,200,514,265]]},{"w":484,"h":484,"mx":472,"my":237.16,"regions":[[13,266,31,322],[31,229,61,322],[61,196,91,348],[91,167,121,365],[121,123,152,361],[152,90,182,278],[182,70,212,275],[212,62,242,333],[242,61,273,331],[273,64,303,312],[303,77,333,306],[333,113,363,306],[363,131,394,301],[394,153,424,290],[424,183,454,277],[454,209,474,262]]}],
  "sogari": [{"w":1511,"h":978,"mx":1481,"my":491,"regions":[[14,286,95,682],[95,287,189,681],[189,329,284,636],[284,268,378,741],[378,212,473,746],[473,209,567,728],[567,229,662,700],[662,161,756,694],[756,129,850,839],[850,122,945,858],[945,142,1039,829],[1039,204,1134,726],[1134,305,1228,682],[1228,345,1323,665],[1323,390,1417,639],[1417,418,1505,598]]}],
  "carp": [{"w":1536,"h":993,"mx":1508,"my":543,"regions":[[17,234,96,686],[96,249,192,677],[192,304,288,626],[288,339,384,713],[384,276,480,712],[480,240,576,660],[576,205,672,657],[672,163,768,815],[768,124,864,795],[864,144,960,726],[960,230,1056,684],[1056,260,1152,779],[1152,280,1248,730],[1248,318,1344,647],[1344,379,1440,646],[1440,440,1528,644]]}],
  "catfish": [{"w":1544,"h":1011,"mx":1424,"my":549,"regions":[[15,282,97,556],[97,282,193,556],[193,330,290,575],[290,384,386,621],[386,392,483,649],[483,383,579,667],[579,368,676,670],[676,353,772,702],[772,268,869,677],[869,274,965,661],[965,348,1062,662],[1062,362,1158,726],[1158,390,1255,720],[1255,428,1351,679],[1351,473,1448,677],[1448,349,1528,761]]}],
  "eel": [{"w":1543,"h":863,"mx":1521,"my":404,"regions":[[15,256,97,397],[97,272,193,470],[193,323,290,529],[290,373,386,558],[386,405,483,559],[483,377,579,556],[579,334,676,538],[676,297,772,502],[772,279,868,451],[868,279,965,425],[965,289,1061,446],[1061,312,1158,473],[1158,342,1254,482],[1254,360,1351,489],[1351,363,1447,476],[1447,367,1528,452]]}],
});

export function catchDisplayBounds(fish, reducedMotion = false) {
  const presentation = fishPresentation(fish, reducedMotion), length = presentation.length;
  const id = fish.fish?.id === 'golden-carp' ? 'crucian' : fish.fish?.id;
  const profiles = CATCH_ART_PROFILES[id];
  const flex = reducedMotion ? 0 : finite(fish.flexPhase);
  const pose = id === 'crucian' ? (reducedMotion ? 0 : Math.floor(Math.abs(flex) * .54) % 6) : 0;
  const art = profiles?.[pose];
  const k = art ? length / (id === 'crucian' ? 500 : art.mx - art.w * .025) : length;
  const regions = art ? art.regions : [[-1, -.3, .05, .3]];
  const cos = Math.cos(presentation.angle), sin = Math.sin(presentation.angle);
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x0, y0, x1, y1] of regions) {
    // Bound the exact pause-frozen bends of every painted strip intersecting
    // this source region. A maximum-amplitude rectangle would reserve empty
    // space and unnecessarily push a large fish toward the controls.
    const bends = [0], strips = id === 'eel' ? 64 : 48;
    if (art && !reducedMotion) for (let i = 0; i < strips; i++) {
      const x = i / strips * art.w;
      if (x > x1 || x + art.w / strips + .35 < x0) continue;
      const tail = clamp((art.mx - x) / (id === 'crucian' ? art.mx - 35 : art.mx), 0, 1);
      bends.push(Math.sin(flex - tail * (id === 'eel' ? 5.4 : 4)) * length
        * (id === 'crucian' ? .018 : id === 'eel' ? .05 : .025) * tail * tail);
    }
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const offset of [Math.min(...bends), Math.max(...bends)]) {
      const px = (x - (art?.mx || 0)) * k, py = (y - (art?.my || 0)) * k + offset;
      const xx = px * cos - py * sin, yy = px * sin + py * cos;
      left = Math.min(left, xx); right = Math.max(right, xx);
      top = Math.min(top, yy); bottom = Math.max(bottom, yy);
    }
  }
  return { left: left - 2, top: top - 2, right: right + 2, bottom: bottom + 2 };
}

export function frameCatchPresentation(cast, reducedMotion = false) {
  const fish = activeFish(cast);
  if (!fish || fish.phase !== 'catch' || !point(fish.mouth)) return cast;
  if(fish.fish?.kind==='item'){
   const target={x:clamp(fish.mouth.x,fish.fish.id==='boot'?200:160,440),y:clamp(fish.mouth.y,180,630)},dx=target.x-fish.mouth.x,dy=target.y-fish.mouth.y;
   const supplied=cast.linePoints||[],linePoints=supplied.map((p,i)=>({...p,x:p.x+dx*i/Math.max(1,supplied.length-1),y:p.y+dy*i/Math.max(1,supplied.length-1)}));
   if(linePoints.length)linePoints[linePoints.length-1]={...fish.mouth,...target};return{...cast,fishVisual:{...fish,mouth:{...fish.mouth,...target}},linePoints};
  }
  const progress = smooth((finite(fish.catchProgress) - .48) / .37);
  if (!progress) return cast;
  const presentation = fishPresentation(fish, reducedMotion);
  const extended = ['sogari', 'carp', 'catfish', 'eel', 'sea-bass'].includes(fish.fish?.id);
  // The very longest fish lean gently into the free lower-right water. Their
  // full tail stays beside the catch/retrieve control, rather than behind it.
  const lean = extended ? smooth((presentation.length - 480) / 120) : 0;
  const id = fish.fish?.id;
  const leanAngle = id === 'carp' ? .48 : id === 'catfish' ? .365 : .24;
  const shown = { ...fish, catchDisplayAngle: -leanAngle * lean * progress };
  const bounds = catchDisplayBounds(shown, reducedMotion);
  const left = 14 - bounds.left, right = (id === 'carp' ? 538 : 526) - bounds.right;
  const top = lerp(96, 64, lean) - bounds.top, bottom = lerp(744, 842, lean) - bounds.bottom;
  const desiredX = id === 'carp' ? lerp(fish.mouth.x, 164, lean) : id === 'catfish' ? lerp(fish.mouth.x, 270, lean) : lean > .01 ? 512 - bounds.right : Math.max(fish.mouth.x, 114 - bounds.left);
  const desiredY = id === 'carp' ? lerp(fish.mouth.y, 110, lean) : id === 'catfish' ? lerp(fish.mouth.y, 160, lean) : fish.mouth.y;
  const targetX = clamp(desiredX, left, right);
  const targetY = clamp(desiredY, Math.min(top, bottom), Math.max(top, bottom));
  const dx = (targetX - fish.mouth.x) * progress, dy = (targetY - fish.mouth.y) * progress;
  shown.mouth = { ...fish.mouth, x: fish.mouth.x + dx, y: fish.mouth.y + dy };
  // Reframe the visible rope continuously from the unchanged rod tip to the
  // exact shown mouth. World rope samples, length, hook and camera stay intact.
  const supplied = Array.isArray(cast.linePoints) ? cast.linePoints.filter(point) : [];
  const original = supplied.length > 1 ? supplied : [cast.tip, fish.mouth].filter(point);
  const linePoints = original.map((p, i) => {
    const blend = i / Math.max(1, original.length - 1);
    return { ...p, x: p.x + dx * blend, y: p.y + dy * blend };
  });
  if (linePoints.length) linePoints[linePoints.length - 1] = { ...shown.mouth };
  return { ...cast, fishVisual: shown, linePoints,
    catchDisplayFrame: { dx, dy, bounds, progress, lean } };
}

function paintFish(ctx, cast, t, atlas, reducedMotion, crucianAtlas, speciesImages = {}) {
  const fish = activeFish(cast); if (!fish || fish.visible === false || !point(fish.mouth)) return;
  // Keep the real submerged mouth/line and water effects, but reveal the fish only when landed.
  if (fish.phase !== 'catch') { paintFishWake(ctx, fish, reducedMotion?0:t, lineWaterContact(cast)); return; }
  if(fish.fish?.kind==='item'){
   const image=speciesImages[fish.fish.id+'Item'];ctx.save();ctx.imageSmoothingEnabled=true;
   if(image?.complete&&image.naturalWidth){const crop=fish.fish.crop||[0,0,image.naturalWidth,image.naturalHeight],anchor=fish.fish.anchor||[image.naturalWidth/2,0],scale=170/crop[3];ctx.drawImage(image,...crop,fish.mouth.x+(crop[0]-anchor[0])*scale,fish.mouth.y+(crop[1]-anchor[1])*scale,crop[2]*scale,170);}
   ctx.font='700 20px "User Paperlogy Bold", sans-serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#153b3e';ctx.fillStyle='#fff5cf';ctx.strokeText(fish.fish.name,fish.mouth.x,fish.mouth.y+192);ctx.fillText(fish.fish.name,fish.mouth.x,fish.mouth.y+192);ctx.restore();return;
  }
  const presentation = fishPresentation(fish,reducedMotion), length=presentation.length;
  const flex = reducedMotion ? 0 : finite(fish.flexPhase,t*(fish.phase==='catch'?22:14));
  paintFishWake(ctx, fish, reducedMotion?0:t);
  ctx.save();ctx.translate(fish.mouth.x,fish.mouth.y);
  ctx.rotate(presentation.angle-(presentation.heading<0?Math.PI:0));ctx.scale(presentation.heading,1);
  // Reflections remain visible through the submerged silhouette. Only the catch
  // rises out of this water tint; hook/fight can never use an airborne sprite.
  ctx.globalAlpha=presentation.underwater?.42:clamp(finite(fish.opacity,1),0,1);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const crucian=['crucian','golden-carp'].includes(fish.fish?.id)&&paintCrucianAtlas(ctx,crucianAtlas,fish,length,flex,reducedMotion);
  const species=!crucian&&paintSpeciesFish(ctx,speciesImages[`${fish.fish?.id}Fish`],fish,length,flex,reducedMotion);
  if(!crucian&&!species&&!paintFishAtlas(ctx,atlas,fish,length,flex,reducedMotion))paintProceduralFish(ctx,fish,length,flex,reducedMotion);
  if(presentation.underwater){
    ctx.globalAlpha=.22;ctx.strokeStyle='#a6dde4';ctx.lineWidth=.9;
    for(let i=0;i<5;i++){const y=(i-2)*length*.065+Math.sin(t*.9+i)*1.4;ctx.beginPath();ctx.moveTo(-length*(.14+i*.08),y);ctx.quadraticCurveTo(-length*.5,y+1.7,-length*(.73+i*.025),y);ctx.stroke();}
  }
  ctx.restore();
}

function paintHookSnap(ctx, cast, reducedMotion) {
  const fish = activeFish(cast);
  if (reducedMotion || !fish || fish.phase !== 'hook') return;
  const progress = clamp(finite(fish.hookProgress, 1), 0, 1), glow = Math.sin(progress * Math.PI);
  const rod = Array.isArray(cast.rodPoints) ? cast.rodPoints.filter(point) : [];
  if (rod.length < 3 || glow <= 0) return;
  // Trace the supplied flexing rod itself. No invented snap/cast trajectory.
  const points = rod.slice(Math.floor(rod.length * .42));
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); points.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y));
  ctx.strokeStyle = `rgba(228,245,209,${(glow * .23).toFixed(3)})`; ctx.lineWidth = 4.7; ctx.stroke();
  ctx.strokeStyle = `rgba(255,249,209,${(glow * .70).toFixed(3)})`; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.restore();
}

function paintCastSnap(ctx, cast, reducedMotion) {
  if (reducedMotion || cast.rigVisible === false || !['swing', 'flight'].includes(cast.phase)) return;
  const phase = cast.phase, progress = phase === 'swing' ? cast.swingProgress : cast.flightProgress;
  if (!Number.isFinite(progress)) return;
  const envelope = phase === 'swing' ? Math.sin(clamp(progress, 0, 1) * Math.PI)
    : Math.sin(clamp(progress / .62, 0, 1) * Math.PI) * .75;
  if (envelope <= .001) return;
  const rod = Array.isArray(cast.rodPoints) ? cast.rodPoints.filter(point) : [];
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (rod.length > 2) {
    const upper = rod.slice(Math.floor(rod.length * .70));
    ctx.beginPath(); upper.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y));
    ctx.strokeStyle = `rgba(239,248,218,${(envelope * .22).toFixed(3)})`; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = `rgba(255,251,219,${(envelope * .72).toFixed(3)})`; ctx.lineWidth = 1.1; ctx.stroke();
  }
  const p = cast.float, velocity = p?.velocity;
  if (phase === 'flight' && cast.floatVisible !== false && point(p) && point(velocity)) {
    // Project the supplied actual world velocity through the same camera axes.
    // This is a centimetre-long directional glint at the moving rig, not a
    // secondary trajectory, cast arc, ghost float or changed cast endpoint.
    const vx = velocity.x * 100, vy = -velocity.y * 95 - finite(velocity.z) * 115;
    const speed = Math.hypot(vx, vy), scale = clamp(finite(p.scale, 1), .72, 1.5);
    if (speed > 5) {
      const dx = vx / speed, dy = vy / speed, trail = Math.min(13, speed * .018) * scale;
      ctx.strokeStyle = `rgba(239,249,223,${(envelope * .45).toFixed(3)})`; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(p.x - dx * 3 * scale, p.y - dy * 3 * scale);
      ctx.lineTo(p.x - dx * trail, p.y - dy * trail); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const back = (4 + i * 2.7) * scale, spread = (rand(i + 813) - .5) * 8 * scale;
        const x = p.x - dx * back - dy * spread, y = p.y - dy * back + dx * spread;
        ctx.fillStyle = `rgba(240,251,237,${(envelope * (.63 - i * .07)).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(x, y, .55 * scale, (1 + i * .12) * scale, Math.atan2(dy, dx) + Math.PI / 2, 0, TAU); ctx.fill();
      }
    }
  }
  ctx.restore();
}

export function windLeafAt(time,index){
  const age=((time+index*16)%32+32)%32-4;
  if(age<0||age>6)return null;
  const u=age/6;
  return {x:index?560-u*580:-20+u*580,y:330+index*130+u*80+Math.sin(age*1.35+index)*14,
    age,alpha:Math.min(1,age*1.5,(6-age)*1.5)*.6};
}
export function paintWindLeaves(ctx,t,reducedMotion,waterline,float){
  if(reducedMotion)return;
  // Reuse the existing two vector leaves, with quiet intervals and no new timers.
  ctx.save();ctx.beginPath();ctx.rect(0,130,W,650);ctx.clip();
  for(let i=0;i<SCENE_EFFECT_LIMITS.leaves;i++){
    const leaf=windLeafAt(t,i);if(!leaf)continue;
    const {x,y,age,alpha}=leaf;
    if(point(float)&&Math.hypot(float.x-x,float.y-y)<32)continue;
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(age*1.7+i)*.7+.45);
    ctx.scale(1,.65+Math.sin(age*2.7+i)*.3);ctx.globalAlpha=alpha;
    ctx.fillStyle=i?'#a3ac54':'#b7a754';
    ctx.beginPath();ctx.moveTo(-7,0);ctx.quadraticCurveTo(-.5,-4,7.5,-.5);
    ctx.quadraticCurveTo(1,4,-7,0);ctx.fill();
    ctx.strokeStyle='rgba(55,78,34,.65)';ctx.lineWidth=.55;
    ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(8,-.5);ctx.stroke();ctx.restore();
  }
  ctx.restore();
}
export function paintNightFloatShade(ctx,cast,environment,waterline=314){
  const night=clamp(finite(environment.nightAmount),0,1),p=cast.float;
  if(!night||cast.floatVisible===false||!point(p)||!p.onWater)return;
  // Shade only the water behind the luminous antenna, before any rig is drawn.
  ctx.save();traceLakeWaterMask(ctx,waterline);ctx.clip();
  const glow=ctx.createRadialGradient(p.x,p.y-12,4,p.x,p.y-12,64);
  glow.addColorStop(0,`rgba(1,12,25,${night*.55})`);
  glow.addColorStop(.45,`rgba(1,12,25,${night*.3})`);glow.addColorStop(1,'rgba(1,12,25,0)');
  ctx.fillStyle=glow;ctx.fillRect(p.x-65,p.y-77,130,130);ctx.restore();
}

// A rooted foreground layer: each horizontal strip bends progressively with
// blade height. Bases stay fixed; long quiet intervals separate soft gusts.
export function shoreGrassBend(time, heightFraction, reducedMotion = false) {
  if (reducedMotion || heightFraction <= 0) return 0;
  const phase = ((time % 12) + 12) % 12;
  const envelope = phase > 2 && phase < 6 ? Math.sin((phase - 2) / 4 * Math.PI) ** 2 : 0;
  const height = clamp(heightFraction, 0, 1);
  return (Math.sin(time * 2.15) * 10 + Math.sin(time * 3.4) * 2) * envelope * height ** 2;
}
function paintShoreGrass(ctx, image, time, reducedMotion) {
  const size = imageSize(image); if (!size.width || !size.height) return;
  // Below the active water/float zone. HTML controls are painted over this layer.
  const clumps = [{x:-91,y:728,w:205,h:256,phase:0,flip:1}, {x:478,y:791,w:148,h:204,phase:4.2,flip:-1}];
  for (const c of clumps) {
    ctx.save(); ctx.beginPath(); ctx.rect(c.flip===1?0:518,710,c.flip===1?106:22,250);ctx.clip();
    if(c.flip<0){ctx.translate(c.x+c.w,0);ctx.scale(-1,1)}else ctx.translate(c.x,0);
    const strips=64;
    for(let i=0;i<strips;i++){
      const v=i/strips,sourceY=v*size.height,sourceH=Math.min(size.height-sourceY,size.height/strips+1);
      const bend=shoreGrassBend(time+c.phase,1-v,reducedMotion);
      ctx.drawImage(image,0,sourceY,size.width,sourceH,bend,c.y+v*c.h,c.w,sourceH/size.height*c.h+.35);
    }
    ctx.restore();
  }
}


function paintIntegratedReel(ctx,cast,t,reduced){
 const ps=cast.rodPoints?.filter(point);if(!ps||ps.length<2)return;
 let length=0;for(let i=1;i<ps.length;i++)length+=Math.hypot(ps[i].x-ps[i-1].x,ps[i].y-ps[i-1].y);
 // All parts share the same articulated rod coordinate system. Local -Y points toward the tip.
 const seat=distanceAlong(ps,length*.12),scale=clamp(length/550,.7,1.1),angle=Math.atan2(seat.ny,seat.nx);
 const world=(x,y)=>({x:seat.x+scale*(Math.cos(angle)*x-Math.sin(angle)*y),y:seat.y+scale*(Math.sin(angle)*x+Math.cos(angle)*y)});
 const guides=[.30,.44,.58,.71,.82,.91,.98].map(f=>{const p=distanceAlong(ps,length*f),r=7.5*(1-f)+1.1;return {...p,r,x:p.x-p.nx*(r+4),y:p.y-p.ny*(r+4)};});
 ctx.save();ctx.strokeStyle='rgba(210,224,227,.65)';ctx.lineWidth=.65;ctx.beginPath();let a=world(-35,-32);ctx.moveTo(a.x,a.y);for(const q of guides)ctx.lineTo(q.x,q.y);ctx.lineTo(ps.at(-1).x,ps.at(-1).y);ctx.stroke();
 for(const q of guides){const rotation=Math.atan2(q.ny,q.nx);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(rotation);ctx.strokeStyle='#29353d';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(q.r+4,-4);ctx.lineTo(0,-q.r*.55);ctx.moveTo(q.r+4,4);ctx.lineTo(0,q.r*.55);ctx.stroke();ctx.beginPath();ctx.ellipse(0,0,q.r*.65,q.r,0,0,TAU);ctx.stroke();ctx.strokeStyle='rgba(159,180,191,.8)';ctx.lineWidth=.55;ctx.stroke();ctx.restore();}
 ctx.translate(seat.x,seat.y);ctx.rotate(angle);ctx.scale(scale,scale);
 const metal=(x1,y1,x2,y2)=>{const g=ctx.createLinearGradient(x1,y1,x2,y2);[[0,'#111a22'],[.22,'#526575'],[.43,'#c1cbd0'],[.52,'#e7edf0'],[.65,'#566c7b'],[1,'#14212b']].forEach(([p,c])=>g.addColorStop(p,c));return g;};
 // Continuous rear EVA grip and reel seat wrap around the existing blank.
 ctx.fillStyle=metal(-10,0,10,0);ctx.fillRect(-10,-33,20,67);
 const foam=ctx.createLinearGradient(-11,0,11,0);foam.addColorStop(0,'#080e12');foam.addColorStop(.45,'#303c43');foam.addColorStop(1,'#090e13');ctx.fillStyle=foam;ctx.beginPath();ctx.roundRect(-11,32,22,68,7);ctx.fill();ctx.beginPath();ctx.roundRect(-9,-67,18,32,5);ctx.fill();
 ctx.strokeStyle='#111a20';ctx.lineWidth=1;for(let y=37;y<96;y+=4){ctx.beginPath();ctx.moveTo(-10,y);ctx.lineTo(10,y+3);ctx.stroke();}
 ctx.fillStyle=metal(-11,0,11,0);ctx.fillRect(-11,29,22,5);ctx.fillRect(-10,-36,20,4);
 // Reel foot, rigid stem and angular gearbox are one attached assembly.
 ctx.fillStyle='#172530';ctx.beginPath();ctx.roundRect(-13,-22,7,46,3);ctx.fill();ctx.fillStyle=metal(-38,0,-10,0);ctx.beginPath();ctx.moveTo(-11,-12);ctx.lineTo(-22,-9);ctx.lineTo(-34,15);ctx.lineTo(-43,18);ctx.lineTo(-39,29);ctx.lineTo(-26,24);ctx.lineTo(-17,0);ctx.lineTo(-11,0);ctx.closePath();ctx.fill();
 ctx.fillStyle=metal(-59,0,-24,30);ctx.beginPath();ctx.moveTo(-48,-6);ctx.bezierCurveTo(-67,-1,-62,27,-48,33);ctx.lineTo(-32,25);ctx.lineTo(-28,9);ctx.lineTo(-36,-4);ctx.closePath();ctx.fill();ctx.strokeStyle='#14232f';ctx.lineWidth=1.3;ctx.stroke();
 // Spool with layered line windings, metallic rim and dark drag knob.
 ctx.fillStyle='#192c3b';ctx.fillRect(-55,-32,30,27);ctx.fillStyle='#b9b48d';ctx.fillRect(-53,-29,26,18);
 for(let y=-28;y<-11;y+=2){ctx.strokeStyle=y%4?'#e0d9b0':'#888b76';ctx.lineWidth=.75;ctx.beginPath();ctx.moveTo(-53,y);ctx.lineTo(-27,y);ctx.stroke();}
 for(const y of [-32,-7]){ctx.fillStyle=metal(-58,0,-22,0);ctx.beginPath();ctx.ellipse(-40,y,19,5,0,0,TAU);ctx.fill();ctx.strokeStyle='#203441';ctx.lineWidth=.8;ctx.stroke();}
 ctx.fillStyle='#182936';ctx.beginPath();ctx.ellipse(-40,-35,9,3.6,0,0,TAU);ctx.fill();
 const turning=cast.phase==='retrieving'||cast.fishVisual?.phase==='fight',phase=turning&&!reduced?t*7:1.1;
 ctx.strokeStyle='#92a8b7';ctx.lineWidth=1.7;ctx.beginPath();ctx.ellipse(-40,-19,23,26,0,Math.PI*.95,Math.PI*2.9);ctx.stroke();
 const hx=-54-17*Math.cos(phase),hy=17+12*Math.sin(phase);ctx.strokeStyle='#a7b7c0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-48,15);ctx.lineTo(hx,hy);ctx.lineTo(hx-7,hy-4);ctx.stroke();ctx.fillStyle=foam;ctx.beginPath();ctx.ellipse(hx-8,hy-4,4.5,9,-.3,0,TAU);ctx.fill();
 ctx.restore();
}

// Refract only open water from the coastal image. Islands, sky and rocks stay fixed.
// Quiet foreground life: maximum 35% opacity, no gameplay state or timers.
function paintForegroundFish(ctx,t,reduced){
 if(reduced||t<4)return;
 const cycle=Math.floor((t-4)/22),age=(t-4)%22;if(age>9)return;
 const p=age/9,side=cycle%2?-1:1,x=side===1?75+p*390:465-p*390;
 const y=655+(cycle%3)*23+Math.sin(p*Math.PI*2)*9;
 const fade=Math.min(1,p/.18)*Math.min(1,(1-p)/.18);
 const tail=Math.sin(age*5)*3;
 ctx.save();ctx.globalAlpha=.35*fade;ctx.fillStyle='#103b43';ctx.filter='blur(.7px)';
 ctx.translate(x,y);ctx.scale(side,1);ctx.rotate(Math.cos(p*Math.PI*2)*.07);
 ctx.beginPath();ctx.moveTo(31,0);ctx.bezierCurveTo(16,-10,-8,-12,-21,-3);
 ctx.lineTo(-35,-9+tail);ctx.quadraticCurveTo(-31,tail,-35,9+tail);ctx.lineTo(-21,3);
 ctx.bezierCurveTo(-7,12,17,10,31,0);ctx.closePath();ctx.fill();
 ctx.beginPath();ctx.moveTo(4,-6);ctx.lineTo(-8,-15);ctx.lineTo(-13,-6);ctx.closePath();ctx.fill();
 ctx.beginPath();ctx.moveTo(6,5);ctx.lineTo(-3,13);ctx.lineTo(-8,6);ctx.closePath();ctx.fill();
 ctx.restore();
}

function paintCoastalWater(ctx,scene,t,reduced){
 if(reduced)return;const cover=imageCover(scene);if(!cover)return;
 const {sx,sy,sw,sh}=cover;
 ctx.save();ctx.beginPath();ctx.moveTo(0,350);ctx.lineTo(540,350);ctx.lineTo(540,700);ctx.lineTo(440,760);ctx.lineTo(370,830);ctx.lineTo(260,860);ctx.lineTo(170,805);ctx.lineTo(80,755);ctx.lineTo(0,710);ctx.closePath();ctx.clip();
 for(let y=350;y<860;y+=5){const d=(y-350)/510,edge=Math.min(1,(y-350)/28)*Math.min(1,(860-y)/55),dx=(Math.sin(y*.038-t*1.65)*3.3+Math.sin(y*.079+t*1.2)*1.25)*(.3+d*.7),dy=Math.sin(y*.047-t*2.05)*(.45+d*2.0);ctx.globalAlpha=.88*edge;ctx.drawImage(scene,sx,sy+(y+dy)*sh/960,sw,5.6*sh/960,dx-6,y,552,5.6);}
 ctx.globalAlpha=1;
 for(let i=0;i<46;i++){const depth=.08+rand(i+215)*.79,y=350+depth*510,x=25+rand(i+904)*490,phase=t*1.4+i*2.7,alpha=(.04+.065*depth)*Math.max(0,Math.sin(phase));ctx.strokeStyle='rgba(225,248,255,'+alpha+')';ctx.lineWidth=.5+depth*.7;ctx.beginPath();ctx.ellipse(x+Math.sin(phase)*3,y+Math.sin(phase*.6),5+depth*18,.6+depth*1.2,0,Math.PI*.1,Math.PI*.9);ctx.stroke();}

 ctx.restore();
}

function paintSeaBirds(ctx,atlas,t,reduced){if(!atlas?.complete||!atlas.naturalWidth)return;const seq=[0,1,2,4,2,1];for(let i=0;i<3;i++){const f=seq[Math.floor((reduced?0:t)*7+i*2)%6],w=(48-i*9)*1.25,x=reduced?120+i*120:((t*(12+i*2)+i*210)%650)-65,y=245+i*24;ctx.drawImage(atlas,(f%4)*192,Math.floor(f/4)*192,192,192,x,y,w,w);}}

export function createReservoirRenderer(images = {}) {
  const waterline = clamp(finite(images.waterline, RESERVOIR_LAYOUT.waterline), 260, 410);
  const layout = Object.freeze({ ...RESERVOIR_LAYOUT, waterline, water: Object.freeze({ x: 0, y: waterline, width: W, height: H - waterline }) });
  let lastMotionTime = 0, blendedScene=null, blendedKey='';
  function environmentScene(ctx,environment){
    const n=images.nightScene?Math.round(clamp(finite(environment.nightAmount),0,1)*50)/50:0;
    const r=images.rainScene?Math.round(clamp(finite(environment.rainIntensity)*2.8,0,1)*50)/50:0;
    if(!n&&!r)return images.scene;
    if(n===1)return images.nightScene;
    if(!n&&r===1)return images.rainScene;
    const key=`${n}:${r}`;if(key===blendedKey&&blendedScene)return blendedScene;
    let c;try{c=new ctx.canvas.constructor(W,H)}catch{}if(!c?.getContext)try{c=document.createElement('canvas');c.width=W;c.height=H}catch{return n>.5?images.nightScene:r>.5?images.rainScene:images.scene}
    const b=c.getContext('2d');if(!b)return images.scene;
    b.drawImage(images.scene,0,0,W,H);if(r){b.globalAlpha=r;b.drawImage(images.rainScene,0,0,W,H)}if(n){b.globalAlpha=n;b.drawImage(images.nightScene,0,0,W,H)}
    blendedKey=key;blendedScene=c;return c;
  }
  function render(ctx, { time = 0, cast = {}, fishing = {}, lift = 0, paused = false, reducedMotion = false, environment = {} } = {}) {
    if (cast.fishVisual && ['ready', 'casting', 'escaped'].includes(fishing.phase)) cast = { ...cast, fishVisual: null };
    if (!paused) lastMotionTime = finite(time);
    const t = reducedMotion ? 0 : lastMotionTime;
    ctx.save(); ctx.clearRect(0, 0, W, H);
    const scene=images.scene,cover = imageCover(scene);
    // A stationary underpaint keeps the sub-pixel camera accent from revealing
    // transparent edges at the top or sides of the portrait canvas.
    if (cover) ctx.drawImage(scene, cover.sx, cover.sy, cover.sw, cover.sh, 0, 0, W, H);
    else fallbackScene(ctx, waterline);
    const camera = reducedMotion ? {} : (cast.camera || {});
    const zoom = clamp(finite(camera.zoom, 1), 1, 1.008);
    const cx = clamp(finite(camera.x), -3, 3), cy = clamp(finite(camera.y), -3, 3);
    ctx.translate(W / 2 + cx, H / 2 + cy); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);
    if (cover) ctx.drawImage(scene, cover.sx, cover.sy, cover.sw, cover.sh, 0, 0, W, H);
    else fallbackScene(ctx, waterline);
    paintCoastalWater(ctx,scene,t,reducedMotion);
    paintForegroundFish(ctx,t,reducedMotion);
    paintSeaBirds(ctx,images.seaBirds,t,reducedMotion);
    paintNightFloatShade(ctx,cast,environment,waterline);
    paintDistantFish(ctx,{time:t,environment,reducedMotion,paused,cast,atlas:images.crucianAtlas,frames:CRUCIAN_POSES});
    paintTarget(ctx, cast, t);
    paintSplash(ctx, cast);
    paintLiftOut(ctx, cast);
    paintFishRipples(ctx, cast, reducedMotion);
    const catching = cast.fishVisual?.phase === 'catch';
    if(!catching){paintFish(ctx, cast, t, images.fishAtlas, reducedMotion, images.crucianAtlas, images);paintResistanceSplash(ctx,cast,images.splashAtlas,reducedMotion);paintLine(ctx, cast);}
    ctx.save();if(environment.nightAmount||environment.rainIntensity)ctx.filter=`brightness(${1-finite(environment.nightAmount)*.58-finite(environment.rainIntensity)*.12})`;
    /* Coastal foreground is part of the approved background. */ctx.restore();
    paintEnvironmentLight(ctx,{...environment,backgroundArt:Boolean(images.nightScene&&images.rainScene)},t,reducedMotion);
    paintRod(ctx, cast);paintIntegratedReel(ctx,cast,t,reducedMotion);
    if(catching){const shown=frameCatchPresentation(cast,reducedMotion);paintFish(ctx, shown, t, images.fishAtlas, reducedMotion, images.crucianAtlas, images);paintLine(ctx, shown);}
    paintHookSnap(ctx, cast, reducedMotion);
    paintCastSnap(ctx, cast, reducedMotion);
    paintRain(ctx,environment,t,reducedMotion,cast.float);
    paintFloat(ctx, cast, fishing, t, images.uiAtlas,environment);
    /* No inland leaves at the coast. */
    // A small, static edge shade grounds the bank without darkening the water.
    const shade = ctx.createLinearGradient(0, 865, 0, H);
    shade.addColorStop(0, 'rgba(12,27,23,0)'); shade.addColorStop(1, 'rgba(12,27,23,.12)');
    ctx.fillStyle = shade; ctx.fillRect(0, 865, W, 95);
    ctx.restore();
    return layout;
  }
  return Object.freeze({ render, layout });
}

export default createReservoirRenderer;

