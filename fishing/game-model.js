/**
 * Renderer-independent fishing simulation. Time is in seconds, fish length in cm,
 * weight in kg. Inject rng for deterministic tests/replays. A frame consumes at
 * most 0.1 seconds so a background-tab stall cannot instantly lose a fish.
 */
const freezeOptions = (options) => Object.freeze(options.map((option) => Object.freeze(option)));
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const IDLE_PHASES = new Set(['ready', 'caught', 'escaped']);
export const MAX_DELTA = 0.1;
export const NIBBLE_DURATION = 1.3;
export const NIBBLE_ONLY_CHANCE = 0.4;
export const MAX_FALSE_NIBBLES = 2;
export const MIN_NIBBLE_WAIT = 10;
export const BAIT_THEFT_CHANCE = 0.1;
export const TENSION_WARNING_THRESHOLD = 85;
export const TENSION_REARM_THRESHOLD = 82;
export const MAX_TENSION_CROSSINGS = 3;
export const ACTIVE_SPECIES_ID = 'crucian';

export const EQUIPMENT = Object.freeze({
  rod: freezeOptions([
    { id: 'stream-rod', name: '계곡 낚싯대', description: '감기와 조작의 균형이 좋은 기본 낚싯대', power: 1, control: 0, icon: '🎣' },
    { id: 'flex-rod', name: '유연한 낚싯대', description: '천천히 감지만 장력이 부드럽게 올라가요', power: 0.96, control: 0.14, icon: '🎣' },
    { id: 'carbon-rod', name: '카본 낚싯대', description: '물고기를 조금 더 빠르게 끌어당겨요', power: 1.12, control: 0.03, icon: '🎣' },
  ]),
  line: freezeOptions([
    { id: 'clear-line', name: '투명 낚싯줄', description: '가볍고 균형 잡힌 기본 낚싯줄', strength: 1, recovery: 1, icon: '〰️' },
    { id: 'soft-line', name: '부드러운 낚싯줄', description: '놓았을 때 장력이 더 빨리 내려가요', strength: 1.04, recovery: 1.2, icon: '〰️' },
    { id: 'strong-line', name: '튼튼한 낚싯줄', description: '물고기의 강한 당김을 더 잘 버텨요', strength: 1.2, recovery: 0.94, icon: '〰️' },
  ]),
  float: freezeOptions([
    { id: 'red-float', name: '빨간 찌', description: '입질을 알려주는 기본 찌', biteWindowBonus: 0, waitMultiplier: 1, icon: '🔴' },
    { id: 'sensitive-float', name: '민감한 찌', description: '입질이 조금 더 빨리 찾아와요', biteWindowBonus: 0.2, waitMultiplier: 0.85, icon: '🟠' },
    { id: 'steady-float', name: '안정적인 찌', description: '입질을 확인할 여유가 늘어나요', biteWindowBonus: 1, waitMultiplier: 1, icon: '🟡' },
  ]),
});

export const BAITS = freezeOptions([
  { id: 'worm', name: '크릴새우', description: '감성돔이 좋아하는 바다낚시 미끼예요', icon: '🦐', weights: Object.freeze([45, 32, 20, 3]) },
  { id: 'fly', name: '날벌레', description: '붕어가 좋아해요', icon: '🪰', weights: Object.freeze([20, 38, 32, 10]) },
  { id: 'minnow', name: '작은 물고기', description: '쏘가리·메기·장어가 좋아해요', icon: '🐟', weights: Object.freeze([10, 20, 38, 32]) },
  { id: 'dough', name: '떡밥', description: '붕어·잉어가 좋아해요', icon: '🍡', weights: Object.freeze([45,32,20,3]) },
]);

