export function parseSF2(buffer) {
  const view = new DataView(buffer);
  let pos = 12;

  const samples = [];
  const zones = [];

  while (pos < buffer.byteLength) {
    const id = String.fromCharCode(
      view.getUint8(pos),
      view.getUint8(pos+1),
      view.getUint8(pos+2),
      view.getUint8(pos+3)
    );
    const size = view.getUint32(pos+4, true);
    pos += 8;

    if (id === "smpl") {
      const pcm = new Int16Array(buffer, pos, size/2);
      samples.push(pcm);
    }

    if (id === "pgen") {
      // simplified generator parsing
      zones.push({
        keyMin: 0,
        keyMax: 127,
        rootKey: 60
      });
    }

    pos += size;
  }

  return { samples, zones };
}
