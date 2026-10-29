/** Reservoir pole fishing. All physics coordinates and constraints are in metres.
 * x = lateral, y = out over the reservoir, z = height above its surface.
 * A pole is a 4.5 m articulated solid; its tip carries one fixed 4.2 m line.
 * There is deliberately no reel, changing line length, inventory, or bite logic.
 */
export const ROD_LENGTH = 4.5;
export const LINE_LENGTH = 4.2;
export const PREPARATION_DURATION = 0.65;
export const CHARGE_DURATION = 1.25;
export const CAST_SUCCESS_MIN = 65;
export const CAST_SUCCESS_MAX = 100;
// The normalized input steers the real pole by +/-10.31 degrees. These world
// aiming values widen the actual launch, while aim=0 keeps the reference arc.
export const CAST_AIM_YAW = 0.18;
export const CAST_AIM_LATERAL_SPREAD = 1.4;
export const SWING_DURATION = 0.4;
export const FIXED_STEP = 1 / 120;
export const MAX_DELTA = 0.1;
export const WATER_BOUNDS = Object.freeze({ minX: 130, maxX: 440, minY: 350, maxY: 650 });
export const RETRIEVE_DURATION = 1.3;
// Presentation only. Neither this duration nor any fish motion changes game rules.
export const CATCH_VISUAL_DURATION = 1.65;
export const CATCH_HOLD_DURATION = 4;
export const HOOK_VISUAL_DURATION = 0.48;
// These are presentation envelopes, never inputs to FishingGame's tension rules.
export const FISH_RESISTANCE_DURATION = 0.42;
export const FISH_RESISTANCE_COOLDOWN = 0.9;
export const FISH_HOLD_DURATION = 3;
export const FISH_TRAVEL_DURATION = 1.6;
export const FISH_APPROACH_DURATION = HOOK_VISUAL_DURATION + 0.97;
export const FISH_EDGE_SCREEN = Object.freeze({ left: 30, right: 510 });
// The fixed affine scene is an oblique/orthographic drawing. This virtual camera
// lies on its viewing axis through the grip: (0, -115, 95), perpendicular to the
// unchanged screen-y basis (0, -95, -115). It supplies distance only; it never
// moves the scenery or alters projectWorld / the camera's tiny existing accents.
export const CAMERA_WORLD = Object.freeze({ x: 0, y: -4.6, z: 5 });
export const FLOAT_PHYSICAL_LENGTH = 0.30;
export const FLOAT_REFERENCE_DISTANCE = 9;
export const FLOAT_SCALE_BOUNDS = Object.freeze({ min: 0.72, max: 1.5 });
// The rig is held close to the bank before the pole lifts it. Its world anchor
// projects to (145, 773.75), well inside the lower-left foreground.
export const READY_FLOAT_WORLD = Object.freeze({ x: -3.05, y: 1.45, z: 1.10 });
// The side-loaded release is at the reference drawing's left foreground edge.
// Preparation moves the actual rig here continuously while side-loading the pole;
// release itself never relocates it. These are world metres, not screen keys.
export const CAST_RELEASE_WORLD = Object.freeze({ x: -4.5, y: 0.5291337277, z: 1.5976721380 });
export function floatProjectionScale(worldPoint) {
  const d = Math.hypot(worldPoint.x - CAMERA_WORLD.x, worldPoint.y - CAMERA_WORLD.y, worldPoint.z - CAMERA_WORLD.z);
  return clamp(FLOAT_REFERENCE_DISTANCE / Math.max(1e-9, d), FLOAT_SCALE_BOUNDS.min, FLOAT_SCALE_BOUNDS.max);
}
// The unmultiplied fish scale is the V6 camera-distance baseline. Rendering
// applies the requested phase multiplier to this baseline exactly once; world
// constraints and species proportions do not depend on the display multiplier.
export function fishProjectionScale(worldPoint) {
  const d = Math.hypot(worldPoint.x - CAMERA_WORLD.x, worldPoint.y - CAMERA_WORLD.y, worldPoint.z - CAMERA_WORLD.z);
  return clamp(FLOAT_REFERENCE_DISTANCE / Math.max(1e-9, d), FLOAT_SCALE_BOUNDS.min, 3);
}
const GRAVITY = 9.81, SETTLE_DURATION = 1.15;
const ROD_BONES = 24, LINE_SEGMENTS = 20;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (t) => (t = clamp(t, 0, 1), t * t * (3 - 2 * t));
const vec = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add = (a, b) => vec(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => vec(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, n) => vec(a.x * n, a.y * n, a.z * n);
const len = (a) => Math.hypot(a.x, a.y, a.z);
const distance = (a, b) => len(sub(a, b));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const unit = (a) => mul(a, 1 / Math.max(1e-12, len(a)));
const copy = (a) => ({ ...a });
const GRIP = Object.freeze(vec(0, 0, 1.2));
// Distributed self-weight plus the small hanging rig load act in WORLD -z.
// These angle offsets are not screen-space droop: projection may foreshorten
// their apparent sag while every segment remains exactly 4.5 / 24 metres.
function gravitySag(t, pitch) {
  return Math.cos(pitch) * (0.16 * t ** 1.6 + 0.06 * t ** 2.7);
}
export function projectWorld(p) {
  return { x: 450 + p.x * 100, y: 900 - p.y * 95 - (p.z - 1.2) * 115, z: p.z };
}
function unprojectWater(x, y) { return vec((x - 450) / 100, (1038 - y) / 95, 0); }
function makeRandom(seed) {
  let s = Number.isFinite(seed) ? seed >>> 0 : 1729;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function rodDirection(yaw, pitch) {
  return vec(Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch));
}

/** Both onEvent and drainEvents are available; an event is generated only once. */
export class CastController {
  constructor({ onEvent = () => {}, seed = 1729, rng } = {}) {
    this.catchHoldDuration=CATCH_HOLD_DURATION;
    this.onEvent = typeof onEvent === 'function' ? onEvent : () => {};
    this.random = typeof rng === 'function' ? rng : makeRandom(seed);
    this._events = [];
    this._castId = 0;
    this.reset();
  }
  get state() { return this.snapshot(); }
  get phase() { return this._phase; }
  get charge() { return this._charge; }
  get lineLength() { return LINE_LENGTH; }
  get rodLength() { return ROD_LENGTH; }
  _emit(type, extra = {}) {
    const event = { type, castId: this._castId, charge: this._charge, aim: this._aim, ...extra };
    this._events.push(event);
    // Bound the optional diagnostic queue when clients exclusively use onEvent.
    if (this._events.length > 64) this._events.shift();
    this.onEvent(event);
  }
  drainEvents() { return this._events.splice(0); }
  _phaseTo(phase) { this._phase = phase; this._elapsed = 0; }
  reset() {
    this._phase = 'ready'; this._elapsed = 0; this._time = 0; this._accumulator = 0;
    this._charge = 0; this._aim = 0; this._committed = false; this._load = { lift: 0, tension: 0 };
    this._castFailure = null; this._failedPose = null; this._retrieveWet = false;
    this._holdTime = 0; this._flightTime = 0; this._flightDuration = 1;
    this._maxHeight = 0; this._maxConstraintError = 0; this._splash = null;
    this._splashAge = 0; this._accuracyError = 0; this._impact = null;
    // Ready is intentionally rod-only. Hidden state is explicit, not a rig parked
    // in foreground water, and begin() is the only operation that activates it.
    this._rigVisible = false; this._liftOut = null; this._liftOutAge = 0;
    this._floatAngle = 0; this._floatVelocity = vec(); this._readyPose = null;
    this._preparePose = null; this._swingPose = null; this._retrievePose = null;
    this._clearFishingVisual();
    this._rodAngles = Array.from({ length: ROD_BONES }, (_, i) => ({ yaw: -0.42, pitch: 0.575 - gravitySag(Math.max(0, (i - 2) / (ROD_BONES - 3)), 0.575), vyaw: 0, vpitch: 0 }));
    this._buildRod();
    this._float = this._restFloat(); this._floatPrevious = copy(this._float);
    this._velocity = vec(); this._target = this._safeWaterTarget(vec(-1.9, 4.568, 0), this._tip);
    this._rope = []; this._ropePrevious = []; this._events = [];
    this._solveLine(FIXED_STEP, true);
    return this.snapshot();
  }
  setAim(value) {
    if (!Number.isFinite(value) || !['ready', 'preparing', 'charging'].includes(this._phase)) return false;
    this._aim = clamp(value, -1, 1);
    this._previewTarget();
    return true;
  }
  setLoad({ lift = this._load.lift, tension = this._load.tension } = {}) {
    if (!Number.isFinite(lift) || !Number.isFinite(tension)) return false;
    this._load = { lift: clamp(lift, 0, 1), tension: clamp(tension, 0, 100) };
    return true;
  }
  setRodLoad(load) { return this.setLoad(load); }
  /** Feed the model snapshot without advancing time or producing events. The
   * controller consumes it only on a positive fixed step, so pause is exact. */
  setFishingState(snapshot = {}) {
    if (!snapshot || typeof snapshot.phase !== 'string') return false;
    const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
    this._fishingState = {
      phase: snapshot.phase,
      phaseElapsed: Math.max(0, number(snapshot.phaseElapsed)),
      fightElapsed: Math.max(0, number(snapshot.fightElapsed)),
      tension: clamp(number(snapshot.tension), 0, 100),
      progress: clamp(number(snapshot.progress), 0, 100),
      surge: Boolean(snapshot.surge), holding: Boolean(snapshot.holding),
      fish: snapshot.fish ? { ...snapshot.fish } : null,
    };
    return true;
  }
  _clearFishingVisual() {
    this._fishingState = null; this._fishVisual = null;
    this._fishRipples = []; this._fishRippleId = 0;
  }
  _fishRipple(kind, world, strength = 1, extra = {}) {
    const water = vec(world.x, world.y, 0);
    this._fishRipples.push({ id: `${this._castId}-${++this._fishRippleId}`, kind, world: water, position: projectWorld(water), age: 0, strength, ...extra });
    if (this._fishRipples.length > 16) this._fishRipples.shift();
    return water;
  }
  _prepareFishingVisual(dt) {
    this._fishRipples = this._fishRipples.filter(r => (r.age += dt) < 1.1);
    const source = this._fishingState;
    if (!source || !['waiting', 'settling'].includes(this._phase)) return;
    if (!['bite', 'fighting', 'caught'].includes(source.phase)) {
      if (this._fishVisual) {
        // A lost fish leaves the same wet rig at its last actual water location.
        this._impact = this._safeWaterTarget(vec(this._float.x, this._float.y, 0), this._tip);
        this._fishVisual = null; this._fishRipples = [];
      }
      return;
    }
    const catchId = source.fish?.catchId ?? `${this._castId}-visual`;
    let visual = this._fishVisual;
    if (!visual || visual.catchId !== catchId) {
      visual = this._fishVisual = {
        phase: 'bite', catchId, age: 0, hookAge: 0, catchAge: 0,
        fish: source.fish ? { ...source.fish } : null,
        origin: copy(this._impact || this._float), mouth: copy(this._float),
        previousMouth: copy(this._float), waterAnchor: vec(this._float.x, this._float.y, 0),
        heading: 1, angle: 0, jumpHeight: 0, airborne: false,
        catchStarted: false,
        wakeAge: 0, tension: 0, surge: false, progress: 0,
        resistance: 0, resistancePulse: 0, resistanceId: 0, resistanceSide: 0,
        resistanceAge: 1.1, resistanceWorld: null, resistanceTime: -Infinity,
        fightMotion: null, resistanceHoldId: null,
      };
    }
    visual.age += dt;
    visual.tension = source.tension; visual.surge = source.surge; visual.progress = source.progress;
    visual.fightElapsed = source.fightElapsed;
    visual.fightMotion = source.phase === 'fighting' ? this._fightMotionAt(source.fightElapsed) : null;
    if (source.phase === 'fighting' && visual.phase === 'bite') {
      visual.phase = 'hook'; visual.hookAge = 0;
      visual.hookStart = copy(this._float);
      visual.hookStartDistance = distance(this._tip, this._float);
      this._fishRipple('hook', this._float, 1.15);
      this._emit('visualHook', { position: projectWorld(visual.waterAnchor), world: copy(visual.waterAnchor), catchId });
    }
    if (source.phase === 'fighting') {
      visual.hookAge += dt;
      if (visual.hookAge >= HOOK_VISUAL_DURATION) visual.phase = 'fight';
      // Hooked fish swim below the water for the entire fight. Only the
      // explicit catch presentation may cross the surface.
      visual.jumpHeight = 0; visual.airborne = false;
    }
    if (source.phase === 'caught' && !visual.catchStarted) {
      visual.catchStarted = true; visual.phase = 'catch'; visual.catchAge = 0;
      visual.catchStart = copy(this._float);
      visual.waterAnchor = vec(this._float.x, this._float.y, 0);
      visual.catchEnd = vec(mix(this._float.x, -1.70, 0.99), -1.9955, 8.1701913);
      visual.catchSplashed = false; visual.airborne = false;
    }
    if (visual.phase === 'catch') visual.catchAge = Math.min((visual.fish?.liftDuration || CATCH_VISUAL_DURATION) + this.catchHoldDuration, visual.catchAge + dt);
    if (visual.phase !== 'fight' || source.phase !== 'fighting') {
      visual.resistance = 0; visual.resistancePulse = 0; visual.resistanceSide = 0;
      visual.resistanceAge = 1.1; visual.resistanceWorld = null;
      this._fishRipples = this._fishRipples.filter(r => r.kind !== 'resistance');
    }
  }
  _fightMotionAt(time) {
    const v = this._fishVisual;
    // Safe screen edges are converted through the same affine world projection
    // used for the actual mouth, rope and water effects. The nearer common
    // water range keeps both endpoints reachable by the real 4.2 m line.
    const left = (FISH_EDGE_SCREEN.left - 450) / 100;
    const right = (FISH_EDGE_SCREEN.right - 450) / 100;
    const y = 4.8;
    if (time < FISH_APPROACH_DURATION) {
      const progress = clamp(time / FISH_APPROACH_DURATION, 0, 1);
      return { phase: 'approach-left', side: -1, holding: false, holdProgress: 0,
        travelProgress: progress, holdId: null, x: mix(v.origin.x, left, smooth(progress)),
        y: mix(v.origin.y, y, smooth(progress)), left, right };
    }
    const half = FISH_HOLD_DURATION + FISH_TRAVEL_DURATION;
    const elapsed = Math.max(0, time - FISH_APPROACH_DURATION);
    const leg = Math.floor((elapsed + 1e-9) / half);
    const local = Math.max(0, elapsed - leg * half);
    const side = leg % 2 === 0 ? -1 : 1;
    const from = side < 0 ? left : right, to = side < 0 ? right : left;
    if (local < FISH_HOLD_DURATION - 1e-9) {
      return { phase: side < 0 ? 'hold-left' : 'hold-right', side, holding: true,
        holdProgress: clamp(local / FISH_HOLD_DURATION, 0, 1), travelProgress: 0,
        holdId: leg, x: from, y, left, right };
    }
    const progress = clamp((local - FISH_HOLD_DURATION) / FISH_TRAVEL_DURATION, 0, 1);
    return { phase: side < 0 ? 'travel-right' : 'travel-left', side: -side, holding: false,
      holdProgress: 0, travelProgress: progress, holdId: null,
      x: mix(from, to, smooth(progress)), y, left, right };
  }
  _stepFishResistance(dt) {
    const v = this._fishVisual, motion = v?.fightMotion;
    if (!v || v.phase !== 'fight' || this._fishingState?.phase !== 'fighting' || !motion) return;
    // Force builds near an actual endpoint and remains loaded throughout its
    // complete hold. It relaxes smoothly through the middle of each traverse.
    const center = (motion.left + motion.right) / 2;
    const lateral = clamp((motion.x - center) / Math.max(0.1, (motion.right - motion.left) / 2), -1, 1);
    const edge = motion.holding ? 1 : smooth((Math.abs(lateral) - 0.44) / 0.36);
    v.resistance = mix(v.resistance, edge, 1 - Math.exp(-22 * dt));
    if (edge === 0 && v.resistance < 0.001) v.resistance = 0;
    v.resistanceAge = Math.min(1.1, v.resistanceAge + dt);
    const arrived = motion.holding && Math.hypot(this._float.x - motion.x, this._float.y - motion.y) < 0.025;
    // A hold has one arrival cue. Body/tail struggle can continue visually,
    // but it cannot make repeated splashes or replay audio at a fixed point.
    if (arrived && motion.holdId !== v.resistanceHoldId && this._time - v.resistanceTime >= FISH_RESISTANCE_COOLDOWN) {
      const side = motion.side, strength = clamp(0.65 + v.resistance * 0.35, 0, 1);
      const world = vec(this._float.x, this._float.y, 0);
      v.resistanceId++; v.resistanceSide = side; v.resistanceAge = 0;
      v.resistanceWorld = world; v.resistanceTime = this._time; v.resistanceHoldId = motion.holdId;
      this._fishRipple('resistance', world, strength, { side, resistanceId: v.resistanceId, holdId: motion.holdId });
      this._emit('fishResistance', {
        id: v.resistanceId, catchId: v.catchId, side, strength, duration: FISH_RESISTANCE_DURATION,
        holdId: motion.holdId, holdDuration: FISH_HOLD_DURATION,
        world: copy(world), position: projectWorld(world), mouthWorld: copy(this._float),
      });
    }
    const progress = clamp(v.resistanceAge / FISH_RESISTANCE_DURATION, 0, 1);
    v.resistancePulse = Math.sin(progress * Math.PI) * edge;
    if (progress >= 1) v.resistancePulse = 0;
  }
  _fishingRodPose(yaw, pitch) {
    const v = this._fishVisual;
    if (!v) return { yaw, pitch };
    if (v.phase === 'bite') return { yaw, pitch };
    const hook = smooth(v.hookAge / 0.15) * (1 - smooth((v.hookAge - 0.17) / 0.33));
    const targetYaw = Math.atan2(this._float.x, Math.max(0.5, this._float.y));
    const tracking = clamp(targetYaw - yaw, -0.30, 0.30) * 0.62;
    if (v.phase === 'catch' || v.phase === 'caught') {
      const u = clamp(v.catchAge / (v.fish?.liftDuration || CATCH_VISUAL_DURATION), 0, 1);
      // Raise/back the actual solid pole in step with the nearward fish, after
      // it leaves the water. The same 4.2 m line limits every intermediate pose.
      return { yaw: yaw + tracking, pitch: pitch + 0.87 * smooth((u - 0.18) / 0.48) };
    }
    // With a fixed 4.2 m line a tip above that height cannot keep a fish
    // submerged. Limit the hook drive, including the player's lift input;
    // elastic rod response still supplies the small hook-set recoil.
    // The newly reachable far-left water needs slightly more vertical reach
    // during hook-set. Ease its lift ceiling down before the fixed line could
    // pull the submerged mouth sideways; the reference corridor is unchanged.
    const hookCeiling = 0.84 - 0.08 * smooth((-v.origin.x - 2.45) / 0.55);
    return { yaw: yaw + tracking, pitch: Math.min(hookCeiling, pitch + 0.16 * smooth(v.hookAge / 0.34) + hook * 0.29) };
  }
  _stepFishingVisual(dt) {
    const v = this._fishVisual;
    if (!v || !['waiting', 'settling'].includes(this._phase)) return false;
    const source = this._fishingState;
    v.previousMouth = copy(this._float);
    if (v.phase === 'catch' && v.catchHoldPose) {
      // Keep the actual constrained endpoint and its complete hero pose still.
      // This presentation delay never re-emits a model catch or changes reward.
      this._float = copy(v.catchHoldPose.mouth);
      v.mouth = copy(this._float);
      v.angle = v.catchHoldPose.angle; v.heading = v.catchHoldPose.heading;
      if (v.catchAge + 1e-9 >= (v.fish?.liftDuration || CATCH_VISUAL_DURATION) + this.catchHoldDuration) {
        v.phase = 'caught'; this._rigVisible = false;
        this._emit('catchVisualComplete', { catchId: v.catchId });
      }
      return true;
    }
    if (v.phase === 'bite') {
      const t = source.phaseElapsed;
      this._float = add(v.origin, vec(0.016 * Math.sin(t * 13), 0.008 * Math.sin(t * 9), -0.035 - 0.11 * (0.5 + 0.5 * Math.sin(t * 11))));
      v.waterAnchor = vec(this._float.x, this._float.y, 0);
      v.mouth = add(this._float, vec(0.04, 0, -0.19));
      return true;
    }
    if (v.phase === 'hook' || v.phase === 'fight') {
      const t = source.fightElapsed, tension = source.tension / 100;
      const hookProgress = smooth(v.hookAge / HOOK_VISUAL_DURATION);
      const motion = v.fightMotion || this._fightMotionAt(t);
      const desired = vec(motion.x, motion.y, 0);
      // A real fish endpoint beneath the surface takes up the rope. The target
      // chord varies with tension, surge and body movement; slack is still the
      // same measured 4.2 m gravity curve rather than a stretched straight line.
      const normalDistance = Math.min(LINE_LENGTH - 0.008, 3.96 + tension * 0.22 + (source.surge ? 0.035 : 0) + Math.sin(t * 3.7) * 0.025);
      const tautDistance = mix(normalDistance, LINE_LENGTH - 0.003, v.resistance || 0);
      const reach = mix(v.hookStartDistance, tautDistance, hookProgress);
      const horizontal = Math.hypot(desired.x - this._tip.x, desired.y - this._tip.y);
      desired.z = this._tip.z - Math.sqrt(Math.max(0.05, reach ** 2 - horizontal ** 2));
      desired.z = Math.min(-0.08, desired.z);
      const baseDepth = desired.z;
      const target = lerp(v.hookStart, desired, hookProgress);
      // Fixed-step response smooths changes in the existing model's surge flag.
      const response = 1 - Math.exp(-(15 + (v.resistance || 0) * 25) * dt);
      this._float = lerp(this._float, target, response);
      this._constrainFloat();
      // Hooking straight from waiting can begin on a tiny positive bob; pin
      // its continuous take-up just below the surface, never into a jump.
      this._float.z = Math.min(-0.012, this._float.z);
      this._constrainSubmergedFloat();
      // Take up slack along the actual tip-to-mouth chord. This moves the
      // constrained endpoint itself, so a taut line never becomes an overlay or
      // an overlength segment while the elastic tip is still being pulled down.
      const pull = clamp((v.resistance || 0) + (v.resistancePulse || 0) * 0.35, 0, 1);
      if (pull > 0) {
        const chord = sub(this._float, this._tip), chordLength = len(chord);
        const tightened = mix(chordLength, Math.max(chordLength, LINE_LENGTH - 0.003), pull);
        this._float = add(this._tip, mul(unit(chord), tightened));
        this._constrainSubmergedFloat();
      }
      if (motion.phase.startsWith('travel') || (motion.phase === 'approach-left' && v.phase === 'fight')) {
        // Preserve the eased lateral traverse even when a high player lift
        // reduces the submerged reach. Resolve that same sphere in y/depth,
        // rather than letting a radial clamp briefly send the fish backward.
        // A released reach constraint may catch up with the eased target, but
        // the real endpoint still has a bounded 6 m/s lateral take-up speed.
        const lateralStep = 6 * dt;
        const motionX = clamp(motion.x, v.previousMouth.x - lateralStep, v.previousMouth.x + lateralStep);
        const dx = motionX - this._tip.x;
        const crossReach = Math.sqrt(Math.max(0, (LINE_LENGTH - 1e-9) ** 2 - dx ** 2));
        if (this._tip.z - crossReach < -0.012) {
          const depth = Math.max(this._tip.z - crossReach + 1e-9, Math.min(-0.012, this._float.z));
          const reachY = Math.sqrt(Math.max(0, crossReach ** 2 - (depth - this._tip.z) ** 2));
          this._float = vec(motionX, clamp(this._float.y, this._tip.y - reachY, this._tip.y + reachY), depth);
        }
      }
      if (motion.holding) {
        // Hold the actual mouth laterally at this endpoint for the full 3 s.
        // Its depth follows the elastic tip on the same almost-taut sphere;
        // there is no separate frozen fish sprite or disconnected surface VFX.
        const horizontal = Math.hypot(motion.x - this._tip.x, motion.y - this._tip.y);
        const holdReach = LINE_LENGTH - 0.003;
        const depth = this._tip.z - Math.sqrt(Math.max(0, holdReach ** 2 - horizontal ** 2));
        if (horizontal < holdReach && depth <= -0.012) this._float = vec(motion.x, motion.y, depth);
        this._constrainSubmergedFloat();
      }
      v.jumpHeight = 0; v.airborne = false;
      v.waterAnchor = vec(this._float.x, this._float.y, 0);
      this._stepFishResistance(dt);
      v.baseDepth = baseDepth;
      v.wakeAge += dt;
      if (v.wakeAge >= 0.19) { v.wakeAge %= 0.19; this._fishRipple('wake', this._float, source.surge ? 0.85 : 0.45); }
    } else if (v.phase === 'catch' || v.phase === 'caught') {
      // Small/legacy fish retain 1.65 s; larger fish take a little longer. The hero pose stays
      // visible for four seconds before the separate presentation-complete event.
      const p = v.catchAge + 1e-9 >= (v.fish?.liftDuration || CATCH_VISUAL_DURATION) ? 1 : clamp(v.catchAge / (v.fish?.liftDuration || CATCH_VISUAL_DURATION), 0, 1);
      const emerge = smooth(p / 0.15), flight = clamp((p - 0.15) / 0.70, 0, 1);
      const surface = copy(v.waterAnchor);
      this._float = p < 0.15 ? lerp(v.catchStart, surface, emerge) : lerp(surface, v.catchEnd, smooth(flight));
      if (p >= 0.15) this._float.z += Math.sin(Math.PI * flight) * 1.38;
      this._constrainFloat();
      v.jumpHeight = Math.max(0, this._float.z); v.airborne = this._float.z > 0;
      if (!v.catchSplashed && p >= 0.15) {
        v.catchSplashed = true;
        this._fishRipple('catch', v.waterAnchor, 1.65);
        this._emit('catchLeap', { position: projectWorld(v.waterAnchor), world: copy(v.waterAnchor), catchId: v.catchId });
      }

    }
    v.mouth = copy(this._float);
    const movement = sub(v.mouth, v.previousMouth);
    if (v.phase === 'fight' && v.fightMotion?.holding) v.heading = v.fightMotion.side;
    else if (Math.abs(movement.x) > 0.0001) v.heading = Math.sign(movement.x);
    // The nose is pinned; only the body behind it flaps. Small pitch follows
    // the real vertical motion without spinning the entire fish at turnarounds.
    const slope = clamp(-movement.z * 9 - movement.y * 5, -0.65, 0.65);
    const flap = v.phase === 'catch' ? Math.sin(v.catchAge * 28) * 0.22 : Math.sin((v.fightElapsed || 0) * 13) * 0.055;
    v.angle = (v.heading < 0 ? Math.PI : 0) + slope * v.heading + flap;
    if (v.phase === 'catch' && v.catchAge + 1e-9 >= (v.fish?.liftDuration || CATCH_VISUAL_DURATION) && !v.catchHoldPose) {
      v.catchAge = v.fish?.liftDuration || CATCH_VISUAL_DURATION;
      v.catchHoldPose = { mouth: copy(this._float), angle: v.angle, heading: v.heading };
    }
    return true;
  }
  _waterFloatWorld() {
    // The float stays on the actual rope/surface intersection while the mouth
    // is underwater. No second disconnected bobber is parked at the old impact.
    for (let i = 1; i < this._rope.length; i++) {
      const a = this._rope[i - 1], b = this._rope[i];
      if (a.z >= 0 && b.z <= 0) return lerp(a, b, a.z / Math.max(1e-9, a.z - b.z));
    }
    return copy(this._float);
  }
  _fishSnapshot() {
    const v = this._fishVisual;
    if (!v) return null;
    const attached = v.phase !== 'bite', scale = fishProjectionScale(v.mouth);
    const bodyLength = (v.fish?.length || 30) * scale;
    const mouth = { ...projectWorld(v.mouth), scale };
    const center = { x: mouth.x - Math.cos(v.angle) * bodyLength * 0.42, y: mouth.y - Math.sin(v.angle) * bodyLength * 0.42, z: mouth.z, scale };
    const centerWorld = vec(v.mouth.x + (center.x - mouth.x) / 100, v.mouth.y - (center.y - mouth.y) / 95, v.mouth.z);
    return {
      active: v.phase !== 'caught', phase: v.phase, visible: attached && v.phase !== 'caught', attached,
      age: v.age, hookAge: v.hookAge, catchAge: v.catchAge, catchId: v.catchId,
      mouthWorld: copy(v.mouth), mouth, centerWorld, center,
      waterAnchorWorld: copy(v.waterAnchor), waterAnchor: projectWorld(v.waterAnchor),
      angle: v.angle, heading: v.heading, baseBodyLength: bodyLength, bodyLength, scale,
      opacity: v.airborne || v.phase === 'catch' ? 1 : 0.58,
      jumpHeight: v.jumpHeight, airborne: v.airborne,
      fightMotionPhase: v.fightMotion?.phase || null,
      fightHolding: Boolean(v.fightMotion?.holding), fightSide: v.fightMotion?.side || 0,
      fightHoldProgress: v.fightMotion?.holdProgress || 0,
      fightTravelProgress: v.fightMotion?.travelProgress || 0,
      fightHoldDuration: FISH_HOLD_DURATION, fightTravelDuration: FISH_TRAVEL_DURATION,
      fightHoldId: v.fightMotion?.holdId ?? null,
      fightAnchorWorld: v.fightMotion?.holding ? vec(v.fightMotion.x, v.fightMotion.y, 0) : null,
      resistance: v.resistance, resistancePulse: v.resistancePulse,
      resistanceId: v.resistanceId, resistanceSide: v.resistanceSide,
      resistanceAge: v.resistanceAge, resistanceDuration: FISH_RESISTANCE_DURATION,
      resistanceProgress: clamp(v.resistanceAge / FISH_RESISTANCE_DURATION, 0, 1),
      resistanceActive: v.phase === 'fight' && v.resistanceAge < FISH_RESISTANCE_DURATION,
      resistanceWorld: v.resistanceWorld ? copy(v.resistanceWorld) : null,
      resistancePosition: v.resistanceWorld ? projectWorld(v.resistanceWorld) : null,
      hookProgress: clamp(v.hookAge / HOOK_VISUAL_DURATION, 0, 1),
      catchProgress: clamp(v.catchAge / (v.fish?.liftDuration || CATCH_VISUAL_DURATION), 0, 1),
      catchHolding: v.phase === 'catch' && Boolean(v.catchHoldPose),
      catchHoldElapsed: clamp(v.catchAge - (v.fish?.liftDuration || CATCH_VISUAL_DURATION), 0, this.catchHoldDuration),
      catchHoldRemaining: v.phase === 'catch' && v.catchHoldPose ? Math.max(0, (v.fish?.liftDuration || CATCH_VISUAL_DURATION) + this.catchHoldDuration - v.catchAge) : 0,
      flexPhase: v.phase === 'catch' || v.phase === 'caught' ? Math.min(v.catchAge, v.fish?.liftDuration || CATCH_VISUAL_DURATION) * 25 : (v.fightElapsed || 0) * 15,
      tension: v.tension, surge: v.surge, progress: v.progress, fish: v.fish ? { ...v.fish } : null,
      ripples: this._fishRipples.map(r => ({ ...r, world: copy(r.world), position: copy(r.position) })),
    };
  }
  _previewTarget() {
    const tip = add(GRIP, mul(rodDirection(-0.42 + this._aim * CAST_AIM_YAW, 0.47), ROD_LENGTH));
    const overpower = Math.max(0, (this._charge - 90) / 10);
    this._target = this._safeWaterTarget(vec(-1.9 + this._aim * CAST_AIM_LATERAL_SPREAD, 4.568 + this._charge / 100 * 1.54 + overpower * 0.21, 0), tip);
  }
  begin({ aim = this._aim } = {}) {
    if (this._phase !== 'ready') return false;
    this._clearFishingVisual();
    this.setAim(aim); this._castId += 1; this._charge = 0; this._holdTime = 0;
    this._committed = false; this._splash = null; this._maxHeight = 0;
    this._castFailure = null; this._failedPose = null; this._retrieveWet = false;
    this._maxConstraintError = 0; this._accuracyError = 0;
    this._liftOut = null; this._liftOutAge = 0; this._impact = null;
    this._float = this._restFloat(); this._floatPrevious = copy(this._float);
    this._floatVelocity = vec(); this._floatAngle = 0;
    this._constrainFloat(); this._solveLine(FIXED_STEP, true);
    this._rigVisible = true;
    this._preparePose = { yaw: this._rodAngles[0].yaw, pitch: this._rodAngles[0].pitch };
    this._preparationStart = copy(this._float);
    this._phaseTo('preparing'); this._emit('preparing'); return true;
  }
  release() {
    if (!['preparing', 'charging'].includes(this._phase) || this._committed) return false;
    if (this._phase === 'preparing' || this._charge < CAST_SUCCESS_MIN || this._charge > CAST_SUCCESS_MAX) {
      const reason = this._phase === 'preparing' ? 'early-release' : this._charge < CAST_SUCCESS_MIN ? 'undercharge' : 'overcharge';
      // A released failed attempt leaves the actual hanging rig in place until
      // the player retrieves it. It is neither a cancellation nor a water cast.
      this._committed = true;
      this._castFailure = { reason, charge: this._charge };
      this._failedPose = { yaw: this._rodAngles[0].yaw, pitch: this._rodAngles[0].pitch };
      this._phaseTo('failed'); this._emit('castFailed', { ...this._castFailure });
      return false;
    }
    this._committed = true;
    this._releaseCharge = this._charge;
    const overpower = Math.max(0, (this._charge - 90) / 10);
    this._accuracyError = overpower * (this.random() * 2 - 1) * 0.32;
    const endTip = add(GRIP, mul(rodDirection(-0.42 + this._aim * CAST_AIM_YAW, 0.47), ROD_LENGTH));
    const desired = vec(-1.9 + this._aim * CAST_AIM_LATERAL_SPREAD + this._accuracyError, 4.568 + this._charge / 100 * 1.54 + overpower * 0.21, 0);
    this._target = this._safeWaterTarget(desired, endTip);
    this._swingStart = copy(this._float);
    this._swingPose = { yaw: this._rodAngles[0].yaw, pitch: this._rodAngles[0].pitch };
    this._beginArc();
    this._phaseTo('swing'); this._emit('commit', { target: projectWorld(this._target), sweetSpot: true });
    return true;
  }
  cancel(reason = 'cancelled') {
    if (!['preparing', 'charging'].includes(this._phase) || this._committed) return false;
    const castId = this._castId, aim = this._aim;
    this.reset(); this._castId = castId; this._aim = aim;
    this._emit('cancelled', { reason }); return true;
  }
  retrieve() {
    if (!['waiting', 'settling', 'failed'].includes(this._phase)) return false;
    this._retrieveWet = this._phase !== 'failed';
    this._clearFishingVisual();
    this._retrieveStart = copy(this._float);
    this._retrievePose = { yaw: this._rodAngles[0].yaw, pitch: this._rodAngles[0].pitch };
    this._liftOut = null; this._liftOutAge = 0; this._load = { lift: 0, tension: 0 };
    this._phaseTo('retrieving');
    this._emit('retrieveStart', { position: projectWorld(this._float) });
    return true;
  }
  update(delta) {
    if (!Number.isFinite(delta) || delta <= 0) return this.snapshot();
    this._accumulator += Math.min(delta, MAX_DELTA);
    // Advance the same stable trajectory faster only from release to splash.
    // Charging, settling, bites, fighting and retrieval retain their original timing.
    while (true) {
      const speed = ['swing', 'flight'].includes(this._phase) ? 1 : 1;
      const wallStep = FIXED_STEP / speed;
      if (this._accumulator + 1e-10 < wallStep) break;
      this._accumulator = Math.max(0, this._accumulator - wallStep);
      this._step(FIXED_STEP);
    }
    return this.snapshot();
  }
  _restFloat() { return copy(READY_FLOAT_WORLD); }
  _buildRod() {
    const points = [copy(GRIP)];
    for (const bone of this._rodAngles) points.push(add(points.at(-1), mul(rodDirection(bone.yaw, bone.pitch), ROD_LENGTH / ROD_BONES)));
    this._rod = points; this._tip = copy(points.at(-1));
  }
  _rodPoseAt(p, delay = 0) {
    const phase = this._phase;
    // Widen the aiming/casting pose, then ease back during water settling so
    // hooked-fish edge holds, catch framing and retrieval keep their V13 pose.
    const aiming = ['ready', 'preparing', 'charging', 'failed', 'swing', 'flight'].includes(phase) ? 1 : phase === 'settling' ? 1 - smooth(p / SETTLE_DURATION) : 0;
    const yaw = -0.42 + this._aim * mix(0.075, CAST_AIM_YAW, aiming);
    const time = Math.max(0, p - delay);
    if (phase === 'preparing') {
      const t = smooth(time / PREPARATION_DURATION);
      return { yaw: mix(this._preparePose.yaw, yaw - 0.30, t), pitch: mix(this._preparePose.pitch, 0.60, t) };
    }
    if (phase === 'charging') return { yaw: yaw - 0.30, pitch: 0.60 + this._charge / 100 * 0.015 };
    if (phase === 'failed') return this._failedPose;
    if (phase === 'swing' || phase === 'flight') {
      // A side cast lifts the solid tip, then lowers it forward. As the rig
      // reaches full extension, real line tension redirects its velocity;
      // the path itself is never prescribed in screen or world coordinates.
      const clock = Math.max(0, p + (phase === 'flight' ? SWING_DURATION : 0) - delay);
      const lift = smooth(clock / SWING_DURATION);
      const forward = smooth((clock - 0.63616117) / 0.71348013);
      const load = smooth(this._releaseCharge / 70);
      const swing = clamp(clock / SWING_DURATION, 0, 1);
      const lowYaw = phase === 'flight' ? yaw : mix(this._swingPose.yaw, yaw - 0.24, smooth(swing / 0.8)) + 0.24 * smooth((swing - 0.8) / 0.2);
      const lowPitch = phase === 'flight' ? 0.47 : mix(this._swingPose.pitch, 0.2, smooth(swing / 0.6)) + 0.27 * smooth((swing - 0.6) / 0.4);
      return {
        yaw: mix(lowYaw, mix(mix(this._swingPose.yaw, yaw - 0.40422370, lift), yaw, forward), load),
        pitch: mix(lowPitch, mix(mix(this._swingPose.pitch, 1.00219578, lift), 0.47, forward), load),
      };
    }
    if (phase === 'retrieving') {
      // Lift the wet rig first, then return the handle while the rig is drawn
      // right and stowed. The next begin can activate the same near-bank anchor
      // with no snap of the rod and no overlength line.
      const lift = smooth(time / 0.4), back = smooth((time - 0.42) / 0.46);
      return {
        yaw: mix(mix(this._retrievePose.yaw, yaw + 0.95, lift), yaw, back),
        pitch: mix(mix(this._retrievePose.pitch, 1.11, lift), 0.575, back),
      };
    }
    if (phase === 'ready' && this._readyPose) {
      const t = smooth(time / 0.55);
      return { yaw: mix(this._readyPose.yaw, yaw, t), pitch: mix(this._readyPose.pitch, 0.575, t) };
    }
    const pitch = ['flight', 'settling', 'waiting'].includes(phase) ? 0.47 + this._load.lift * 0.12 : 0.575;
    return phase === 'waiting' ? this._fishingRodPose(yaw, pitch) : { yaw, pitch };
  }
  _stepRod(dt) {
    // Hold the real rod together with its attached mouth so the 4.2 m line
    // remains physically unchanged throughout the frozen catch presentation.
    if (this._fishVisual?.phase === 'catch' && this._fishVisual.catchHoldPose) return;
    for (let i = 0; i < ROD_BONES; i++) {
      const a = this._rodAngles[i], t = Math.max(0, (i - 2) / (ROD_BONES - 3));
      // The rigid grip initiates the movement; a delayed drive travels along the
      // blank before the lighter, underdamped tip catches up and recoils.
      const delay = ['preparing', 'swing', 'retrieving'].includes(this._phase) ? 0.11 * t * t : 0;
      const pose = this._rodPoseAt(this._elapsed, delay);
      if (i < 3) { a.yaw = pose.yaw; a.pitch = pose.pitch; a.vyaw = 0; a.vpitch = 0; continue; }
      const releasing=['swing','flight'].includes(this._phase);
      const omega = releasing?mix(42,32,t*t):mix(35,14,t*t), damping = releasing?.78:mix(.92,.28,t*t);
      const preload=['ready','preparing','charging'].includes(this._phase)?.68:this._phase==='swing'?.68*(1-smooth(this._elapsed/.18)):0;
      const idleSettle = this._phase === 'ready' ? 0.003 * Math.sin(this._elapsed * 8) * Math.exp(-this._elapsed * 2.6) * t * t : 0;
      const v = this._fishVisual;
      const biteLoad = v?.phase === 'bite' ? (0.25 + Math.sin((this._fishingState?.phaseElapsed || 0) * 11) * 0.045) : 0;
      const fishLoad = v && v.phase !== 'bite' && v.phase !== 'caught' ? (0.13 + v.tension / 100 * 0.27 + (v.surge ? 0.13 : 0)) * (v.fish?.fightPower || 1) : 0;
      const hookBend = v?.phase === 'hook' ? Math.sin(Math.PI * clamp(v.hookAge / HOOK_VISUAL_DURATION, 0, 1)) * 0.26 : 0;
      const resistance = v?.phase === 'fight' ? clamp(v.resistance + v.resistancePulse * 0.35, 0, 1) : 0;
      const mouthPull = sub(this._float, this._tip);
      const pullYaw = Math.atan2(mouthPull.x, Math.max(0.25, mouthPull.y));
      const yawDelta = Math.atan2(Math.sin(pullYaw - pose.yaw), Math.cos(pullYaw - pose.yaw));
      const lateralLoad = v && v.phase !== 'bite' ? clamp(yawDelta, -0.42, 0.42) * v.tension / 100 * 0.30 * t * t : 0;
      // The thin distal blank curls toward the actual line tangent under a
      // lateral resistance load. Its proximal handle stays stiff; this is not a
      // rotation of a straight pole or a second screen-space rod drawing.
      const distalPull = resistance * 0.88 * t ** 3;
      const pullPitch = Math.atan2(mouthPull.z, Math.hypot(mouthPull.x, mouthPull.y));
      const basePitch = pose.pitch - gravitySag(t, pose.pitch) - preload*t*t + idleSettle - (biteLoad + fishLoad + hookBend) * t * t
        - (!v && ['settling', 'waiting'].includes(this._phase) ? this._load.tension / 100 * 0.32 * t * t : 0);
      const flexPitch = mix(basePitch, pullPitch, distalPull);
      const flexYaw = pose.yaw + lateralLoad + clamp(yawDelta, -1.1, 1.1) * distalPull;
      a.vyaw += ((flexYaw - a.yaw) * omega * omega - 2 * damping * omega * a.vyaw) * dt;
      a.vpitch += ((flexPitch - a.pitch) * omega * omega - 2 * damping * omega * a.vpitch) * dt;
      a.yaw += a.vyaw * dt; a.pitch += a.vpitch * dt;
    }
    this._buildRod();
  }
  _stepRetrieval() {
    const t = clamp(this._elapsed / RETRIEVE_DURATION, 0, 1), u = 1 - t;
    // A continuous lift-and-draw curve: rise out of the water first, travel back
    // toward the raised pole, then leave the right edge. It never drops into the
    // foreground. The endpoint remains attached to the SAME fixed 4.2 m line.
    const start = this._retrieveStart;
    const lift = add(start, vec(0.05, -0.12, 2.55));
    const draw = vec(1.05, 2.65, 3.75), stow = vec(1.85, 0.9, 4.2);
    this._float = add(add(mul(start, u * u * u), mul(lift, 3 * u * u * t)), add(mul(draw, 3 * u * t * t), mul(stow, t * t * t)));
    this._constrainFloat();
    if (this._rigVisible && this._retrieveWet && !this._liftOut && this._float.z > 0.035) {
      this._liftOut = projectWorld(vec(this._float.x, this._float.y, 0));
      this._liftOutAge = 0;
      this._emit('liftOut', { position: copy(this._liftOut) });
    }
    if (t >= 1 - 1e-9) {
      this._rigVisible = false; this._floatVelocity = vec();
      this._charge = 0; this._committed = false;
      this._castFailure = null; this._failedPose = null; this._retrieveWet = false;
      this._splash = null; this._impact = null; this._liftOut = null;
      this._readyPose = { yaw: this._rodAngles[0].yaw, pitch: this._rodAngles[0].pitch };
      this._phaseTo('ready'); this._emit('retrieved');
    }
  }
  _stepFloatOrientation(dt, oldFloat) {
    const before = projectWorld(oldFloat), after = projectWorld(this._float);
    this._floatVelocity = vec((after.x - before.x) / dt, (after.y - before.y) / dt, (this._float.z - oldFloat.z) / dt);
    const wet = ['settling', 'waiting'].includes(this._phase);
    const speed = Math.hypot(this._floatVelocity.x, this._floatVelocity.y);
    const angle = wet || speed < 12 ? 0 : Math.atan2(this._floatVelocity.y, this._floatVelocity.x) + Math.PI / 2;
    const delta = Math.atan2(Math.sin(angle - this._floatAngle), Math.cos(angle - this._floatAngle));
    this._floatAngle += delta * (1 - Math.exp(-(wet ? 12 : 8) * dt));
  }
  _step(dt) {
    this._time += dt; this._elapsed += dt;
    if (this._phase === 'preparing' || this._phase === 'charging') this._holdTime += dt;
    if (this._phase === 'preparing' && this._elapsed + 1e-9 >= PREPARATION_DURATION) { this._phaseTo('charging'); this._emit('charging'); }
    if (this._phase === 'charging') this._charge = clamp(Math.round((this._holdTime - PREPARATION_DURATION) / CHARGE_DURATION * 100 * 1e8) / 1e8, 0, 100);
    this._prepareFishingVisual(dt);
    this._stepRod(dt);
    if (['ready', 'preparing', 'charging'].includes(this._phase)) this._previewTarget();
    if (['settling', 'waiting'].includes(this._phase) && this._impact && !this._fishVisual) {
      this._impact = this._safeWaterTarget(this._impact, this._tip);
      this._target = copy(this._impact);
    }
    const oldFloat = copy(this._float);
    if (this._phase === 'ready') this._float = lerp(this._float, this._restFloat(), 1 - Math.exp(-10 * dt));
    if (this._phase === 'preparing' || this._phase === 'charging') {
      // The near-bank rig loads to the side within the moving tip's 4.2 m reach.
      // It is not repositioned at release or driven by a screen-space tween.
      const gravity = vec(0, 0, -GRAVITY * dt * dt);
      this._float = add(lerp(this._float, CAST_RELEASE_WORLD, 1 - Math.exp(-6.8 * dt)), gravity);
    }
    if (this._phase === 'swing') {
      this._stepFlight(dt);
      if (this._phase === 'swing' && this._elapsed + 1e-9 >= SWING_DURATION) this._launch();
    } else if (this._phase === 'flight') this._stepFlight(dt);
    else if (this._phase === 'settling') {
      const t = this._elapsed;
      // First dip, then two diminishing rises. Settling completes before bite logic starts.
      const z = -0.105 * Math.exp(-3.5 * t) * Math.sin(t * Math.PI * 4.2);
      this._float = add(this._impact, vec(Math.sin(t * 8) * Math.exp(-4 * t) * 0.018, 0, z));
      if (t + 1e-9 >= SETTLE_DURATION) { this._float = copy(this._impact); this._phaseTo('waiting'); this._emit('waiting', { target: projectWorld(this._impact) }); }
    } else if (this._phase === 'waiting' && !this._stepFishingVisual(dt)) {
      const nibble = this._fishingState?.phase === 'nibble';
      const nt = this._fishingState?.phaseElapsed || 0;
      // Two separate downward taps return to the same waterline between them.
      // Their genuine world displacement is much shallower than the true bite.
      const tap = (start, duration, depth) => {
        const p = (nt - start) / duration;
        return p > 0 && p < 1 ? -depth * Math.sin(Math.PI * p) ** 2 : 0;
      };
      const z = nibble ? tap(.12, .34, .085) + tap(.65, .42, .11) : .008 * Math.sin(this._elapsed * 2.4);
      this._float = add(this._impact, vec(0.009 * Math.sin(this._elapsed * 1.7), 0.004 * Math.sin(this._elapsed * 1.1), z));
    } else if (this._phase === 'retrieving') this._stepRetrieval();
    this._constrainFloat();
    // Keep the rendered mouth bit-for-bit on the final constrained endpoint,
    // including floating-point corrections on a fully taut catch line.
    if (this._fishVisual && this._fishVisual.phase !== 'bite') this._fishVisual.mouth = copy(this._float);
    this._stepFloatOrientation(dt, oldFloat);
    this._maxHeight = Math.max(this._maxHeight, this._float.z);
    this._floatPrevious = oldFloat;
    this._solveLine(dt);
    if (this._splash) this._splashAge += dt;
    if (this._liftOut) this._liftOutAge += dt;
  }
  _safeWaterTarget(point, tip) {
    let p = unprojectWater(clamp(projectWorld(point).x, WATER_BOUNDS.minX + 8, WATER_BOUNDS.maxX - 8), clamp(projectWorld(point).y, WATER_BOUNDS.minY + 8, WATER_BOUNDS.maxY - 8));
    // Intersection of a water rectangle and the fixed tip-centred reach circle.
    const radius = Math.sqrt(Math.max(0, (LINE_LENGTH - 0.025) ** 2 - tip.z ** 2));
    const horizontal = vec(p.x - tip.x, p.y - tip.y, 0), d = len(horizontal);
    if (d > radius) p = vec(tip.x + horizontal.x * radius / d, tip.y + horizontal.y * radius / d, 0);
    return p;
  }
  _beginArc() {
    // One actual 3D ballistic arc starts at the current float position on release.
    // The swing phase is its first 0.4 s, not a separate relocation animation.
    // Velocity is inverse-calibrated from the fixed camera's water target;
    // subsequent motion uses gravity + the same unilateral line constraint.
    this._flightDuration = 0.52 + this._releaseCharge / 100 * 0.45 + Math.max(0, this._releaseCharge - 90) / 10 * 0.045;
    const t = SWING_DURATION + this._flightDuration;
    // Launch impulse is calibrated in world axes for the side-loaded pole.
    // Its lateral/forward components still respond to aim and power; gravity
    // and the moving fixed-length tip determine every subsequent sample.
    const load = smooth(this._releaseCharge / 70);
    this._velocity = vec((this._target.x - this._float.x) / t * mix(1, 0.494231894, load) + this._aim * (this._aim < 0 ? 0.9 : 1.05) * load + load * (1 - load) * 2.5, (this._target.y - this._float.y) / t * mix(1, 1.250551534, load) + 0.5 * smooth((this._releaseCharge - 80) / 20), (0 - this._float.z + 0.5 * GRAVITY * t * t) / t * mix(1, 0.741813957, load));
    // Stronger upward launch creates a higher arc; fast simulation keeps the cast crisp.
    this._velocity.z *= 1.65 - Math.max(0, this._releaseCharge - 80) * .0125;
    this._flightPrevious = sub(this._float, mul(this._velocity, FIXED_STEP));
    this._flightPrevious.z -= 0.5 * GRAVITY * FIXED_STEP * FIXED_STEP;
    this._flightTime = -SWING_DURATION;
  }
  _launch() {
    // Crossing the phase boundary changes events only; position and velocity
    // continue from the very same world-space integration and line tension.
    this._phaseTo('flight'); this._emit('flight');
  }
  _stepFlight(dt) {
    this._flightTime += dt;
    const before = copy(this._float), displacement = sub(this._float, this._flightPrevious);
    this._float = add(add(this._float, displacement), vec(0, 0, -GRAVITY * dt * dt));
    this._flightPrevious = before;
    // The endpoint constraint is enforced on EVERY integration, before impact tests.
    this._constrainFloat(true);
    this._velocity = mul(sub(this._float, before), 1 / dt);
    if (this._float.z <= 0 && this._flightTime > 0.08) {
      const hit = lerp(before, this._float, clamp(before.z / Math.max(1e-9, before.z - this._float.z), 0, 1));
      this._impact = this._safeWaterTarget(vec(hit.x, hit.y, 0), this._tip);
      this._float = copy(this._impact); this._target = copy(this._impact);
      this._splash = projectWorld(this._impact); this._splashAge = 0;
      this._phaseTo('settling'); this._emit('splash', { position: copy(this._splash), speed: len(this._velocity) });
    }
  }
  _constrainFloat(velocityCorrection = false) {
    const radial = sub(this._float, this._tip), d = len(radial);
    if (d > LINE_LENGTH) {
      const n = unit(radial);
      this._float = add(this._tip, mul(n, LINE_LENGTH));
      if (velocityCorrection && this._flightPrevious) {
        const v = sub(this._float, this._flightPrevious), outward = dot(v, n);
        if (outward > 0) this._flightPrevious = add(this._flightPrevious, mul(n, outward));
      }
    }
    this._maxConstraintError = Math.max(this._maxConstraintError, Math.max(0, distance(this._tip, this._float) - LINE_LENGTH));
  }
  _constrainSubmergedFloat() {
    // Project onto the submerged part of the same 4.2 m reach sphere. A radial
    // sphere clamp alone can lift an endpoint above water when the pole rises.
    // Keep the water half-space and line length true together, without jumps.
    const depth = Math.min(-0.012, this._float.z);
    const dz = depth - this._tip.z;
    const radius = Math.sqrt(Math.max(0, (LINE_LENGTH - 1e-9) ** 2 - dz ** 2));
    const dx = this._float.x - this._tip.x, dy = this._float.y - this._tip.y;
    const horizontal = Math.hypot(dx, dy);
    if (horizontal > radius) {
      this._float.x = this._tip.x + dx * radius / Math.max(1e-12, horizontal);
      this._float.y = this._tip.y + dy * radius / Math.max(1e-12, horizontal);
    }
    this._float.z = Math.max(this._tip.z - LINE_LENGTH + 1e-9, depth);
  }
  _solveLine(dt, initialize = false) {
    const a = this._tip, b = this._float, segmentLength = LINE_LENGTH / LINE_SEGMENTS;
    if (initialize || this._rope.length !== LINE_SEGMENTS + 1) {
      this._rope = Array.from({ length: LINE_SEGMENTS + 1 }, (_, i) => lerp(a, b, i / LINE_SEGMENTS));
      this._ropePrevious = this._rope.map(copy);
    }
    // Verlet prediction followed by PBD distance constraints. Both ends are pinned.
    const previous = this._rope.map(copy);
    for (let i = 1; i < LINE_SEGMENTS; i++) {
      this._rope[i] = add(add(this._rope[i], mul(sub(this._rope[i], this._ropePrevious[i]), 0.972)), vec(0, 0, -GRAVITY * dt * dt));
    }
    this._rope[0] = copy(a); this._rope[LINE_SEGMENTS] = copy(b);
    for (let pass = 0; pass < 18; pass++) {
      for (let i = 0; i < LINE_SEGMENTS; i++) {
        const delta = sub(this._rope[i + 1], this._rope[i]), d = len(delta);
        if (d < 1e-10) continue;
        const correction = mul(delta, (d - segmentLength) / d);
        if (i === 0) this._rope[i + 1] = sub(this._rope[i + 1], correction);
        else if (i === LINE_SEGMENTS - 1) this._rope[i] = add(this._rope[i], correction);
        else { this._rope[i] = add(this._rope[i], mul(correction, 0.5)); this._rope[i + 1] = sub(this._rope[i + 1], mul(correction, 0.5)); }
      }
    }
    // Exact global arc-length projection removes iterative PBD creep. A gravity-
    // aligned slack curve is solved by bisection; its measured length is 4.2 m,
    // including in a frame where the moving rod suddenly pulls the line taut.
    const chord = sub(b, a), chordLength = len(chord), n = unit(chord);
    let sagDirection = sub(vec(0, 0, -1), mul(n, dot(vec(0, 0, -1), n)));
    if (len(sagDirection) < 0.05) sagDirection = vec(0, 1, 0);
    sagDirection = unit(sagDirection);
    const midpoint = this._rope[LINE_SEGMENTS / 2], midpointDelta = sub(midpoint, lerp(a, b, 0.5));
    const sideMotion = clamp(midpointDelta.x, -0.08, 0.08);
    sagDirection = unit(add(sagDirection, vec(sideMotion * 0.12, 0, 0)));
    const curve = (sag) => Array.from({ length: LINE_SEGMENTS + 1 }, (_, i) => {
      const t = i / LINE_SEGMENTS;
      return add(lerp(a, b, t), mul(sagDirection, Math.sin(Math.PI * t) * sag));
    });
    const arcLength = (points) => points.slice(1).reduce((sum, point, i) => sum + distance(point, points[i]), 0);
    let low = 0, high = LINE_LENGTH;
    if (chordLength < LINE_LENGTH - 1e-10) {
      for (let k = 0; k < 35; k++) { const m = (low + high) / 2; if (arcLength(curve(m)) < LINE_LENGTH) low = m; else high = m; }
    } else high = 0;
    this._rope = curve((low + high) / 2);
    this._rope[0] = copy(a); this._rope[LINE_SEGMENTS] = copy(b);
    this._ropePrevious = previous;
    this._lineArcLength = arcLength(this._rope);
  }
  snapshot() {
    const phase = this._phase;
    const preparationProgress = phase === 'preparing' ? clamp(this._elapsed / PREPARATION_DURATION, 0, 1) : phase === 'ready' ? 0 : 1;
    const swingProgress = phase === 'swing' ? clamp(this._elapsed / SWING_DURATION, 0, 1) : ['flight', 'settling', 'waiting', 'retrieving'].includes(phase) ? 1 : 0;
    const flightProgress = phase === 'flight' ? clamp(this._flightTime / this._flightDuration, 0, 0.999) : ['settling', 'waiting', 'retrieving'].includes(phase) ? 1 : 0;
    const phaseProgress = phase === 'preparing' ? preparationProgress : phase === 'charging' ? this._charge / 100 : phase === 'swing' ? swingProgress : phase === 'flight' ? flightProgress : phase === 'settling' ? clamp(this._elapsed / SETTLE_DURATION, 0, 1) : phase === 'retrieving' ? clamp(this._elapsed / RETRIEVE_DURATION, 0, 1) : 0;
    const retrievalProgress = phase === 'retrieving' ? clamp(this._elapsed / RETRIEVE_DURATION, 0, 1) : 0;
    const fishVisual = this._fishSnapshot();
    const attachedFish = Boolean(fishVisual?.attached);
    const displayFloatWorld = attachedFish ? this._waterFloatWorld() : this._float;
    const floatVisible = this._rigVisible && !attachedFish;
    const onWater = attachedFish ? !fishVisual.airborne && !['catch', 'caught'].includes(fishVisual.phase) : ['settling', 'waiting'].includes(phase) || (phase === 'retrieving' && this._retrieveWet && !this._liftOut);
    const projectedRod = this._rod.map(projectWorld), projectedLine = this._rope.map(projectWorld);
    const cameraDistance = distance(CAMERA_WORLD, displayFloatWorld);
    const scale = floatProjectionScale(displayFloatWorld);
    const follow = phase === 'flight' ? Math.sin(flightProgress * Math.PI) : 0;
    const preparingMotion = phase === 'preparing' ? Math.sin(preparationProgress * Math.PI) : 0;
    const swingMotion = phase === 'swing' ? Math.sin(swingProgress * Math.PI * 2) : 0;
    const impactMotion = phase === 'settling' ? Math.sin(this._elapsed * 16) * Math.exp(-this._elapsed * 7) : 0;
    const lineWorldDistance = distance(this._tip, this._float);
    return {
      phase, charge: this._charge, aim: this._aim, load: { ...this._load }, elapsed: this._elapsed, committed: this._committed, castId: this._castId,
      castFailure: this._castFailure ? { ...this._castFailure } : null,
      preparationProgress, swingProgress, flightProgress, phaseProgress, retrievalProgress,
      retrievalStage: phase === 'retrieving' ? (retrievalProgress < 0.3 ? 'lift' : retrievalProgress < 0.78 ? 'draw' : 'stow') : null,
      rigVisible: this._rigVisible, lineVisible: this._rigVisible, floatVisible, fishVisual,
      liftOut: this._liftOut ? { position: copy(this._liftOut), age: this._liftOutAge, active: this._liftOutAge < 0.65 } : null,
      sweetSpot: this._charge >= CAST_SUCCESS_MIN && this._charge <= CAST_SUCCESS_MAX, overpower: this._charge > 90,
      rodLength: ROD_LENGTH, lineLength: LINE_LENGTH, lineWorldDistance,
      lineConstraintError: Math.max(0, lineWorldDistance - LINE_LENGTH), maxLineConstraintError: this._maxConstraintError,
      lineArcLength: this._lineArcLength, lineLengthError: Math.abs(this._lineArcLength - LINE_LENGTH),
      grip: projectedRod[0], tip: projectedRod.at(-1), rodPoints: projectedRod,
      float: { ...projectWorld(displayFloatWorld), visible: floatVisible, angle: onWater ? 0 : this._floatAngle, distanceToCamera: cameraDistance, scale, physicalLength: FLOAT_PHYSICAL_LENGTH, velocity: copy(this._floatVelocity), wet: onWater, onWater, submerged: clamp(-displayFloatWorld.z / 0.105, 0, 1) }, target: projectWorld(this._target), linePoints: projectedLine,
      control: projectedLine[Math.floor(projectedLine.length / 2)],
      floatWorld: copy(displayFloatWorld), lineEndpointWorld: copy(this._float), tipWorld: copy(this._tip), gripWorld: copy(GRIP), targetWorld: copy(this._target),
      rodWorldPoints: this._rod.map(copy), lineWorldPoints: this._rope.map(copy),
      sinker: projectWorld(add(this._float, vec(0.025, 0, -0.11))),
      hook: attachedFish ? copy(fishVisual.mouth) : projectWorld(add(this._float, vec(0.04, 0, -0.19))),
      hookWorld: attachedFish ? copy(this._float) : add(this._float, vec(0.04, 0, -0.19)),
      impact: this._impact ? projectWorld(this._impact) : null,
      impactAge: this._splash ? this._splashAge : undefined, splashAge: this._splash ? this._splashAge : undefined,
      splash: this._splash ? { ...this._splash, age: this._splashAge, active: this._splashAge < 0.85 } : null,
      bobberDip: this._impact ? displayFloatWorld.z - this._impact.z : 0,
      camera: { worldPosition: copy(CAMERA_WORLD), x: clamp(-this._aim * follow * 1.5 + swingMotion * 0.6, -2, 2), y: clamp(follow * 1.8 + preparingMotion * 0.8 + swingMotion * 1.1 + impactMotion * 1.3, -2, 2), zoom: 1 + follow * 0.004 + Math.abs(swingMotion) * 0.001 },
      metrics: { maxHeight: this._maxHeight, accuracyError: this._accuracyError, flightTime: this._flightTime, flightDuration: this._flightDuration, range: Math.hypot(this._target.x, this._target.y) },
    };
  }
}