export const BAIT_SPECIES_PREFERENCES=Object.freeze({worm:[2,1,1,2,2],dough:[2,1,2,1,1],fly:[2,1,1,1,1],minnow:[1,2,1,2,2]});
export const SIZE_CLASSES = freezeOptions([
  { id: 'small', label: '소형', probability: 60, resistance: 1, liftDuration: 1.65 },
  { id: 'medium', label: '중형', probability: 30, resistance: 1.04, liftDuration: 1.75 },
  { id: 'large', label: '대형', probability: 10, resistance: 1.10, liftDuration: 2.05 },
]);
export const FISH_WEIGHTS = Object.freeze({
  day: Object.freeze([40,25,18,12,5]),
  night: Object.freeze([25,15,20,25,15]),
  rainyDay: Object.freeze([30,20,20,20,10]),
});
export const COASTAL_FISH=freezeOptions([
{id:'striped-beakfish',name:'돌돔',commonName:'Striped beakfish',art:'striped-beakfish-v1',rarity:'common',rarityLabel:'일반',icon:'🐟',color:'#a4a7ab',strength:1.10,speed:1,sizes:Object.freeze([18,28,40]),minLength:16,maxLength:44,weightFactor:.000016},
{id:'sea-bass',name:'농어',commonName:'Japanese sea bass',art:'sea-bass-v1',rarity:'uncommon',rarityLabel:'희귀',icon:'🐟',color:'#91a4ac',strength:1.10,speed:1,sizes:Object.freeze([30,45,60]),minLength:27,maxLength:66,weightFactor:.000009}
]);
export const FISH = freezeOptions([
  { id: 'crucian', name: '감성돔', commonName: 'Black sea bream', art: 'large-crucian-v1', rarity: 'common', rarityLabel: '일반', icon: '🐟', color: '#b5a773', strength: 1.10, speed: 1, sizes: Object.freeze([15,25,40]), minLength: 13.5, maxLength: 44, weightFactor: 0.000016 },
  { id: 'sogari', name: '쏘가리', commonName: 'Korean mandarin fish', art: 'sogari-v37', rarity: 'uncommon', rarityLabel: '희귀', icon: '🐟', color: '#958151', strength: 1.10, speed: 1, sizes: Object.freeze([15,30,50]), minLength: 13.5, maxLength: 55, weightFactor: 0.000014 },
  { id: 'carp', name: '잉어', commonName: 'Common carp', art: 'carp-v37', rarity: 'uncommon', rarityLabel: '희귀', icon: '🐟', color: '#b89748', strength: 1.10, speed: 1, sizes: Object.freeze([30,55,90]), minLength: 27, maxLength: 99, weightFactor: 0.000015 },
  { id: 'catfish', name: '메기', commonName: 'Catfish', art: 'catfish-v37', rarity: 'uncommon', rarityLabel: '희귀', icon: '🐟', color: '#747d78', strength: 1.10, speed: 1, sizes: Object.freeze([25,50,90]), minLength: 22.5, maxLength: 99, weightFactor: 0.000009 },
  { id: 'eel', name: '장어', commonName: 'Freshwater eel', art: 'eel-v37', rarity: 'rare', rarityLabel: '아주 희귀', icon: '🐟', color: '#776954', strength: 1.10, speed: 1, sizes: Object.freeze([30,55,85]), minLength: 27, maxLength: 93.5, weightFactor: 0.0000025 },
]);
/** Actual stamina units, not a display percentage: a 20 cm fish has 100.
 * Every additional centimetre adds stamina, including within a size class and
 * across species. This changes endurance without adding harder tension rules.
 */
export function fishStaminaForLength(length) {
  return 75 + length * 1.25;
}
export function fishWeightsFor(environment = {}) {
  return environment.isNight ? FISH_WEIGHTS.night : environment.weather === 'rain' ? FISH_WEIGHTS.rainyDay : FISH_WEIGHTS.day;
}
function weightedIndex(value, weights) {
  let pick = value * weights.reduce((sum, n) => sum + n, 0);
  for (let i=0;i<weights.length;i++) { pick -= weights[i]; if (pick < 0) return i; }
  return weights.length - 1;
}

export class FishingGame {
  constructor({ rng = Math.random, biteRng = Math.random, baitTheftRng = Math.random, onEvent = () => {} } = {}) {
    if (typeof rng !== 'function' || typeof biteRng !== 'function' || typeof baitTheftRng !== 'function' || typeof onEvent !== 'function') {
      throw new TypeError('rng, biteRng, baitTheftRng and onEvent must be functions');
    }
    this.rng = rng;
    // Bite choreography has its own stream: species, size, wait and fight RNG
    // consumption remain identical to earlier versions.
    this.biteRng = biteRng;
    this.baitTheftRng = baitTheftRng;
    this.onEvent = onEvent;
    this._castNumber = 0;
    this._equipment = { rod: 0, line: 0, float: 0 };
    this._baitIndex = 0;
    this._initialize();
  }

