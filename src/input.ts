export const input = {
  touch: false,
  locked: false,
  joyX: 0, joyY: 0,
  lookX: 0, lookY: 0,
  action: false,
  sprint: false,
  enabled: true,
  pinch: 0,
  tapX: 0, tapY: 0,
};
const aerialOn = () => document.body.classList.contains('aerial');

const keys = new Set<string>();
const pressed = new Set<string>();
export const consume = (k: string) => { const h = pressed.has(k); pressed.delete(k); return h; };
export const press = (k: string) => pressed.add(k);
export const keyDown = (k: string) => keys.has(k);

export function moveVec(): [number, number] {
  let x = input.joyX, y = input.joyY;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  return [x, y];
}

export function initInput(canvas: HTMLCanvasElement, joy: HTMLElement, knob: HTMLElement, onLockRequest: () => void) {
  input.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    keys.add(e.code);
    pressed.add(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = true;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = false;
  });
  window.addEventListener('blur', () => { keys.clear(); input.action = false; input.joyX = input.joyY = 0; });

  // ---- Mouse (desktop)
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; if (!input.locked) input.action = false; });
  canvas.addEventListener('mousedown', (e) => {
    if (input.touch || aerialOn()) return;
    if (!input.locked) { onLockRequest(); return; }
    if (e.button === 0) input.action = true;
    if (e.button === 2) pressed.add('KeyE');
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) input.action = false; });
  window.addEventListener('mousemove', (e) => {
    if (!input.locked || !input.enabled) return;
    if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return; // pico ao travar o ponteiro
    input.lookX += e.movementX * 0.0022;
    input.lookY += e.movementY * 0.0022;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('wheel', (e) => { if (input.locked || (aerialOn() && e.target === canvas)) pressed.add(e.deltaY > 0 ? 'WheelDown' : 'WheelUp'); }, { passive: true });

  // ---- Visão aérea: arrastar, pinçar e tocar (toque e mouse)
  const ap = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  let pd = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (!aerialOn() || !input.enabled) return;
    ap.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    if (ap.size === 2) { const [a, b] = [...ap.values()]; pd = Math.hypot(a.x - b.x, a.y - b.y); }
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ap.get(e.pointerId);
    if (!p || !aerialOn()) return;
    if (ap.size >= 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...ap.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pd > 0) input.pinch += Math.log(d / pd);
      pd = d;
      return;
    }
    const k = e.pointerType === 'mouse' ? 0.0022 : 0.0055;
    input.lookX += (e.clientX - p.x) * k * (e.pointerType === 'mouse' && input.touch ? 0.0055 / 0.0022 : 1);
    input.lookY += (e.clientY - p.y) * k * (e.pointerType === 'mouse' && input.touch ? 0.0055 / 0.0022 : 1);
    p.x = e.clientX; p.y = e.clientY;
  });
  const aup = (e: PointerEvent) => {
    const p = ap.get(e.pointerId);
    if (!p) return;
    if (ap.size === 1 && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 9 && performance.now() - p.t < 400) { input.tapX = e.clientX; input.tapY = e.clientY; pressed.add('Tap'); }
    ap.delete(e.pointerId); pd = 0;
  };
  canvas.addEventListener('pointerup', aup);
  canvas.addEventListener('pointercancel', aup);

  // ---- Toque: joystick virtual à esquerda, olhar arrastando à direita
  let joyId = -1, lookId = -1;
  let jx = 0, jy = 0, lx = 0, ly = 0;
  const R = 56;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || aerialOn()) return;
    input.touch = true;
    document.body.classList.add('touch');
    if (!input.enabled) return;
    if (e.clientX < window.innerWidth * 0.42 && joyId < 0) {
      joyId = e.pointerId; jx = e.clientX; jy = e.clientY;
      joy.style.left = jx + 'px'; joy.style.top = jy + 'px';
      joy.classList.add('on');
      knob.style.transform = 'translate(-50%,-50%)';
    } else if (lookId < 0) {
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
    }
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyId) {
      let dx = e.clientX - jx, dy = e.clientY - jy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
      input.joyX = dx / R; input.joyY = -dy / R;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else if (e.pointerId === lookId) {
      const s = 0.0055 * Number(localStorage.getItem('tv-sens') || 1);
      input.lookX += (e.clientX - lx) * s;
      input.lookY += (e.clientY - ly) * s;
      lx = e.clientX; ly = e.clientY;
    }
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId === joyId) { joyId = -1; input.joyX = input.joyY = 0; joy.classList.remove('on'); }
    if (e.pointerId === lookId) lookId = -1;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // bloqueia gestos de rolagem/zoom do navegador
  document.addEventListener('touchmove', (e) => { if (!(e.target as HTMLElement).closest('.scroll')) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
}

/** Liga um botão de toque (pressionar e segurar). */
export function holdButton(el: HTMLElement, on: (v: boolean) => void) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture?.(e.pointerId); el.classList.add('down'); on(true); });
  const up = (e: PointerEvent) => { e.stopPropagation(); el.classList.remove('down'); on(false); };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', () => { el.classList.remove('down'); on(false); });
}
