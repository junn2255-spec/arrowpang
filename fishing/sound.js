// User-authorized recordings, trimmed and leveled offline. See reports/audio-mapping.json.
// Bite/retrieval accents are synthesized. Approved recorded fight background replaces the old hold tone.
const RECORDINGS = Object.freeze({
  krillEquip: 'assets/audio/krill-equip.mp3',
  reelOut: 'assets/audio/reel-line-out.mp3',
  reelIn: 'assets/audio/reel-winding.mp3',
  cast: 'assets/audio/cast-swish.mp3',
  seaCast: 'assets/audio/sea-cast-whoosh.mp3',
  splash: 'assets/audio/float-splash.mp3',
  flop: 'assets/audio/fish-flop.mp3',
  reentry: 'assets/audio/fish-reentry.mp3',
  catch: 'assets/audio/catch-confirmation.mp3',
  fightMusic: 'assets/audio/fight-background-v12.mp3',
  applause: 'assets/audio/catch-applause-v13.mp3',
});
const RECORDED_CUES = Object.freeze({
  krillEquip: { file: 'krillEquip', group: 'bait', gain: .75, replace: true },
  swish: { file: 'seaCast', group: 'rod', gain: .85 },
  strike: { file: 'cast', group: 'rod', gain: .55 },
  splash: { file: 'splash', group: 'water', gain: .9 },
  resistance: { file: 'flop', group: 'fish', gain: .72, cooldown: .9 },
  jump: { file: 'flop', group: 'fish', gain: .72 },
  catchSplash: { file: 'flop', group: 'fish', gain: .8 },
  reentry: { file: 'reentry', group: 'fish', gain: .82, replace: true },
  catch: { file: 'catch', group: 'reward', gain: .66 },
  applause: { file: 'applause', group: 'applause', gain: .72 },
});
const SYNTHETIC_CUES = Object.freeze({ bite: [720, .12, .025], lift: [220, .2, .028], droplets: [680, .16, .018] });