  _initialize() {
    this.state = {
      phase: 'ready', tension: 0, progress: 0, holding: false, elapsed: 0,
      phaseElapsed: 0, fightElapsed: 0, castProgress: 0, fish: null,
      message: '준비되면 낚싯줄을 던져보세요.', pull: false, surge: false,
      bait: BAITS[this._baitIndex], baitIndex: this._baitIndex,
      equipment: this._selectedEquipment(), equipmentIndices: { ...this._equipment },
      dangerTime: 0, slackTime: 0, biteRemaining: 0, escapeReason: null,
      tensionCrossings: 0, tensionWarning: false,
      nibbleKind: null, nibbleProgress: 0, nibbleRemaining: 0, falseNibbleCount: 0,
    };
    this._waitDuration = 0;
    this._biteDuration = 2.5;
    this._nextSurge = Infinity;
    this._surgeEnd = -1;
    this._tensionArmed = true;
  }

  _random() {
    const value = Number(this.rng());
    return Number.isFinite(value) ? clamp(value, 0, 1 - Number.EPSILON) : 0.5;
  }

  _biteRandom() {
    const value = Number(this.biteRng());
    return Number.isFinite(value) ? clamp(value, 0, 1 - Number.EPSILON) : 0.5;
  }

  _baitTheftRandom() {
    const value = Number(this.baitTheftRng());
    return Number.isFinite(value) ? clamp(value, 0, 1 - Number.EPSILON) : 0.5;
  }

  _beginNibble() {
    const s = this.state;
    const forced = s.falseNibbleCount >= MAX_FALSE_NIBBLES;
    s.nibbleKind = !this._tutorialOutcome && !forced && this._biteRandom() < NIBBLE_ONLY_CHANCE ? 'nibble-only' : 'nibble-to-bite';
    s.nibbleProgress = 0;
    s.nibbleRemaining = NIBBLE_DURATION;
    s.biteRemaining = 0;
    s.holding = false;
    this._transition('nibble', '찌가 살짝 움직여요. 깊이 잠길 때까지 기다려보세요.');
    this._emit('nibble', { kind: s.nibbleKind, duration: NIBBLE_DURATION, forced });
  }

  _selectedEquipment() {
    return Object.fromEntries(Object.keys(this._equipment).map((key) => [key, EQUIPMENT[key][this._equipment[key]]]));
  }

  _emit(type, details = {}) {
    this.onEvent({ type, phase: this.state.phase, ...details });
  }

  _transition(phase, message) {
    this.state.phase = phase;
    this.state.phaseElapsed = 0;
    this.state.message = message;
  }

  // Original subclasses may vary size weights; the shared/easy default stays60/30/10.
  _sizeWeightsFor(){return SIZE_CLASSES.map(f=>f.probability);}

  /** Returns false during an active cast. A terminal result can be recast directly. */
  cast({ speciesId, sizeId, environment = {}, tutorialOutcome = null } = {}) {
    if (!IDLE_PHASES.has(this.state.phase)) return false;
    // Explicit selectors are for deterministic QA; normal casts use environment
    // and independent size weights. Bait preferences multiply species odds without excluding any species.
    const requestedSpecies = speciesId === undefined ? null : [...FISH,...COASTAL_FISH].find(f => f.id === speciesId);
    const requestedSize = sizeId === undefined ? null : SIZE_CLASSES.find(f => f.id === sizeId);
    if (speciesId !== undefined && !requestedSpecies || sizeId !== undefined && !requestedSize) return false;
    this._initialize();
    this._castNumber += 1;
    const species = requestedSpecies || FISH[weightedIndex(this._random(), fishWeightsFor(environment).map((weight,i)=>weight*BAIT_SPECIES_PREFERENCES[this.state.bait.id][i]))];
    const size = requestedSize || SIZE_CLASSES[weightedIndex(this._random(), this._sizeWeightsFor(environment))];
    const sizeIndex = SIZE_CLASSES.indexOf(size), baseLength = species.sizes[sizeIndex];
    const length = Math.round(baseLength * (0.9 + this._random() * 0.2) * 10) / 10;
    const weight = Math.max(0.01, Math.round(length ** 3 * species.weightFactor * (0.9 + this._random() * 0.2) * 100) / 100);
    this.state.fish = { ...species, sizeId: size.id, sizeLabel: size.label,
      baseLength, length, weight, strength: species.strength * size.resistance,
      stamina: fishStaminaForLength(length),
      speed: species.speed / size.resistance, liftDuration: size.liftDuration,
      catchId: `${species.id}-${this._castNumber}`, environment: environment.isNight ? 'night' : environment.weather === 'rain' ? 'rainyDay' : 'day' };
    // Gear can shorten only the extra variation, never the full quiet interval.
    this._waitDuration = MIN_NIBBLE_WAIT + this._random() * 3 * this.state.equipment.float.waitMultiplier;
    this._tutorialOutcome=['theft','bite'].includes(tutorialOutcome)?tutorialOutcome:null;
    this._biteDuration = 2.5 + this.state.equipment.float.biteWindowBonus;
    this._transition('casting', '물살을 향해 낚싯줄을 던지는 중…');
    this._emit('cast');
    return true;
  }

