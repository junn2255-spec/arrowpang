/**
 * Pure game clock and independent weather simulation. All time advances only
 * through update(dt), in real seconds. The host owns pause/background policy,
 * date formatting, rendering and persistence; this module has no wall clock,
 * timers, DOM or storage access.
 */
export const GAME_DAY_REAL_SECONDS = 14 * 60;
export const GAME_MINUTES_PER_DAY = 24 * 60;
export const GAME_MINUTES_PER_REAL_SECOND = GAME_MINUTES_PER_DAY / GAME_DAY_REAL_SECONDS;
export const START_HOUR = 10;
export const START_MINUTE = 24;
export const WEATHER_INTERVAL_GAME_HOURS = 3;
export const WEATHER_TRANSITION_REAL_SECONDS = 4;
export const NIGHT_START_HOUR = 19;
export const NIGHT_END_HOUR = 5;
export const DAWN_START_HOUR = 4;
export const DUSK_TRANSITION_GAME_HOURS = 0.5;
export const RAIN_LEVEL_WEIGHTS = Object.freeze({ light: 20, medium: 12, heavy: 3 });
export const RAIN_INTENSITIES = Object.freeze({ none: 0, light: 0.28, medium: 0.6, heavy: 1 });
export const WEATHER_PROBABILITIES = Object.freeze({
  clear: 0.7,
  rain: 0.3,
  light: 0.3 * 20 / 35,
  medium: 0.3 * 12 / 35,
  heavy: 0.3 * 3 / 35,
});
export const ENVIRONMENT_CONFIG = Object.freeze({
  realSecondsPerDay: GAME_DAY_REAL_SECONDS,
  startHour: START_HOUR,
  startMinute: START_MINUTE,
  weatherIntervalHours: WEATHER_INTERVAL_GAME_HOURS,
  weatherTransitionSeconds: WEATHER_TRANSITION_REAL_SECONDS,
});

const clamp01 = value => Math.max(0, Math.min(1, value));
const smoothstep = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const validLevel = level => typeof level === 'string' && own(RAIN_INTENSITIES, level);
const EPSILON = 1e-9;

/** A single independent roll gives exactly 70% clear, then 20:12:3 rain. */
export function weatherForRoll(value) {
  const roll = finite(value) ? Math.max(0, Math.min(1 - Number.EPSILON, value)) : 0.5;
  if (roll < WEATHER_PROBABILITIES.clear) return 'none';
  if (roll < WEATHER_PROBABILITIES.clear + WEATHER_PROBABILITIES.light) return 'light';
  if (roll < WEATHER_PROBABILITIES.clear + WEATHER_PROBABILITIES.light + WEATHER_PROBABILITIES.medium) return 'medium';
  return 'heavy';
}

/**
 * saveState() is JSON-safe. Pass it back as savedState without rerolling weather.
 * Weather intervals are elapsed game time, independent of calendar time and
 * debug setTime(). Pass the same configuration when restoring a custom clock.
 */
export class FishingEnvironment {
  constructor({
    rng = Math.random, savedState = null,
    startHour = START_HOUR, startMinute = START_MINUTE,
    realSecondsPerDay = GAME_DAY_REAL_SECONDS,
    weatherIntervalHours = WEATHER_INTERVAL_GAME_HOURS,
    weatherTransitionSeconds = WEATHER_TRANSITION_REAL_SECONDS,
  } = {}) {
    if (typeof rng !== 'function') throw new TypeError('rng must be a function');
    if (!finite(realSecondsPerDay) || realSecondsPerDay <= 0) throw new RangeError('realSecondsPerDay must be positive');
    if (!finite(weatherIntervalHours) || weatherIntervalHours <= 0) throw new RangeError('weatherIntervalHours must be positive');
    if (!finite(weatherTransitionSeconds) || weatherTransitionSeconds < 0) throw new RangeError('weatherTransitionSeconds must be nonnegative');
    this.rng = rng;
    this.minutesPerSecond = GAME_MINUTES_PER_DAY / realSecondsPerDay;
    this.weatherIntervalMinutes = weatherIntervalHours * 60;
    this.weatherTransitionSeconds = weatherTransitionSeconds;
    if (!finite(this.minutesPerSecond) || !finite(this.weatherIntervalMinutes)) throw new RangeError('clock configuration is out of range');
    this._totalMinutes = 0;
    this.setTime(startHour, startMinute, 0);
    this._weatherAgeMinutes = 0;
    this._rainLevel = 'none';
    this._rainFrom = 0;
    this._rainIntensity = 0;
    this._transitionAge = weatherTransitionSeconds;
    if (!this._restore(savedState)) {
      this._rainLevel = weatherForRoll(this.rng());
      this._rainIntensity = RAIN_INTENSITIES[this._rainLevel];
      this._rainFrom = this._rainIntensity;
    }
  }

  _restore(saved) {
    if (!saved || typeof saved !== 'object' || saved.version !== 1
      || !finite(saved.totalGameMinutes) || saved.totalGameMinutes < 0
      || saved.totalGameMinutes > Number.MAX_SAFE_INTEGER
      || !validLevel(saved.rainLevel)
      || !finite(saved.weatherAgeMinutes) || saved.weatherAgeMinutes < 0
      || saved.weatherAgeMinutes >= this.weatherIntervalMinutes
      || !finite(saved.rainFrom) || saved.rainFrom < 0 || saved.rainFrom > 1
      || !finite(saved.transitionAge) || saved.transitionAge < 0) return false;
    this._totalMinutes = saved.totalGameMinutes;
    this._rainLevel = saved.rainLevel;
    this._weatherAgeMinutes = saved.weatherAgeMinutes;
    this._rainFrom = saved.rainFrom;
    this._transitionAge = Math.min(saved.transitionAge, this.weatherTransitionSeconds);
    this._updateRain(0);
    return true;
  }