export function createSound({ enabled: initialEnabled = false, requireGesture = false, haptics = true } = {}) {
  let ac = null, enabled = Boolean(initialEnabled), paused = false, ambient = null, loading = null, generation = 0;
  let unlocked = !requireGesture, lastHoldKey = null, lastTravelAt = -Infinity, lastHoldPulseAt = -Infinity, hapticActive = false, hapticKind = null;
  let lastResistanceAt = -Infinity, edgeFeedbackKey=null;
  // The observation camera owns one reusable media element; gameplay stays paused.
  let underwaterAudio = null, underwaterRequested = false, underwaterSuspended = false;
  let underwaterPlaying = false, underwaterGeneration = 0;
  // One reusable element per environmental layer. Day birds never leak into
  // rain or night; common water keeps its phase as the other layers change.
  const ambientLayers = new Map();
  const ambientFiles = {day:'assets/audio/seaside-ambience.mp3',water:'assets/audio/environment-v40/water.mp3',insects:'assets/audio/environment-v40/insects.mp3',frogs:'assets/audio/environment-v40/frogs.mp3',rain:'assets/audio/environment-v40/rain.mp3'};
  let ambientMix = environmentAudioMix(), ambientKey = 'day', ambientDuck = false;
  let hapticsEnabled=Boolean(haptics),liftFeedbackActive=false,lastLiftPulseAt=-Infinity,hapticResumeAt=-Infinity;
  const buffers = new Map(), active = new Map(), applauseEvents = new Set();
  function context() {
    try { ac ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)(); return ac; }
    catch { return null; }
  }
  function stop(track) {
    try { track.source.stop(); } catch {}
    try { track.source.disconnect(); } catch {}
    try { track.gain.disconnect(); } catch {}
  }
  function setReel(mode){
    const prior=active.get('reel');
    const file=mode==='out'?'reelOut':mode==='in'?'reelIn':null;
    if(!file||!enabled||!unlocked||paused||ac?.state!=='running'){if(prior){active.delete('reel');stop(prior);}return false;}
    if(prior?.file===file)return true;
    if(prior){active.delete('reel');stop(prior);}
    const buffer=buffers.get(file);if(!buffer)return false;
    try{const source=ac.createBufferSource(),gain=ac.createGain();source.buffer=buffer;source.loop=true;gain.gain.setValueAtTime(mode==='out'?.65:.5,ac.currentTime);source.connect(gain).connect(ac.destination);trackSource('reel',source,gain,file,'reel');source.start();return true;}catch{return false;}
  }
  function stopEffects() {
    const tracks = [...active.values()]; active.clear();
    for (const track of tracks) stop(track);
  }
  function stopReward(){let stopped=false;for(const group of ['applause','reward']){const track=active.get(group);if(track){active.delete(group);stop(track);stopped=true}}return stopped}
  function stopResistance() {
    const track = active.get('fish');
    if (track?.cue !== 'resistance') return false;
    active.delete('fish'); stop(track); return true;
  }
  function stopHaptics(movementOnly = false) {
    if (!hapticActive || movementOnly && !['travel','hold','lift','edge'].includes(hapticKind)) return false;
    hapticActive = false; hapticKind = null; vibrate('stop'); return true;
  }
  function vibration(kind) {
    if ((!enabled && kind!=='lift') || !hapticsEnabled || !unlocked || paused) return false;
    const played = vibrate(kind); if (played) { hapticActive = true; hapticKind = kind; } return played;
  }
  function stopLiftFeedback(elapsed=0) {
    if(!liftFeedbackActive)return false;
    liftFeedbackActive=false;lastLiftPulseAt=-Infinity;
    hapticResumeAt=Number.isFinite(elapsed)?elapsed+.25:-Infinity;
    if(hapticKind==='lift')stopHaptics();return true;
  }
  function setLiftFeedback(on,{elapsed=0,reducedMotion=false}={}) {
    // Edge pulling owns haptics until its timer ends; lift input cannot replace it.
    if(hapticKind==='edge'&&edgeFeedbackKey)return false;
    let systemReduced=false;try{systemReduced=!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches}catch{}
    if(!on||!hapticsEnabled||!unlocked||paused||reducedMotion||systemReduced||globalThis.navigator?.userActivation?.hasBeenActive===false){stopLiftFeedback(elapsed);return false}
    if(!liftFeedbackActive){stopHaptics(true);liftFeedbackActive=true;lastLiftPulseAt=-Infinity}
    if(Number.isFinite(elapsed)&&(elapsed<lastLiftPulseAt||elapsed-lastLiftPulseAt>=1)){
      lastLiftPulseAt=elapsed;return vibration('lift');
    }
    return false;
  }
  function setHaptics(on){hapticsEnabled=Boolean(on);if(!hapticsEnabled){edgeFeedbackKey=null;stopLiftFeedback();stopHaptics()}return hapticsEnabled}
  function stopTension(fade = false) {
    const track = active.get('tension'); if (!track) return false;
    if (fade && !track.fading && ac?.state === 'running') {
      track.fading = true;
      try {
        track.gain.gain.cancelScheduledValues(ac.currentTime);
        track.gain.gain.setValueAtTime(Math.min(.018, Math.max(.001, track.gain.gain.value || .012)), ac.currentTime);
        track.gain.gain.linearRampToValueAtTime(.0001, ac.currentTime + .09);
        track.source.stop(ac.currentTime + .10); return true;
      } catch {}
    } else if (fade && track.fading) return false;
    active.delete('tension'); stop(track); return true;
  }
  function stopFightMusic(){const track=active.get('fightMusic');if(track){active.delete('fightMusic');stop(track)}if(ambientDuck){ambientDuck=false;applyAmbientVolumes(0,true)}return !!track}
  function startFightMusic(){if(!enabled||!unlocked||paused||!ac||ac.state!=='running'||active.has('fightMusic'))return false;const buffer=buffers.get('fightMusic');if(!buffer)return false;stopTension();try{const source=ac.createBufferSource(),gain=ac.createGain();source.buffer=buffer;source.loop=true;gain.gain.setValueAtTime(.18,ac.currentTime);source.connect(gain).connect(ac.destination);trackSource('fightMusic',source,gain,'fightMusic','fightMusic');source.start();ambientDuck=true;applyAmbientVolumes(0,true);return true}catch{stopFightMusic();return false}}
  function stopFightFeedback() { edgeFeedbackKey=null; stopTension(); stopFightMusic(); stopLiftFeedback(); stopHaptics(true); hapticResumeAt=-Infinity; }
  function startTension(duration) {
    if (!enabled || !unlocked || paused || !ac || ac.state !== 'running') return false;
    stopTension();
    const length = Math.min(3, Math.max(.1, Number(duration) || 3)), now = ac.currentTime;
    try {
      const source = ac.createOscillator(), gain = ac.createGain();
      source.type = 'triangle'; source.frequency.setValueAtTime(112, now);
      source.frequency.exponentialRampToValueAtTime(166, now + length);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.linearRampToValueAtTime(.014, now + .08);
      for (let at = .35, pulse = 0; at < length - .12; at += .32, pulse++)
        gain.gain.linearRampToValueAtTime(pulse % 2 ? .017 : .009, now + at);
      gain.gain.linearRampToValueAtTime(.0001, now + length);
      source.connect(gain).connect(ac.destination);
      trackSource('tension', source, gain, 'taut-line', 'tension');
      source.start(); source.stop(now + length + .02); return true;
    } catch { stopTension(); return false; }
  }
  function updateFight({ edgeEventsOnly=false, edgeEntry=0, edgeRemaining=0, active: fighting = false, holding = false, holdId = null, catchId = '', phase = '', elapsed = 0, holdDuration = 3, reducedMotion = false, lifting = false } = {}) {
    if (!fighting) { stopFightFeedback(); return; }
    startFightMusic();
    if(edgeEventsOnly){
      stopLiftFeedback();
      let systemReduced=false;try{systemReduced=!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches}catch{}
      const allowed=enabled&&unlocked&&!paused&&hapticsEnabled&&!reducedMotion&&!systemReduced&&globalThis.navigator?.userActivation?.hasBeenActive!==false;
      if(!allowed||!(edgeRemaining>0)||!edgeEntry){if(hapticKind==='edge')stopHaptics();edgeFeedbackKey=null;return;}
      const key=`${catchId}:${edgeEntry}`;
      if(key!==edgeFeedbackKey){
        edgeFeedbackKey=key;
        if(vibrateDuration(edgeRemaining*1000)){hapticActive=true;hapticKind='edge';}
      }
      return;
    }
    setLiftFeedback(lifting,{elapsed,reducedMotion});
    if(liftFeedbackActive)return;
    if(elapsed<hapticResumeAt)return;
    if (holding) {
      if (hapticKind === 'travel') stopHaptics(true);
      const key = `${catchId}:${holdId}`;
      if (key !== lastHoldKey) { lastHoldKey = key; lastHoldPulseAt = -Infinity; stopTension(); }
      if (!enabled || !unlocked || paused || reducedMotion) { stopHaptics(true); return; }
      if (Number.isFinite(elapsed) && (elapsed < lastHoldPulseAt || elapsed - lastHoldPulseAt >= 1.2)) { lastHoldPulseAt = elapsed; vibration('hold'); }
      return;
    }
    stopTension(true);
    if (!['travel-left', 'travel-right'].includes(phase) || reducedMotion || !enabled || !unlocked || paused) { stopHaptics(true); return; }
    if (Number.isFinite(elapsed) && (elapsed < lastTravelAt || elapsed - lastTravelAt >= .75)) {
      lastTravelAt = elapsed; vibration('travel');
    }
  }
  function unlock(event) {
    if (unlocked) return Promise.resolve(true);
    if (event?.isTrusted !== true || !['pointerdown', 'keydown', 'click'].includes(event.type) || event.repeat) return Promise.resolve(false);
    unlocked = true; return set(enabled);
  }
  function trackSource(group, source, gain, file, cue) {
    const track = { source, gain, file, cue }; active.set(group, track);
    source.onended = () => {
      if (active.get(group) === track) active.delete(group);
      try { source.disconnect(); gain.disconnect(); } catch {}
    };
    return track;
  }
  function continuousFightBuffer(c, buffer) {
    if(typeof c.createBuffer!=='function'||typeof buffer.getChannelData!=='function'||buffer.duration<3)return buffer;
    // The recording includes a faded quiet outro. Loop its musical body and
    // blend the final 120 ms into the beginning, without another playing source.
    const rate=buffer.sampleRate,start=Math.floor(.12*rate),end=Math.floor((buffer.duration-1.2)*rate);
    const overlap=Math.floor(.12*rate),length=end-start-overlap;
    if(length<=overlap)return buffer;
    const loop=c.createBuffer(buffer.numberOfChannels,length,rate);
    for(let channel=0;channel<buffer.numberOfChannels;channel++){
      const input=buffer.getChannelData(channel),output=loop.getChannelData(channel);
      output.set(input.subarray(start+overlap,end));
      for(let i=0;i<overlap;i++){
        const at=length-overlap+i,blend=i/(overlap-1);
        output[at]=output[at]*(1-blend)+input[start+i+1]*blend;
      }
    }
    return loop;
  }
  function loadRecordings(c) {
    if (!c?.decodeAudioData || typeof globalThis.fetch !== 'function') return Promise.resolve(true);
    if (!loading) loading = Promise.all(Object.entries(RECORDINGS).map(async ([key, url]) => {
      if (buffers.has(key)) return;
      const response = await globalThis.fetch(url);
      if (!response.ok) throw new Error(`Audio asset unavailable: ${key}`);
      const buffer = await c.decodeAudioData(await response.arrayBuffer());
      if (!buffer?.duration) throw new Error(`Invalid audio asset: ${key}`);
      buffers.set(key, key==='fightMusic'?continuousFightBuffer(c,buffer):buffer);
    })).then(() => true, () => false).finally(() => { loading = null; });
    return loading;
  }
  function resumeContext(c) {
    try { return Promise.resolve(c?.resume?.()).then(() => true, () => false); }
    catch { return Promise.resolve(false); }
  }
  function suspendContext() {
    try { ac?.suspend?.()?.catch?.(() => {}); } catch {}
  }
  function ambientTarget(key) {
    if (!ambientDuck) return ambientMix[key] || 0;
    return key === 'day' ? (ambientMix.day ? .22 : 0) : (ambientMix[key] || 0) * .55;
  }
  function applyAmbientVolumes(dt = 0, instant = false) {
    for (const [key, layer] of ambientLayers) {
      const target = ambientTarget(key);
      // Forbidden species are silent immediately. Newly eligible layers and
      // rain-strength changes use short bounded ramps without stacked loops.
      if (!target) { layer.audio.volume = 0; if (layer.playing) { layer.playing = false; ++layer.generation; layer.audio.pause(); } continue; }
      if (!layer.playing) continue;
      const old = Number(layer.audio.volume) || 0;
      layer.audio.volume = instant ? target : old + Math.sign(target-old) * Math.min(Math.abs(target-old), Math.max(0,dt) / .65);
    }
  }
  function stopAmbient() {
    for (const layer of ambientLayers.values()) { ++layer.generation; layer.playing = false; layer.audio.pause(); }
  }
  function playAmbient({ fade = false } = {}) {
    if (!enabled || !unlocked || paused || underwaterRequested) return Promise.resolve(false);
    const results = [];
    for (const [key, file] of Object.entries(ambientFiles)) {
      if (!ambientMix[key]) continue;
      let layer = ambientLayers.get(key);
      if (layer?.playing) continue;
      try {
        if (!layer) {
          const audio = new Audio(file); audio.preload = 'auto'; audio.loop = true;
          layer = { audio, playing:false, generation:0 }; ambientLayers.set(key,layer);
          if (key === 'day') ambient = audio;
        }
        layer.audio.volume = fade ? 0 : ambientTarget(key);
        layer.playing = true; const token = ++layer.generation;
        results.push(Promise.resolve(layer.audio.play()).then(() => token === layer.generation, () => {
          if (token === layer.generation) { layer.playing = false; layer.audio.pause(); }
          return false;
        }));
      } catch { if (layer) layer.playing = false; results.push(Promise.resolve(false)); }
    }
    return Promise.all(results).then(values => values.every(Boolean));
  }
  function setEnvironment(environment = {}, dt = 0) {
    const next = environmentAudioMix(environment);
    const key = next.rain ? 'rain' : next.insects ? 'night' : 'day';
    const changed = key !== ambientKey;
    ambientKey = key; ambientMix = next;
    applyAmbientVolumes(dt);
    if (changed && enabled && unlocked && !paused && !underwaterRequested) void playAmbient({fade:true});
  }
  function stopUnderwaterAudio({ reset = false } = {}) {
    ++underwaterGeneration; underwaterPlaying = false;
    underwaterAudio?.pause();
    if (reset && underwaterAudio) try { underwaterAudio.currentTime = 0; } catch {}
  }
  function playUnderwaterAudio() {
    if (!enabled || !unlocked || !underwaterRequested || underwaterSuspended) return Promise.resolve(false);
    if (underwaterPlaying) return Promise.resolve(true);
    const token = ++underwaterGeneration;
    try {
      underwaterAudio ??= new Audio('assets/audio/underwater-ambience-v38.mp3');
      underwaterAudio.preload = 'auto'; underwaterAudio.loop = true; underwaterAudio.volume = .85;
      underwaterPlaying = true;
      return Promise.resolve(underwaterAudio.play()).then(() => token === underwaterGeneration, () => {
        if (token === underwaterGeneration) underwaterPlaying = false;
        return false;
      });
    } catch { underwaterPlaying = false; return Promise.resolve(false); }
  }
  function setUnderwater(on) {
    underwaterRequested = Boolean(on);
    if (!underwaterRequested) { underwaterSuspended = false; stopUnderwaterAudio({reset:true}); return Promise.resolve(true); }
    underwaterSuspended = false; stopAmbient();
    return playUnderwaterAudio();
  }
  function resumeUnderwater() {
    if (!underwaterRequested) return Promise.resolve(false);
    underwaterSuspended = false;
    return playUnderwaterAudio();
  }
  async function set(on) {
    enabled = Boolean(on); const token = ++generation;
    if (!enabled) { edgeFeedbackKey=null; stopAmbient(); stopUnderwaterAudio(); stopEffects(); if(hapticKind!=='lift')stopHaptics(); suspendContext(); return true; }
    if (underwaterRequested && !underwaterSuspended) {
      if (!unlocked) return true;
      return playUnderwaterAudio();
    }
    if (paused || !unlocked) return true;
    // Both resume and play are invoked directly inside the sound-button gesture.
    // Decode may finish later; old gameplay events are deliberately never queued.
    const c = context(), resumed = resumeContext(c), playing = playAmbient();
    const results = await Promise.all([resumed, playing, loadRecordings(c)]);
    if (token !== generation || !enabled || paused) return null;
    return results.every(Boolean);
  }
  function cue(name, eventId) {
    // A reward event is consumed even when muted, paused, or still decoding.
    // Async readiness/resume never queues or replays a past catch.
    if(name==='applause'){
      if((typeof eventId!=='string'&&typeof eventId!=='number')||String(eventId)==='')return false;
      const key=String(eventId);if(applauseEvents.has(key))return false;applauseEvents.add(key);
      if(applauseEvents.size>128)applauseEvents.delete(applauseEvents.values().next().value);
    }
    if (!enabled || !unlocked || paused) return false;
    const spec = RECORDED_CUES[name], synth = SYNTHETIC_CUES[name];
    // back/spring/flight/ripple/land and the old ambiguous hook alias are silent.
    if (!spec && !synth) return false;
    const c = context(); if (!c || c.state === 'suspended' || c.state === 'closed') return false;
    // Retrieval and landing end underwater pulling immediately, even when
    // their own recording is still decoding. No missed event is queued.
    if(name==='lift')stopReward();
    if (name === 'lift' || name === 'catchSplash' || name === 'catch' || name === 'applause') { stopResistance(); stopFightFeedback(); }
    if (spec) {
      const buffer = buffers.get(spec.file); if (!buffer) return false;
      // One short real-recording pulse per resistance event, never a loop.
      // AudioContext time also freezes on pause; resume cannot bypass this gap.
      if (name === 'resistance' && c.currentTime - lastResistanceAt < spec.cooldown) return false;
      const prior = active.get(spec.group);
      if (prior) {
        if (!spec.replace || prior.file === spec.file) return false;
        active.delete(spec.group); stop(prior);
      }
      if (name === 'catch') stopEffects();
      try {
        const source = c.createBufferSource(), gain = c.createGain();
        source.buffer = buffer; gain.gain.setValueAtTime(spec.gain, c.currentTime);
        source.connect(gain).connect(c.destination);
        trackSource(spec.group, source, gain, spec.file, name); source.start();
        if (name === 'resistance') lastResistanceAt = c.currentTime;
        return true;
      } catch {
        const failed = active.get(spec.group);
        if (failed) { active.delete(spec.group); stop(failed); }
        return false;
      }
    }
    const group = `synth:${name}`; if (active.has(group)) return false;
    try {
      const [frequency, duration, volume] = synth, source = c.createOscillator(), gain = c.createGain();
      source.type = 'sine'; source.frequency.setValueAtTime(frequency, c.currentTime);
      source.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * .35), c.currentTime + duration);
      gain.gain.setValueAtTime(volume, c.currentTime); gain.gain.exponentialRampToValueAtTime(.001, c.currentTime + duration);
      source.connect(gain).connect(c.destination); trackSource(group, source, gain, name);
      source.start(); source.stop(c.currentTime + duration); return true;
    } catch {
      const failed = active.get(group);
      if (failed) { active.delete(group); stop(failed); }
      return false;
    }
  }
  return {
    setReel, set, setEnvironment, setUnderwater, resumeUnderwater, cue, stopReward, stopResistance, unlock, updateFight, stopFightFeedback, vibration, setLiftFeedback, stopLiftFeedback, setHaptics,
    get enabled() { return enabled; }, get unlocked() { return unlocked; },
    pause() { edgeFeedbackKey=null; paused = true; ++generation; underwaterSuspended = true; stopUnderwaterAudio(); stopAmbient(); stopEffects(); stopLiftFeedback(); stopHaptics(); suspendContext(); },
    resume() {
      if (!paused) return;
      paused = false; ++generation;
      if (underwaterRequested) { resumeUnderwater(); return; }
      if (enabled && unlocked) { resumeContext(context()); playAmbient(); loadRecordings(ac); }
    },
  };
}

