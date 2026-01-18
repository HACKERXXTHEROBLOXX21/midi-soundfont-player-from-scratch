export function parseMIDI(buffer) {
  const data = new Uint8Array(buffer);
  let time = 0;
  const events = [];

  for (let i = 0; i < data.length; i++) {
    if ((data[i] & 0xf0) === 0x90 && data[i+2] > 0) {
      events.push({
        type: "noteOn",
        key: data[i+1],
        vel: data[i+2]/127,
        time
      });
    }

    if ((data[i] & 0xf0) === 0x80) {
      events.push({
        type: "noteOff",
        key: data[i+1],
        time
      });
    }

    time += 0.02;
  }

  return events;
}
