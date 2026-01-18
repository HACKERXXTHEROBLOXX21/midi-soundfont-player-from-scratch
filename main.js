const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;

let synth = new Synth(audioCtx, analyser);
let midiData = null;
let looping = false;

document.getElementById("sf2").onchange = e =>
  loadSF2(e.target.files[0]);

document.getElementById("midi").onchange = e =>
  loadMIDI(e.target.files[0]);

document.getElementById("play").onclick = () => synth.play(midiData, looping);
document.getElementById("pause").onclick = () => synth.pause();
document.getElementById("stop").onclick = () => synth.stop();

document.getElementById("loop").onclick = e => {
  looping = !looping;
  e.target.textContent = `Loop: ${looping ? "On" : "Off"}`;
};

function loadSF2(file) {
  const reader = new FileReader();
  reader.onload = () => {
    synth.loadSF2(reader.result);
  };
  reader.readAsArrayBuffer(file);
}

function loadMIDI(file) {
  const reader = new FileReader();
  reader.onload = () => {
    midiData = parseMIDI(reader.result);
    document.getElementById("instrument").textContent =
      "Instrument: " + midiData.instrument;
  };
  reader.readAsArrayBuffer(file);
}

drawScope();
function drawScope() {
  requestAnimationFrame(drawScope);
  const canvas = document.getElementById("scope");
  const ctx = canvas.getContext("2d");
  const data = new Uint8Array(analyser.fftSize);

  analyser.getByteTimeDomainData(data);
  ctx.fillStyle = "#000";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.strokeStyle = "#0f0";
  ctx.beginPath();
  data.forEach((v,i)=>{
    const x = i / data.length * canvas.width;
    const y = (v/255) * canvas.height;
    ctx.lineTo(x,y);
  });
  ctx.stroke();
}
