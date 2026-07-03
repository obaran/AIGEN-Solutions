// File de lecture PCM (Float32 @ 24 kHz) reçue du thread principal.
// "interrupt" vide la file (barge-in : l'utilisateur coupe la parole).
// Signale "drained" quand la voix a FINI de jouer (file vidée après audio),
// pour que le client ne raccroche pas avant la fin de la phrase.
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioQueue = [];
    this.currentOffset = 0;
    this.had = false;      // a reçu de l'audio à jouer
    this.notified = false; // "drained" déjà signalé pour ce silence
    this.port.onmessage = (event) => {
      if (event.data === "interrupt") { this.audioQueue = []; this.currentOffset = 0; this.had = false; this.notified = true; }
      else if (event.data instanceof Float32Array) { this.audioQueue.push(event.data); this.had = true; this.notified = false; }
    };
  }
  process(inputs, outputs) {
    const output = outputs[0];
    if (output.length === 0) return true;
    const channel = output[0];
    let outIdx = 0;
    while (outIdx < channel.length && this.audioQueue.length > 0) {
      const buf = this.audioQueue[0];
      if (!buf || buf.length === 0) { this.audioQueue.shift(); this.currentOffset = 0; continue; }
      const copyLen = Math.min(channel.length - outIdx, buf.length - this.currentOffset);
      for (let i = 0; i < copyLen; i++) channel[outIdx++] = buf[this.currentOffset++];
      if (this.currentOffset >= buf.length) { this.audioQueue.shift(); this.currentOffset = 0; }
    }
    while (outIdx < channel.length) channel[outIdx++] = 0; // silence
    // la voix vient de finir de jouer (file vidée après avoir eu de l'audio)
    if (this.audioQueue.length === 0 && this.had && !this.notified) { this.notified = true; this.port.postMessage("drained"); }
    return true;
  }
}
registerProcessor("pcm-processor", PCMProcessor);
