/**
 * V15 observational underwater camera. No game model, timers, audio, storage,
 * DOM, or import-time requests: the host owns its clock and its image loader.
 * All positions are normalized to the circular viewport's enclosing square.
 */
export const UNDERWATER_SPECIES = Object.freeze(['crucian', 'sogari', 'carp', 'catfish', 'eel']);
export const UNDERWATER_LIMITS = Object.freeze({
  minFish: 1, maxFish: 3, minY: .29, maxY: .77,
  minSpeed: .09, maxSpeed: .23, maxDelta: 60,
});

const TAU = Math.PI * 2;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const imageSize = image => ({
  width: image?.naturalWidth || image?.width || 0,
  height: image?.naturalHeight || image?.height || 0,
});
const validImage = image => {
  const size = imageSize(image);
  return size.width > 0 && size.height > 0 && image?.complete !== false;
};
const speciesSettings = Object.freeze({
  crucian: { width: .77, ratio: .75, head: .881, poseRate: 9, wave: .008, speed: .131 },
  eel: { width: .80, ratio: 863/1543, head: .96, poseRate: 8, wave: .055, speed: .189 },
  sogari: { width: .55, ratio: 978/1511, head: .96, poseRate: 9, wave: .020, speed: .218 },
  carp: { width: .64, ratio: 993/1536, head: .96, poseRate: 9, wave: .018, speed: .160 },
  catfish: { width: .71, ratio: 1011/1544, head: .93, poseRate: 8, wave: .024, speed: .102 },
});

function randomUnit(rng) {
  const n = Number(rng());
  return Number.isFinite(n) ? clamp(n, 0, 1 - Number.EPSILON) : .5;
}

function scheduleSignature(fish) {
  return JSON.stringify(fish.map(f => [f.species, f.spawnAt, f.speed, f.baseY,
    f.width, f.depth, f.phase].map(v => typeof v === 'number' ? +v.toFixed(5) : v)));
}

