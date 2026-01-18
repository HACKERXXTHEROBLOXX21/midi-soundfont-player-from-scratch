export class ADSR {
  constructor(ctx, {a=0.01,d=0.1,s=0.7,r=0.2} = {}) {
    this.ctx = ctx;
    this.a = a;
    this.d = d;
    this.s = s;
    this.r = r;
  }

  apply(gainNode, startTime, velocity) {
    const g = gainNode.gain;
    g.cancelScheduledValues(startTime);
    g.setValueAtTime(0, startTime);
    g.linearRampToValueAtTime(velocity, startTime + this.a);
    g.linearRampToValueAtTime(
      velocity * this.s,
      startTime + this.a + this.d
    );
  }

  release
