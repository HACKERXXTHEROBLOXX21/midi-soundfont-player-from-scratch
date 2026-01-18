import { parseSF2 } from "./sf2.js";
import { parseMIDI } from "./midi.js";
import { AdvancedFluidSynth } from "./engine.js";

const synth = new AdvancedFluidSynth();
let midiEvents;

sf2.onchange = async e => {
  const buf = await e.target.files[0].arrayBuffer();
  synth.loadSF2(parseSF2(buf));
};

midi.onchange = async e => {
  midiEvents = parseMIDI(await e.target.files[0].arrayBuffer());
};

play.onclick = async () => {
  await synth.ctx.resume();
  synth.play(midiEvents);
};
