// File de lecture PCM (Float32 @ 24 kHz) reçue du thread principal.
// "interrupt" vide la file (barge-in : l'utilisateur coupe la parole).
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioQueue = [];
    this.currentOffset = 0;
    this.port.onmessage = (event) => {
      if (event.data === "interrupt") {
        this.audioQueue = [];
        this.currentOffset = 0;
      } else if (event.data instanceof Float32Array) {
        this.audioQueue.push(event.data);
      }
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
    return true;
  }
}
registerProcessor("pcm-processor", PCMProcessor);
