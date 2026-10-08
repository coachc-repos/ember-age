export class ValleyAudio {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private droneA: OscillatorNode | null = null;
  private droneB: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  muted = false;

  unlock() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx.gain.value = 0.9;
      this.music.gain.value = 0.7;
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(this.ctx.destination);
      const n = this.ctx.createBuffer(1, this.ctx.sampleRate * 1, this.ctx.sampleRate);
      const data = n.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = n;
      this.startDrone();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.03);
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  private startDrone() {
    if (!this.ctx || !this.music) return;
    const t = this.ctx.currentTime;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.0001, t);
    this.droneGain.gain.exponentialRampToValueAtTime(0.045, t + 1.2);
    this.droneA = this.ctx.createOscillator();
    this.droneB = this.ctx.createOscillator();
    this.droneA.type = "sine";
    this.droneB.type = "triangle";
    this.droneA.frequency.value = 98;
    this.droneB.frequency.value = 146;
    this.droneA.connect(filter);
    this.droneB.connect(filter);
    filter.connect(this.droneGain);
    this.droneGain.connect(this.music);
    this.droneA.start();
    this.droneB.start();
  }

  setNight(night: boolean) {
    if (!this.ctx || !this.droneA || !this.droneB) return;
    const t = this.ctx.currentTime;
    this.droneA.frequency.setTargetAtTime(night ? 73 : 98, t, 0.4);
    this.droneB.frequency.setTargetAtTime(night ? 110 : 146, t, 0.4);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0) {
    if (!this.ctx || !this.sfx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  private burst(dur: number, vol: number, rate = 1) {
    if (!this.ctx || !this.sfx || !this.noise || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rate;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800 * rate;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  step() {
    this.burst(0.05, 0.04, 1.6 + Math.random() * 0.4);
  }

  stomp() {
    this.tone(48, 0.22, "sine", 0.11, -18);
    this.burst(0.2, 0.1, 0.28);
  }

  spear() {
    this.burst(0.09, 0.08, 0.7);
    this.tone(520, 0.08, "triangle", 0.04, -280);
  }

  throw() {
    this.tone(340, 0.12, "sawtooth", 0.035, 180);
  }

  hit() {
    this.tone(180, 0.09, "square", 0.05, -90);
    this.burst(0.06, 0.06, 0.5);
  }

  hurt() {
    this.tone(120, 0.18, "sawtooth", 0.06, -70);
  }

  eat() {
    this.tone(520, 0.08, "sine", 0.05);
    this.tone(680, 0.1, "sine", 0.04);
  }

  gather() {
    this.tone(300, 0.07, "triangle", 0.04, 80);
  }

  roar() {
    this.tone(70, 0.55, "sawtooth", 0.07, -30);
    this.burst(0.35, 0.05, 0.25);
  }

  dawn() {
    this.tone(392, 0.18, "sine", 0.05);
    this.tone(523, 0.28, "sine", 0.04);
  }

  die() {
    this.tone(90, 0.5, "sine", 0.07, -40);
  }

  drink() {
    this.tone(480, 0.1, "sine", 0.045, -160);
    this.burst(0.16, 0.045, 0.35);
  }

  chop() {
    this.burst(0.08, 0.09, 0.5);
    this.tone(150, 0.07, "square", 0.04, -50);
  }

  craft() {
    this.tone(240, 0.08, "triangle", 0.05, 60);
    this.tone(360, 0.14, "triangle", 0.04, 30);
  }
}