function createSchedule(rng, cycle, previousSignature) {
  const random = () => randomUnit(rng);
  const count = 1 + Math.floor(random() * UNDERWATER_LIMITS.maxFish);
  const species = [...UNDERWATER_SPECIES];
  for (let i = species.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [species[i], species[j]] = [species[j], species[i]];
  }
  const lane = .42 + random() * .20;
  // A small shared current does not erase each species' own cruising pace.
  // Independent variation still leaves at least .013 viewport/s between any
  // two species in a group, so overtaking is visible rather than synchronized.
  const currentDrift = (random() - .5) * .008;
  // The complete sprite bounds (including tail motion) fit disjoint depth bands.
  // Group lanes never cross, even when all fish pass the same horizontal point.
  const bands = count === 3
    ? [{y:.30,height:.12,depth:.16}, {y:.50,height:.16,depth:.52}, {y:.76,height:.22,depth:.96}]
    : [{y:.33,height:.18,depth:.18}, {y:.71,height:.32,depth:.96}];
  let spawnAt = .08 + random() * .25;
  const fish = [];
  for (let i = 0; i < count; i++) {
    const band = bands[i], depth = count === 1 ? .70 + random() * .25 : band.depth;
    const kind = species[i], config = speciesSettings[kind];
    const sizeRoll=random(),sizeId=sizeRoll<.6?'small':sizeRoll<.9?'medium':'large',sizeScale=({small:.65,medium:.82,large:1})[sizeId];
    const naturalWidth = sizeScale * config.width * (.48 + depth * .52) * (.95 + random() * .10);
    const priorWidth = count === 1 ? naturalWidth : Math.min(naturalWidth, band.height / config.ratio);
    // Apply the requested foreground enlargement after the established size
    // cap. Reposition lanes below; never recapture this increase with a cap.
    const width = priorWidth * (i === count - 1 ? 1.3 : 1);
    const speed = clamp(config.speed + currentDrift + (random() - .5) * .016,
      UNDERWATER_LIMITS.minSpeed, UNDERWATER_LIMITS.maxSpeed);
    const entryX = -width / 2 - .025, exitX = 1 + width / 2 + .025;
    const baseY = count === 1 ? lane : band.y;
    fish.push(Object.freeze({
      id: `${cycle}:${i}`, species: kind, sizeId, spawnAt, entryX, exitX, width,
      speed, baseY, depth, opacity: .65 + depth * .35,
      blur: depth < .3 ? 2.5 : depth < .7 ? 1.1 : 0,
      phase: random() * TAU, bob: .004 + random() * .002,
      exitAt: spawnAt + (exitX - entryX) / speed,
    }));
    spawnAt += .45 + random() * .45;
  }
  if (count === 3) {
    // Keep full rectangular sprites, maximum tail wave/bob and a conservative
    // 3-sigma depth-blur margin disjoint for every horizontal position. This
    // remains true when one fish overtakes another at its independent speed.
    // Species are unique, so the widest eel envelope can occupy only one lane.
    const envelope = f => f.width * (speciesSettings[f.species].ratio / 2
      + speciesSettings[f.species].mp3e) + f.bob + 3 * f.blur / 640;
    const farY = UNDERWATER_LIMITS.minY + .007;
    const nearY = UNDERWATER_LIMITS.maxY - .007;
    const midY = (farY + envelope(fish[0]) + nearY - envelope(fish[2])) / 2;
    for (let i = 0; i < count; i++) fish[i] = Object.freeze({
      ...fish[i], baseY: [farY, midY, nearY][i],
    });
  }
  let signature = scheduleSignature(fish);
  if (signature === previousSignature) {
    // Do not retry RNG forever. Even a constant/broken injected RNG must not
    // produce the exact same view twice in a row. Change animation phase and
    // the single-fish lane, retaining group clearance and rightward direction.
    const shift = fish[0].baseY > .55 ? -.006 : .006;
    for (let i = 0; i < fish.length; i++) fish[i] = Object.freeze({
      ...fish[i], baseY: count === 1 ? clamp(fish[i].baseY + shift, UNDERWATER_LIMITS.minY + .025, UNDERWATER_LIMITS.maxY - .025) : fish[i].baseY,
      phase: (fish[i].phase + .83) % TAU,
    });
    signature = scheduleSignature(fish);
  }
  return Object.freeze({
    fish: Object.freeze(fish), signature,
    duration: Math.max(...fish.map(f => f.exitAt)) + .55 + random() * .60,
  });
}

function drawCover(ctx, image, x, y, width, height) {
  const size = imageSize(image);
  const scale = Math.max(width / size.width, height / size.height);
  const sw = width / scale, sh = height / scale;
  ctx.drawImage(image, (size.width - sw) / 2, (size.height - sh) / 2, sw, sh,
    x, y, width, height);
}

function drawFish(ctx, fish, image, reducedMotion) {
  if (!validImage(image)) return;
  const config = speciesSettings[fish.species];
  const source = imageSize(image);
  const width = fish.width, height = width * (config.ratio || source.height / source.width);
  ctx.save();
  ctx.globalAlpha *= fish.opacity;
  ctx.translate(fish.x, fish.y);
  if (reducedMotion) {
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
  } else {
    // These are the six authored anatomical poses, with a restrained traveling
    // tail wave layered on top. The nose stays anchored; nothing is mirrored.
    const strips = fish.species === 'eel' ? 56 : 36;
    for (let i = 0; i < strips; i++) {
      const sx = source.width * i / strips;
      const sw = Math.min(source.width - sx, source.width / strips + .6);
      const u = (sx + sw / 2) / source.width;
      const tail = clamp((config.head - u) / config.head, 0, 1);
      const amplitude = width * config.mp3e * tail * tail;
      const wave = Math.sin(fish.age * (fish.species === 'eel' ? 6.6 : 8.2)
        + fish.phase - tail * (fish.species === 'eel' ? 5.3 : 3.4));
      ctx.drawImage(image, sx, 0, sw, source.height,
        -width / 2 + sx / source.width * width,
        -height / 2 + wave * amplitude,
        sw / source.width * width, height);
    }
  }
  ctx.restore();
}