/** Exact ecological mix. A rainy night uses the same four tracks as rainy day. */
export function environmentAudioMix(environment = {}) {
  const raining = environment.weather === 'rain' || ['light','medium','heavy'].includes(environment.rainLevel);
  const nocturnal = raining || Boolean(environment.isNight);
  const rain = Math.max(0, Math.min(1, Number(environment.rainIntensity) || 0));
  return { day: .32, water: 0,
    insects: 0, frogs: 0,
    rain: raining ? .22 + .14 * rain : 0 };
}

export function vibrate(kind){try{if(typeof globalThis.navigator?.vibrate==='function')return globalThis.navigator.vibrate(kind==='stop'?0:kind==='edge'?[35,30,60]:kind==='lift'?[45,35,65]:kind==='travel'?[35,25,45]:kind==='hold'?[45,40,60]:kind==='impact'?[12,28,22]:kind==='cast'?8:kind==='retrieve'?6:kind==='hook'?[16,35,10]:kind==='reentry'?8:kind==='catch'?[15,45,18]:12)!==false}catch{}return false}

// One bounded hardware request per edge entry; cancellation uses vibrate(0).
export function vibrateDuration(milliseconds){try{if(typeof globalThis.navigator?.vibrate==='function')return globalThis.navigator.vibrate(Math.max(0,Math.min(3000,Math.round(milliseconds))))!==false}catch{}return false}
