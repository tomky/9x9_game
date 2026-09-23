// 極簡補間系統。

export type Ease = (t: number) => number;
export const easeOut: Ease = (t) => 1 - (1 - t) * (1 - t);
export const easeIn: Ease = (t) => t * t;
export const easeInOut: Ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const linear: Ease = (t) => t;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any;

interface Tween {
  target: AnyObj;
  from: Record<string, number>;
  to: Record<string, number>;
  start: number;
  duration: number;
  ease: Ease;
  resolve: () => void;
  onUpdate?: () => void;
}

export class Tweens {
  private list: Tween[] = [];

  get active(): boolean {
    return this.list.length > 0;
  }

  /** 把 target 的數值屬性補間到 to；回傳完成的 Promise。 */
  to<T extends object>(
    target: T,
    to: Partial<Record<keyof T & string, number>>,
    duration: number,
    ease: Ease = easeOut,
    delay = 0,
    onUpdate?: () => void,
  ): Promise<void> {
    return new Promise((resolve) => {
      const from: Record<string, number> = {};
      const toRec = to as Record<string, number>;
      for (const k of Object.keys(toRec)) from[k] = (target as AnyObj)[k];
      this.list.push({ target, from, to: toRec, start: performance.now() + delay, duration, ease, resolve, onUpdate });
    });
  }

  update(now: number): void {
    const done: Tween[] = [];
    for (const tw of this.list) {
      if (now < tw.start) continue;
      const t = Math.min(1, (now - tw.start) / tw.duration);
      const e = tw.ease(t);
      for (const k of Object.keys(tw.to)) tw.target[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      tw.onUpdate?.();
      if (t >= 1) done.push(tw);
    }
    if (done.length) {
      this.list = this.list.filter((tw) => !done.includes(tw));
      for (const tw of done) tw.resolve();
    }
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
