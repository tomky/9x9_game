// 出題、干擾選項、提示。

import { Question } from './types';
import { Rng } from './rng';

/**
 * 產生一題 a×b。
 * @param numbers 本關開放的乘數
 * @param weights 每個乘數被抽到的權重（與 numbers 對齊）；省略則均分
 * @param bWeight 第二個數 b 的權重函式（例如偏向尚未答對的組合）；省略則均分
 */
export function makeQuestion(
  numbers: number[],
  rng: Rng,
  weights?: number[],
  bWeight?: (a: number, b: number) => number,
): Question {
  let a: number;
  if (weights && weights.length === numbers.length) {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = rng.next() * total;
    a = numbers[numbers.length - 1];
    for (let i = 0; i < numbers.length; i++) {
      r -= weights[i];
      if (r < 0) {
        a = numbers[i];
        break;
      }
    }
  } else {
    a = rng.pick(numbers);
  }
  let b = 2 + rng.int(8);
  if (bWeight) {
    // 偏向還沒答對過的組合
    const bs = [2, 3, 4, 5, 6, 7, 8, 9];
    const ws = bs.map((x) => Math.max(0, bWeight(a, x)));
    const total = ws.reduce((s, w) => s + w, 0);
    if (total > 0) {
      let r = rng.next() * total;
      for (let i = 0; i < bs.length; i++) {
        r -= ws[i];
        if (r < 0) {
          b = bs[i];
          break;
        }
      }
    }
  }
  // 隨機決定顯示順序（a×b 或 b×a），統計時兩邊都算
  return rng.next() < 0.5 ? { a, b, answer: a * b } : { a: b, b: a, answer: a * b };
}

/** 四選一的選項（含正解），已洗牌。 */
export function makeChoices(q: Question, rng: Rng): number[] {
  const { a, b, answer } = q;
  const candidates = [
    a * (b + 1),
    a * (b - 1),
    (a + 1) * b,
    (a - 1) * b,
    answer + a,
    answer - a,
    answer + b,
    answer - b,
  ];
  const set = new Set<number>();
  for (const c of candidates) if (c > 0 && c !== answer) set.add(c);
  const pool = rng.shuffle([...set]);
  const distractors = pool.slice(0, 3);
  // 極少數情況不足 3 個（如 2×2）時補上相近數字
  let delta = 1;
  while (distractors.length < 3) {
    const cand = answer + delta * (delta % 2 === 0 ? -1 : 1);
    if (cand > 0 && cand !== answer && !distractors.includes(cand)) distractors.push(cand);
    delta++;
  }
  return rng.shuffle([answer, ...distractors]);
}

/** 閃光提示：用相鄰的乘法拆解，例如 7×8 = 7×7 + 7。 */
export function makeHint(q: Question): string {
  const { a, b } = q;
  if (b > 2) return `${a}×${b} = ${a}×${b - 1} + ${a} = ${a * (b - 1)} + ${a}`;
  return `${a}×${b} = ${a} + ${a}`;
}

export function formatQuestion(q: Question): string {
  return `${q.a} × ${q.b}`;
}