export class UnderwaterScene {
  constructor({ rng = Math.random, reducedMotion = false,
    assetBase = './assets/underwater-v15/', assets = null, assetLoader = null } = {}) {
    if (typeof rng !== 'function') throw new TypeError('UnderwaterScene requires an RNG function.');
    this.rng = rng;
    this.reducedMotion = Boolean(reducedMotion);
    this.assetBase = String(assetBase).replace(/\/?$/, '/');
    this.assetLoader = assetLoader;
    this.assets = assets;
    this.assetState = this._assetsAreReady(assets) ? 'ready' : 'idle';
    this.assetError = null;
    this._loading = null;
    this._cycle = 0;
    this._previousSignature = null;
    this.time = 0;
    this.totalTime = 0;
    this.open();
  }

  _assetsAreReady(assets) {
    return validImage(assets?.background) && UNDERWATER_SPECIES.every(species =>
      assets?.[species]?.length === 6 && assets[species].every(validImage));
  }

  get assetsReady() { return this.assetState === 'ready'; }

  /** Useful when the host changes Canvas backends (browser/software QA). */
  setAssets(assets) {
    if (!this._assetsAreReady(assets)) throw new TypeError('Underwater assets need a background and six usable images for every species.');
    this.assets = assets;
    this.assetState = 'ready';
    this.assetError = null;
    return this.assets;
  }

  /** The host supplies e.g. url => new Promise(resolve => { const im = new
   * window.Image(); im.onload = () => resolve(im); im.src = url; }). */
  loadAssets(loader = this.assetLoader, { reload = false } = {}) {
    if (this.assetsReady && !reload) return Promise.resolve(this.assets);
    if (this._loading) return this._loading;
    if (typeof loader !== 'function') return Promise.reject(new TypeError('loadAssets requires an injected image loader.'));
    this.assetState = 'loading';
    this.assetError = null;
    const files = ['underwater-background.webp', ...Array.from({length:6},(_,i)=>`pose-${i+1}.webp`)];
    const sources=[...files.map(file=>this.assetBase+file),...['sogari','carp','catfish','eel'].map(kind=>`./assets/fish-v37/${kind}.webp`)];
    const depthFiles = [];
    for (const depth of ['far','mid']) for (const kind of UNDERWATER_SPECIES)
      for (let pose = 1; pose <= (kind === 'crucian' ? 6 : 1); pose++)
        depthFiles.push({depth,kind,url:`./assets/underwater-v38/${kind}-${pose}-${depth}.webp`});
    this._loading = Promise.all([...sources, ...depthFiles.map(f=>f.url)].map(file => Promise.resolve().then(() => loader(file))))
      .then(images => {
        const next = { background: images[0], crucian: images.slice(1, 7),
          sogari: Array(6).fill(images[7]), carp: Array(6).fill(images[8]),
          catfish: Array(6).fill(images[9]), eel: Array(6).fill(images[10]),
          depth: {far:{},mid:{}} };
        depthFiles.forEach(({depth,kind},i)=>{
          const image=images[sources.length+i];
          if (!validImage(image)) throw new Error('An underwater depth image has no usable pixels.');
          (next.depth[depth][kind] ??= []).push(image);
        });
        for (const depth of ['far','mid']) for (const kind of UNDERWATER_SPECIES)
          if (kind !== 'crucian') next.depth[depth][kind]=Array(6).fill(next.depth[depth][kind][0]);
        if (!this._assetsAreReady(next)) throw new Error('An underwater image has no usable pixels.');
        this.assets = next;
        this.assetState = 'ready';
        return this.assets;
      }).catch(error => {
        this.assetState = 'error';
        this.assetError = String(error?.message || error);
        throw error;
      }).finally(() => { this._loading = null; });
    return this._loading;
  }

  _nextSchedule() {
    this._cycle += 1;
    this._schedule = createSchedule(this.rng, this._cycle, this._previousSignature);
    this._previousSignature = this._schedule.signature;
  }

  /** A fresh opening always resets the camera clock, never the host game. */
  open({ reducedMotion = this.reducedMotion } = {}) {
    this.reducedMotion = Boolean(reducedMotion);
    this.time = 0;
    this.totalTime = 0;
    this._nextSchedule();
    return this.snapshot();
  }

  setReducedMotion(value) { this.reducedMotion = Boolean(value); }

