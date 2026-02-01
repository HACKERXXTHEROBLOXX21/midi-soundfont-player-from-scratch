// Minimal SF2 parser: reads RIFF chunks, sample headers (shdr) and sample PCM (smpl).
// Supports optional .sf3 (zlib) decompression when pako is available as a global.

function readStr(view, pos, len) {
  let s = "";
  for (let i = 0; i < len; i++) {
    const ch = view.getUint8(pos + i);
    if (ch === 0) break;
    s += String.fromCharCode(ch);
  }
  return s;
}

function maybeDecompress(buffer) {
  // If pako is available globally (added via CDN in index.html), try to detect and decompress
  try {
    if (typeof pako !== "undefined" && buffer && buffer.byteLength > 2) {
      const u8 = new Uint8Array(buffer);
      // Heuristic: many compressed payloads start with 0x78 (zlib) or 0x1f 0x8b (gzip)
      if (u8[0] === 0x78 || (u8[0] === 0x1f && u8[1] === 0x8b)) {
        // Use pako to decompress to a Uint8Array and return its buffer
        const decomp = pako.inflate(u8);
        return decomp.buffer;
      }
    }
  } catch (err) {
    console.warn("SF3 decompression failed, continuing with original buffer", err);
  }
  return buffer;
}

export function parseSF2(inputBuffer) {
  // allow passing ArrayBuffer or Buffer-like; try to decompress first
  let buffer = inputBuffer;
  buffer = maybeDecompress(buffer);

  const view = new DataView(buffer);
  let pos = 0;

  function readChunkHeader() {
    if (pos + 8 > view.byteLength) return null;
    const id = String.fromCharCode(
      view.getUint8(pos),
      view.getUint8(pos + 1),
      view.getUint8(pos + 2),
      view.getUint8(pos + 3)
    );
    const size = view.getUint32(pos + 4, true);
    pos += 8;
    return { id, size, start: pos };
  }

  // Validate RIFF
  if (view.byteLength < 12) throw new Error('Buffer too small for SF2');
  const riff = readStr(view, 0, 4);
  if (riff !== 'RIFF') throw new Error('Not a RIFF file');

  const formType = readStr(view, 8, 4);
  if (formType !== 'sfbk') console.warn('SF2 form type is', formType);

  pos = 12; // after RIFF header

  const rawChunks = {};
  const sampleHeaders = [];
  let samplePool = null; // big Int16Array if smpl chunk contains all samples

  while (pos < view.byteLength) {
    const chunk = readChunkHeader();
    if (!chunk) break;
    const { id, size, start } = chunk;

    if (id === 'LIST') {
      const listType = readStr(view, pos, 4);
      pos += 4; // skip list type
      const listEnd = start + size;

      while (pos < listEnd) {
        const sub = readChunkHeader();
        if (!sub) break;
        const { id: sid, size: ssize, start: sstart } = sub;

        if (sid === 'shdr') {
          // sample header records (46 bytes each)
          const count = Math.floor(ssize / 46);
          let p = sstart;
          for (let i = 0; i < count; i++) {
            const name = readStr(view, p, 20);
            const dwStart = view.getUint32(p + 20, true);
            const dwEnd = view.getUint32(p + 24, true);
            const dwStartLoop = view.getUint32(p + 28, true);
            const dwEndLoop = view.getUint32(p + 32, true);
            const dwSampleRate = view.getUint32(p + 36, true);
            const byOriginalPitch = view.getUint8(p + 40);
            const chPitchCorrection = view.getInt8(p + 41);
            const wSampleLink = view.getUint16(p + 42, true);
            const sfSampleType = view.getUint16(p + 44, true);

            sampleHeaders.push({
              name,
              start: dwStart,
              end: dwEnd,
              startLoop: dwStartLoop,
              endLoop: dwEndLoop,
              sampleRate: dwSampleRate,
              originalPitch: byOriginalPitch,
              pitchCorrection: chPitchCorrection,
              sampleLink: wSampleLink,
              sampleType: sfSampleType
            });
            p += 46;
          }
        } else if (sid === 'smpl') {
          // raw PCM signed 16-bit little endian; usually one big chunk containing all samples
          samplePool = new Int16Array(buffer, sstart, ssize / 2);
        } else {
          // stash raw chunk location for later parsing (phdr/pbag/pgen/inst/ibag/igen etc.)
          rawChunks[sid] = { start: sstart, size: ssize };
        }

        pos = sstart + ssize;
        if (pos & 1) pos++; // align
      }
    } else {
      // top-level chunk
      if (id === 'shdr') {
        // top-level shdr (rare) - parse similar to above
      } else if (id === 'smpl') {
        samplePool = new Int16Array(buffer, start, size / 2);
      } else {
        rawChunks[id] = { start, size };
      }
      pos = start + size;
      if (pos & 1) pos++;
    }
  }

  // Convert sample ranges referenced by shdr into Float32 arrays
  const sampleData = sampleHeaders.map(sh => {
    if (!samplePool) return null;
    const len = sh.end - sh.start;
    if (len <= 0) return { header: sh, pcm: new Float32Array(0) };
    const pcm = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      pcm[i] = samplePool[sh.start + i] / 32768;
    }
    return { header: sh, pcm };
  });

  return {
    sampleHeaders,
    sampleData,
    rawChunks
    // Next step: parse phdr/pbag/pgen/inst/ibag/igen from rawChunks to build presets/instruments/zones
  };
}

export default { parseSF2 };