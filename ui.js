import { parseSF2 } from "./sf2.js";
import { parseMIDI } from "./midi.js";
import AdvancedFluidSynth from "./engine.js";

const synth = new AdvancedFluidSynth();
let midiEvents = null;

const sf2El = document.getElementById("sf2");
const midiEl = document.getElementById("midi");
const playBtn = document.getElementById("play");
const pauseBtn = document.getElementById("pause");

let hasSF2 = false;
let hasMIDI = false;

function updateControls() {
  playBtn.disabled = !(hasSF2 && hasMIDI);
  pauseBtn.disabled = !hasSF2;
}

sf2El.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  await synth.loadSF2(parseSF2(buf));
  hasSF2 = true;
  updateControls();
});

midiEl.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  midiEvents = parseMIDI(await file.arrayBuffer());
  hasMIDI = true;
  updateControls();
});

playBtn.addEventListener("click", async () => {
  try {
    await synth.ctx.resume();
  } catch (e) { console.warn('AudioContext resume failed', e); }
  synth.play(midiEvents);
});

pauseBtn.addEventListener("click", () => {
  // simple stop: stop all voices and clear them
  synth.voices.forEach(v => { try { v.src.stop(); } catch(e){} });
  synth.voices.length = 0;
});
