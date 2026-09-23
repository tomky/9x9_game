// 指標事件（滑鼠 / 觸控）→ 點選或拖曳交換；技能模式下更新預覽格。

import { Pos } from '../core/types';
import { Renderer } from '../render/renderer';

export interface InputHandlers {
  tap(p: Pos): void;
  drag(from: Pos, to: Pos): void;
  hover(p: Pos | null): void;
}

export function bindInput(canvas: HTMLCanvasElement, renderer: Renderer, h: InputHandlers): void {
  let downCell: Pos | null = null;
  let downX = 0;
  let downY = 0;
  let dragged = false;

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    downCell = renderer.cellAt(e.clientX, e.clientY);
    downX = e.clientX;
    downY = e.clientY;
    dragged = false;
    h.hover(downCell);
  });

  canvas.addEventListener('pointermove', (e) => {
    const cell = renderer.cellAt(e.clientX, e.clientY);
    h.hover(cell);
    if (!downCell || dragged) return;
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    const threshold = renderer.cell * 0.35;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
    const to: Pos = Math.abs(dx) > Math.abs(dy) ? { x: downCell.x + Math.sign(dx), y: downCell.y } : { x: downCell.x, y: downCell.y + Math.sign(dy) };
    dragged = true;
    h.drag(downCell, to);
  });

  const up = (e: PointerEvent) => {
    if (downCell && !dragged) {
      const cell = renderer.cellAt(e.clientX, e.clientY);
      if (cell && cell.x === downCell.x && cell.y === downCell.y) h.tap(cell);
    }
    downCell = null;
    dragged = false;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => {
    downCell = null;
    dragged = false;
  });
  canvas.addEventListener('pointerleave', () => h.hover(null));
}
