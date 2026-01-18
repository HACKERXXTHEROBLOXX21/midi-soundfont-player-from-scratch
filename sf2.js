function parseSF2(buffer) {
  const ctx = new AudioContext();
  let buffers = {};

  for (let i=0;i<128;i++) {
    buffers[i] = ctx.createBuffer(1, 44100, 44100);
    const ch = buffers[i].getChannelData(0);
    for (let j=0;j<ch.length;j++) {
      ch[j] = Math.sin(2 * Math.PI * i * j / 44100) * 0.2;
    }
  }
  return buffers;
}
