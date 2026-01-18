import { ADSR } from "./envelope.js";

export class AdvancedFluidSynth {
  constructor() {
    this.ctx = new AudioContext();
    this.voices = [];
    this.maxVoices = 32;
    this.adsr = new ADSR(this.ctx);
  }

  loadSF2(sf2) {
    this.sf2 = sf2;
    this.audioBuffer = this.ctx.createBuffer(
      1,
      sf2.samples[0].length,
      44100
    );

    const ch = this.audioBuffer.getChannelData(0);
    sf2.samples[0].forEach((v,i)=> ch[i]=v/32768);
  }

  noteOn(key, velocity, time) {
    if (this.voices.length >= this.maxVoices) {
      this.voices.shift().stop();
    }

    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.value = 8000;

    src.buffer = this.audioBuffer;
    src.playbackRate.value = Math.pow(2, (key-60)/12);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    this.adsr.apply(gain, time, velocity);
    src.start(time);

    this.voices.push({ src, gain, stop:()=>src.stop() });
  }

  play(events) {
    const base = this.ctx.currentTime + 0.1;
    events.forEach(e => {
      if (e.type === "noteOn")
        this.noteOn(e.key, e.vel, base + e.time);
    });
  }
}