  /** Seconds, not milliseconds. Not calling this is the complete pause API.
   * Ignore invalid deltas and bound catch-up after a suspended host frame. */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const elapsed = Math.min(dt, UNDERWATER_LIMITS.maxDelta) * (this.reducedMotion ? .42 : 1);
    this.time += elapsed;
    this.totalTime += elapsed;
    while (this.time >= this._schedule.duration) {
      this.time -= this._schedule.duration;
      this._nextSchedule();
    }
  }

  _fishAtTime() {
    return this._schedule.fish.filter(f => this.time >= f.spawnAt && this.time <= f.exitAt)
      .map(f => {
        const age = this.time - f.spawnAt;
        return {
          ...f, age, x: f.entryX + age * f.speed,
          y: f.baseY + (this.reducedMotion ? 0 : Math.sin(age * 1.25 + f.phase) * f.bob),
          poseIndex: Math.floor((this.reducedMotion ? 0 : age * speciesSettings[f.species].poseRate)
            + f.phase / TAU * 6) % 6,
          velocityX: f.speed * (this.reducedMotion ? .42 : 1),
          direction: 'right',
        };
      });
  }

  snapshot() {
    return {
      cycle: this._cycle, time: this.time, totalTime: this.totalTime,
      duration: this._schedule.duration, signature: this._schedule.signature,
      count: this._schedule.fish.length, reducedMotion: this.reducedMotion,
      assetsReady: this.assetsReady, assetState: this.assetState, assetError: this.assetError,
      schedule: this._schedule.fish.map(f => ({ ...f })),
      fish: this._fishAtTime(),
    };
  }

  /** State-pure render. Corners remain untouched; the host may clear its own
   * canvas. A centered circle fits both rectangular and square canvases. */
  render(ctx, width, height) {
    if (!ctx || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const size = Math.min(width, height), ox = (width - size) / 2, oy = (height - size) / 2;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(size, size);
    ctx.save();
    ctx.beginPath(); ctx.arc(.5, .5, .471, 0, TAU); ctx.clip();
    if (validImage(this.assets?.background)) {
      drawCover(ctx, this.assets.background, 0, 0, 1, 1);
    } else {
      const water = ctx.createLinearGradient(0, 0, 0, 1);
      water.addColorStop(0, '#2f8f89'); water.addColorStop(.5, '#0b514c'); water.addColorStop(1, '#07352d');
      ctx.fillStyle = water; ctx.fillRect(0, 0, 1, 1);
    }
    // Draw far to near, independently of spawn order or species.
    const fish = this._fishAtTime().sort((a, b) => a.depth - b.depth);
    for (const item of fish) {
      const depth = item.blur > 2 ? 'far' : item.blur > 0 ? 'mid' : null;
      const image = this.assets?.depth?.[depth]?.[item.species]?.[item.poseIndex] || this.assets?.[item.species]?.[item.poseIndex];
      drawFish(ctx, item, image, this.reducedMotion);
    }
    const vignette = ctx.createRadialGradient(.5, .45, .18, .5, .5, .49);
    vignette.addColorStop(0, 'rgba(1,30,31,0)');
    vignette.addColorStop(.72, 'rgba(1,24,29,.015)');
    vignette.addColorStop(1, 'rgba(1,21,27,.24)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, 1, 1);
    ctx.restore();
    const metal = ctx.createLinearGradient(.1, 0, .9, 1);
    metal.addColorStop(0, '#f0f9f6'); metal.addColorStop(.26, '#63888a');
    metal.addColorStop(.52, '#c9e0d9'); metal.addColorStop(.77, '#48686d'); metal.addColorStop(1, '#99bcb4');
    ctx.beginPath(); ctx.arc(.5, .5, .478, 0, TAU);
    ctx.strokeStyle = metal; ctx.lineWidth = .017; ctx.stroke();
    ctx.beginPath(); ctx.arc(.5, .5, .468, 0, TAU);
    ctx.strokeStyle = 'rgba(7,37,42,.7)'; ctx.lineWidth = .004; ctx.stroke();
    ctx.restore();
  }
}

export const createUnderwaterScene = options => new UnderwaterScene(options);
