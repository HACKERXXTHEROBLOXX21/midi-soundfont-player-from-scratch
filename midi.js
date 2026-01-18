function parseMIDI(buffer) {
  const data = new Uint8Array(buffer);
  let notes = [];
  let time = 0;

  for (let i=0;i<data.length;i++) {
    if ((data[i] & 0xf0) === 0x90 && data[i+2] > 0) {
      notes.push({
        key: data[i+1],
        time: time,
        velocity: data[i+2]
      });
    }
    time += 0.05;
  }

  return {
    instrument: "General MIDI",
    notes
  };
}
