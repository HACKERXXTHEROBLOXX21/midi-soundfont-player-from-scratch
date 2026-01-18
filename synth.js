class Synth {
  constructor(ctx, analyser) {
    this.ctx = ctx;
    this.analyser = analyser;
    this.output = ctx.createGain();
    this.output.connect(analyser);
    analyser.connect(ctx.destination);
    this.buffers = {};
    this.isPlaying = false;
  }

  loadSF2(arrayBuffer) {
    this.buffers = parseSF2(arrayBuffer);
  }

  play(midi, loop=false) {
    if (!midi || !this.buffers) return;
    this.isPlaying = true;
    midi.notes.forEach(note => {
      const buf = this.buffers[note.key];
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.output);
      src.start(this.ctx.currentTime + note.time);
    });
  }

  pause() {
    this.ctx.suspend();
  }

  stop() {
    this.ctx.resume();
    this.isPlaying = false;
  }
}
