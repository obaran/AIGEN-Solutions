// Capture micro -> buffers PCM (Float32) postés au thread principal.
// ~32 ms par buffer @ 16 kHz. Worklet (remplace ScriptProcessor déprécié).
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 512;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const ch = input[0];
      for (let i = 0; i < ch.length; i++) {
        this.buffer[this.bufferIndex++] = ch[i];
        if (this.bufferIndex >= this.bufferSize) {
          this.port.postMessage({ type: "audio", data: this.buffer.slice() });
          this.bufferIndex = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("audio-capture-processor", AudioCaptureProcessor);