  setReeling(reeling) {
    const holding = Boolean(reeling);
    if (this.state.phase === 'bite' && holding) return this.hook();
    if (this.state.phase !== 'fighting') {
      this.state.holding = false;
      return false;
    }
    this.state.holding = holding;
    return true;
  }

  hook() {
    if (this.state.phase !== 'bite') return false;
    this._transition('fighting', '물고기가 걸렸어요! 누르면 감고, 놓으면 장력이 내려가요.');
    this.state.holding = true;
    this.state.tension = 35;
    this.state.progress = 0;
    this.state.biteRemaining = 0;
    this.state.fightElapsed = 0;
    this.state.tensionCrossings = 0; this.state.tensionWarning = false;
    this._tensionArmed = true;
    this._nextSurge = 3.8 + this._random() * 0.8;
    this._emit('hook', { fish: { ...this.state.fish } });
    return true;
  }

  reset() {
    this._initialize();
    this._emit('reset');
    return true;
  }

  equip(category, index) {
    if (!IDLE_PHASES.has(this.state.phase) || !Object.hasOwn(EQUIPMENT, category)
      || !Number.isInteger(index) || index < 0 || index >= EQUIPMENT[category].length) return false;
    this._equipment[category] = index;
    this.state.equipment = this._selectedEquipment();
    this.state.equipmentIndices = { ...this._equipment };
    this._emit('equipment', { category, index, item: EQUIPMENT[category][index] });
    return true;
  }

  selectBait(index) {
    if (!IDLE_PHASES.has(this.state.phase) || !Number.isInteger(index) || index < 0 || index >= BAITS.length) return false;
    this._baitIndex = index;
    this.state.baitIndex = index;
    this.state.bait = BAITS[index];
    this._emit('bait', { index, bait: this.state.bait });
    return true;
  }

  _escape(reason, message) {
    this._transition('escaped', message);
    this.state.holding = false;
    this.state.surge = false;
    this.state.pull = false;
    this.state.escapeReason = reason;
    this.state.biteRemaining = 0;
    this._emit('escape', { reason, fish: this.state.fish ? { ...this.state.fish } : null });
  }