  _updateRain(dt) {
    this._transitionAge = Math.min(this.weatherTransitionSeconds, this._transitionAge + dt);
    const progress = this.weatherTransitionSeconds === 0 ? 1 : this._transitionAge / this.weatherTransitionSeconds;
    this._rainIntensity = this._rainFrom + (RAIN_INTENSITIES[this._rainLevel] - this._rainFrom) * smoothstep(progress);
  }

  _chooseWeather() {
    this._rainFrom = this._rainIntensity;
    this._rainLevel = weatherForRoll(this.rng());
    this._transitionAge = 0;
    this._updateRain(0);
  }

  /** Invalid/negative dt is ignored rather than poisoning a running game. */
  update(dt) {
    if (!finite(dt) || dt <= 0) return this.snapshot();
    const advanceMinutes = dt * this.minutesPerSecond;
    if (!finite(advanceMinutes) || this._totalMinutes + advanceMinutes > Number.MAX_SAFE_INTEGER) return this.snapshot();
    let remaining = dt;
    // Split at every decision boundary so a long frame and small frames consume
    // the same weather rolls and produce the same continuous rain intensity.
    while (remaining > 0) {
      const toBoundary = (this.weatherIntervalMinutes - this._weatherAgeMinutes) / this.minutesPerSecond;
      const step = Math.min(remaining, toBoundary);
      this._updateRain(step);
      this._weatherAgeMinutes += step * this.minutesPerSecond;
      remaining = Math.max(0, remaining - step);
      if (this._weatherAgeMinutes >= this.weatherIntervalMinutes - EPSILON) {
        this._weatherAgeMinutes = 0;
        this._chooseWeather();
      }
    }
    this._totalMinutes += advanceMinutes;
    return this.snapshot();
  }

  /** Set calendar time only; changing lighting never rerolls the weather. */
  setTime(hour, minute = 0, day = Math.floor(this._totalMinutes / GAME_MINUTES_PER_DAY)) {
    if (hour && typeof hour === 'object') {
      const time = hour;
      hour = time.hour;
      minute = time.minute ?? 0;
      day = time.day ?? time.dayIndex ?? day;
    }
    if (!finite(hour) || hour < 0 || hour >= 24 || !finite(minute) || minute < 0 || minute >= 60
      || !Number.isSafeInteger(day) || day < 0) throw new RangeError('time must have hour 0–23, minute 0–59 and a nonnegative integer day');
    const total = day * GAME_MINUTES_PER_DAY + hour * 60 + minute;
    if (total > Number.MAX_SAFE_INTEGER) throw new RangeError('time is out of range');
    this._totalMinutes = total;
    return this.snapshot();
  }

  /** Debug override lasts until the next scheduled decision; no RNG consumed. */
  setWeather(weather, { immediate = false } = {}) {
    const level = weather === 'clear' ? 'none' : weather === 'rain' ? 'light' : weather;
    if (!validLevel(level)) throw new RangeError('weather must be clear, rain, light, medium or heavy');
    this._rainFrom = this._rainIntensity;
    this._rainLevel = level;
    this._transitionAge = immediate ? this.weatherTransitionSeconds : 0;
    this._updateRain(0);
    return this.snapshot();
  }

  snapshot() {
    const total = this._totalMinutes;
    // Tiny accumulated floating-point errors must not show 04:59 at exact 05:00.
    const wholeMinutes = Math.floor(total + EPSILON);
    const minuteOfDay = wholeMinutes % GAME_MINUTES_PER_DAY;
    const day = Math.floor(wholeMinutes / GAME_MINUTES_PER_DAY);
    const rawMinuteOfDay = total - Math.floor(total / GAME_MINUTES_PER_DAY) * GAME_MINUTES_PER_DAY;
    const timeHours = rawMinuteOfDay / 60;
    const dawnProgress = clamp01((timeHours - DAWN_START_HOUR) / (NIGHT_END_HOUR - DAWN_START_HOUR));
    const isNight = minuteOfDay >= NIGHT_START_HOUR * 60 || minuteOfDay < NIGHT_END_HOUR * 60;
    let nightAmount = 0;
    if (timeHours < DAWN_START_HOUR) nightAmount = 1;
    else if (timeHours < NIGHT_END_HOUR) nightAmount = 1 - smoothstep(dawnProgress);
    else if (timeHours >= NIGHT_START_HOUR) nightAmount = smoothstep((timeHours - NIGHT_START_HOUR) / DUSK_TRANSITION_GAME_HOURS);
    return {
      day, dayIndex: day,
      hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60,
      timeHours, totalGameMinutes: total,
      isNight, dawnProgress, nightAmount,
      weather: this._rainLevel === 'none' ? 'clear' : 'rain',
      rainLevel: this._rainLevel,
      rainIntensity: this._rainIntensity,
      rainStrength: this._rainIntensity,
      targetRainIntensity: RAIN_INTENSITIES[this._rainLevel],
      weatherAgeMinutes: this._weatherAgeMinutes,
    };
  }

  saveState() {
    return {
      version: 1,
      totalGameMinutes: this._totalMinutes,
      rainLevel: this._rainLevel,
      weatherAgeMinutes: this._weatherAgeMinutes,
      rainFrom: this._rainFrom,
      transitionAge: this._transitionAge,
    };
  }
}
