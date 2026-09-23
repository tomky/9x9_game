// 用 Web Audio 合成簡單音效（不需音檔）。

export class Sound {
  private ctx: AudioContext | null = null;
  enabled = true;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      this.ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.15, delay = 0): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + delay;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  tap(): void {
    this.tone(600, 0.06, 'square', 0.05);
  }
  swap(): void {
    this.tone(400, 0.08, 'triangle', 0.08);
  }
  clear(combo: number): void {
    this.tone(500 + combo * 80, 0.15, 'triangle', 0.12);
    this.tone(750 + combo * 80, 0.15, 'triangle', 0.08, 0.05);
  }
  correct(): void {
    this.tone(660, 0.12, 'sine', 0.15);
    this.tone(880, 0.18, 'sine', 0.15, 0.1);
    this.tone(1320, 0.25, 'sine', 0.12, 0.2);
  }
  wrong(): void {
    this.tone(220, 0.25, 'sawtooth', 0.1);
    this.tone(180, 0.3, 'sawtooth', 0.1, 0.15);
  }
  skill(): void {
    this.tone(300, 0.1, 'square', 0.1);
    this.tone(600, 0.1, 'square', 0.1, 0.08);
    this.tone(1200, 0.2, 'square', 0.08, 0.16);
  }
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.14, i * 0.12));
  }
  lose(): void {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.12, i * 0.18));
  }
  unlock(): void {
    [659, 784, 988, 1319, 1568].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.14, i * 0.1));
  }
}