  _fight(dt) {
    const s = this.state;
    s.fightElapsed += dt;
    if (s.fightElapsed >= this._nextSurge) {
      this._surgeEnd = s.fightElapsed + 0.9 + this._random() * 0.3;
      this._nextSurge = s.fightElapsed + 5 + this._random() * 1.2;
      s.surge = true;
      s.pull = true;
      this._emit('surge', { fish: { ...s.fish } });
    }
    s.surge = s.fightElapsed < this._surgeEnd;
    s.pull = s.surge;
    const { rod, line } = s.equipment;
    const pull = s.surge ? 17 * s.fish.strength : 0;
    const rise = 18 * s.fish.strength * (1 - rod.control) / line.strength;
    const fall = 25 * line.recovery;
    s.tension = clamp(s.tension + ((s.holding ? rise : -fall) + pull / line.strength) * dt);
    // Keep the UI's 0–100 progress contract while draining real stamina units.
    // Release restores the same small number of units at every length; neither
    // tension, surge timing, equipment nor random draws depend on stamina.
    const stamina = Number.isFinite(s.fish.stamina) && s.fish.stamina > 0 ? s.fish.stamina : 100;
    const staminaScale = 100 / stamina;
    if (s.holding) {
      const efficiency = s.tension >= 18 && s.tension <= 82 ? 1 : s.tension < 18 ? 0.15 : 0.28;
      s.progress = clamp(s.progress + 11.6 * rod.power * s.fish.speed * efficiency * (s.surge ? 0.8 : 1) * staminaScale * dt);
    } else {
      s.progress = clamp(s.progress - (s.surge ? 1.9 : 1.1) * staminaScale * dt);
    }
    // Count separate entries, not frames spent above the threshold. The
    // lower re-arm boundary prevents 85% edge jitter from consuming attempts.
    s.tensionWarning = s.tension > TENSION_WARNING_THRESHOLD;
    if (s.tension <= TENSION_REARM_THRESHOLD) this._tensionArmed = true;
    if (s.tensionWarning && this._tensionArmed) {
      s.tensionCrossings += 1; this._tensionArmed = false;
    }
    s.dangerTime = 0;
    s.slackTime = s.tension < 8 ? s.slackTime + dt : 0;
    if (s.tension >= 100) {
      this._escape('line-broke', '장력이 100%에 도달해 낚싯줄이 끊어졌어요. 회수한 뒤 새 미끼를 달아 주세요.');
    } else if (s.tensionCrossings >= MAX_TENSION_CROSSINGS) {
      this._escape('tension-limit', '높은 장력에 세 번 진입해 물고기를 놓쳤어요. 회수한 뒤 새 미끼를 달아 주세요.');
    } else if (s.tension <= 0) {
      this._escape('zero-tension', '게이지가 0으로 내려가지 않도록 하세요.');
    } else if (s.progress >= 100) {
      this._transition('caught', `${s.fish.name} 잡았어요!`);
      s.holding = false;
      s.surge = false;
      s.pull = false;
      const fish = { ...s.fish };
      this._emit('catch', { fish, id: fish.id, catchId: fish.catchId, length: fish.length, weight: fish.weight });
    } else if (s.tensionWarning) {
      s.message = '장력이 85%를 넘었어요! 손을 놓아 장력을 낮춰 주세요.';
    } else if (s.tension < 18) {
      s.message = '낚싯줄이 느슨해요. 눌러서 감아주세요!';
    } else {
      s.message = s.surge ? '물고기가 힘을 쓰고 있어요. 장력을 살펴주세요!' : '좋아요! 누르기와 놓기로 장력을 조절하세요.';
    }
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || IDLE_PHASES.has(this.state.phase)) return this.snapshot();
    let remaining = Math.min(dt, MAX_DELTA);
    // Small integration steps keep gauges, danger windows and phase transitions
    // smooth at both high and low render frame rates.
    while (remaining > 1e-9 && !IDLE_PHASES.has(this.state.phase)) {
      const step = Math.min(remaining, 1 / 120);
      remaining -= step;
      const s = this.state;
      s.elapsed += step;
      s.phaseElapsed += step;
      if (s.phase === 'casting') {
        s.castProgress = clamp(s.phaseElapsed / 0.8, 0, 1);
        if (s.phaseElapsed + 1e-9 >= 0.8) {
          s.castProgress = 1;
          this._transition('waiting', '찌를 바라보며 입질을 기다려보세요.');
          this._emit('waiting');
        }
      } else if (s.phase === 'waiting') {
        if (s.phaseElapsed + 1e-9 >= this._waitDuration) {
          this._beginNibble();
        }
      } else if (s.phase === 'nibble') {
        s.nibbleProgress = clamp(s.phaseElapsed / NIBBLE_DURATION, 0, 1);
        s.nibbleRemaining = Math.max(0, NIBBLE_DURATION - s.phaseElapsed);
        if (s.phaseElapsed + 1e-9 >= NIBBLE_DURATION) {
          s.nibbleProgress = 1;
          s.nibbleRemaining = 0;
          // An independent outcome at the end of a completed nibble. It never
          // consumes species/fight or 40/60 nibble-pattern random draws.
          if (this._tutorialOutcome==='theft'||!this._tutorialOutcome&&this._baitTheftRandom() < BAIT_THEFT_CHANCE) {
            this._escape('bait-stolen', '물고기가 미끼만 먹고 갔어요. 회수한 뒤 새 미끼를 달아 주세요.');
          } else if (s.nibbleKind === 'nibble-only') {
            s.falseNibbleCount += 1;
            this._waitDuration = MIN_NIBBLE_WAIT + this._biteRandom();
            this._transition('waiting', '작은 건드림이었어요. 다시 입질을 기다려보세요.');
            this._emit('waiting', { afterNibble: true, duration: this._waitDuration });
          } else {
            s.falseNibbleCount = 0;
            this._transition('bite', '입질이에요! 지금 눌러서 물고기를 낚아채세요!');
            s.biteRemaining = this._biteDuration;
            this._emit('bite', { duration: this._biteDuration });
          }
        }
      } else if (s.phase === 'bite') {
        s.biteRemaining = Math.max(0, this._biteDuration - s.phaseElapsed);
        if (s.phaseElapsed + 1e-9 >= this._biteDuration) {
          this._escape('missed-bite', '입질을 놓쳤어요. 다시 던져볼까요?');
        }
      } else if (s.phase === 'fighting') {
        this._fight(step);
      }
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      ...this.state,
      fish: this.state.fish ? { ...this.state.fish } : null,
      equipment: { ...this.state.equipment },
      equipmentIndices: { ...this.state.equipmentIndices },
    };
  }

  getSnapshot() { return this.snapshot(); }
}
