// Original synthesized ambience. No recording or external music is copied.
export class ForestAudio {
  constructor() {
    this.enabled = false;
    this.night = false;
    this.context = null;
    this.timer = null;
  }
  async toggle() {
    if (this.enabled) {
      this.stop();
      return false;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error("Web Audio unavailable");
    this.context ??= new AudioCtx();
    await this.context.resume();
    this.enabled = true;
    this.master = this.context.createGain();
    this.master.gain.setValueAtTime(0, this.context.currentTime);
    this.master.gain.linearRampToValueAtTime(
      0.17,
      this.context.currentTime + 1,
    );
    this.master.connect(this.context.destination);
    this.oscs = [130.81, 196, 261.63, 329.63].map((f, i) => {
      let osc = this.context.createOscillator(),
        gain = this.context.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.value = 0.065 / (i + 1);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      return osc;
    });
    this.chime();
    this.timer = setInterval(() => this.chime(), 4200);
    return true;
  }
  chime() {
    if (!this.enabled || document.hidden) return;
    const c = this.context,
      t = c.currentTime,
      f =
        [523.25, 587.33, 659.25, 783.99, 880][Math.floor(Math.random() * 5)] *
        (this.night ? 0.5 : 1);
    const osc = c.createOscillator(),
      g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.17, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 3.1);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }
  stop() {
    if (!this.context) return;
    this.enabled = false;
    clearInterval(this.timer);
    const end = this.context.currentTime + 0.3;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
    this.oscs?.forEach((o) => o.stop(end));
    const old = this.master;
    setTimeout(() => old.disconnect(), 500);
  }
  setNight(night) {
    this.night = night;
  }
}
