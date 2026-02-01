import { ADSR } from "./envelope.js";

export class AdvancedFluidSynth {
  constructor({ maxVoices = 64 } = {}) {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.voices = [];
    this.maxVoices = maxVoices;
    this.adsr = new ADSR(this.ctx);
    this.sampleBuffers = []; // AudioBuffers per sample
    this.presets = []; // Will hold presets -> zones -> sample mapping when implemented
    this.channelPrograms = new Array(16).fill(0); // MIDI channel program per channel
  }

  async loadSF2(sf2) {
    this.sf2 = sf2;
    // create AudioBuffer per sampleData entry
    this.sampleBuffers = [];

    if (!sf2 || !sf2.sampleData) {
      console.warn('loadSF2: no sampleData found in SF2 object');
      return;
    }

    for (let i = 0; i < sf2.sampleData.length; i++) {
      const s = sf2.sampleData[i];
      if (!s || !s.pcm) {
        this.sampleBuffers.push(null);
        continue;
      }
      const sr = s.header && s.header.sampleRate ? s.header.sampleRate : 44100;
      // currently only mono samples are handled here; stereo support can be added by examining sampleType
      const buffer = this.ctx.createBuffer(1, s.pcm.length, sr);
      buffer.getChannelData(0).set(s.pcm);
      this.sampleBuffers.push({ buffer, header: s.header });
    }

    // Basic mapping: if no preset parsing implemented yet, map preset 0 to first sample
    if (!this.presets || this.presets.length === 0) {
      this.presets = [{ presetName: 'default', presetId: 0, zones: [] }];
      if (this.sampleBuffers.length > 0) {
        this.presets[0].zones.push({
          keyMin: 0,
          keyMax: 127,
          velMin: 0,
          velMax: 127,
          sampleIndex: 0,
          rootKey: (this.sampleBuffers[0].header && this.sampleBuffers[0].header.originalPitch) || 60,
          loopStart: (this.sampleBuffers[0].header && this.sampleBuffers[0].header.startLoop) || 0,
          loopEnd: (this.sampleBuffers[0].header && this.sampleBuffers[0].header.endLoop) || 0,
          sampleRate: (this.sampleBuffers[0].header && this.sampleBuffers[0].header.sampleRate) || 44100
        });
      }
    }
  }

  // helper to find preset for channel (respecting program changes)
  getPresetForChannel(channel) {
    const program = this.channelPrograms[channel] || 0;
    // simple lookup
    const preset = this.presets.find(p => p.presetId === program) || this.presets[0];
    return preset;
  }

  noteOn(channel, key, velocity, time) {
    const preset = this.getPresetForChannel(channel);
    // find a zone matching key and velocity
    let zone = null;
    for (const z of (preset.zones || [])) {
      if (key >= z.keyMin && key <= z.keyMax && velocity >= (z.velMin || 0) && velocity <= (z.velMax || 127)) {
        zone = z;
        break;
      }
    }
    // fallback to first zone
    if (!zone && preset.zones && preset.zones.length) zone = preset.zones[0];

    if (!zone) {
      console.warn('No zone found for note', key, 'on channel', channel);
      return;
    }

    const sampleMeta = this.sampleBuffers[zone.sampleIndex];
    if (!sampleMeta || !sampleMeta.buffer) {
      console.warn('Sample buffer missing for index', zone.sampleIndex);
      return;
    }

    if (this.voices.length >= this.maxVoices) {
      const v = this.voices.shift();
      try { v.src.stop(); } catch (e) {}
    }

    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.value = 18000;

    src.buffer = sampleMeta.buffer;

    // compute playbackRate from rootKey
    const root = zone.rootKey || 60;
    const cents = (key - root) * 100; // coarse; ignore fine tune for now
    src.playbackRate.value = Math.pow(2, cents / 1200);

    // loop handling
    if (zone.loopEnd > zone.loopStart) {
      src.loop = true;
      const sRate = zone.sampleRate || sampleMeta.header.sampleRate || sampleMeta.buffer.sampleRate || 44100;
      src.loopStart = zone.loopStart / sRate;
      src.loopEnd = zone.loopEnd / sRate;
    }

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    this.adsr.apply(gain, time, velocity);
    src.start(time);

    const voice = { src, gain, channel, key, stop: () => { try { src.stop(); } catch (e) {} } };
    this.voices.push(voice);
  }

  noteOff(channel, key, time) {
    // find matching voice(s)
    for (let i = this.voices.length - 1; i >= 0; i--) {
      const v = this.voices[i];
      if (v.channel === channel && v.key === key) {
        // release envelope if ADSR has release implemented
        try {
          this.adsr.release && this.adsr.release(v.gain, time);
        } catch (e) {}
        // schedule stop slightly after release
        try { v.src.stop(time + 0.1); } catch (e) {}
        this.voices.splice(i, 1);
      }
    }
  }

  // Play now accepts an array of events: {type, channel, key, vel, time}
  play(events) {
    const base = this.ctx.currentTime + 0.05;
    for (const e of events) {
      const t = base + (e.time || 0);
      if (e.type === 'noteOn') this.noteOn(e.channel || 0, e.key, e.vel != null ? e.vel : e.velocity || 1, t);
      else if (e.type === 'noteOff') this.noteOff(e.channel || 0, e.key, t);
      else if (e.type === 'programChange') {
        if (typeof e.program === 'number') this.channelPrograms[e.channel || 0] = e.program;
      }
    }
  }
}

export default AdvancedFluidSynth;