import { PARCELS, owned } from './farm';
import { LANES, lanesFor } from './lanes';
import { game } from './state';
import type { Horde } from './zombies';
import type { Walls } from './walls';

const X1 = -96, X2 = 96, Z1 = -98, Z2 = 62;

export class Minimap {
  private c: HTMLCanvasElement;
  private x: CanvasRenderingContext2D;
  private t = 0;
  private big = false;

  constructor(el: HTMLCanvasElement) {
    this.c = el;
    this.x = el.getContext('2d')!;
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.big = !this.big; el.classList.toggle('big', this.big); this.t = 0; });
  }

  update(dt: number, horde: Horde, walls: Walls, px: number, pz: number, yaw: number, tractor: { x: number; z: number; on: boolean }, laneCounts: Record<string, number>, time: number) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.12;
    const c = this.c, x = this.x;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = W / (X2 - X1), sz = H / (Z2 - Z1);
    const mx = (v: number) => (v - X1) * sx, mz = (v: number) => (v - Z1) * sz;
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(40,32,20,0.78)'; x.fillRect(0, 0, W, H);
    // terrenos
    for (const p of PARCELS) {
      x.fillStyle = owned[p.id] ? 'rgba(110,190,80,0.85)' : 'rgba(150,130,90,0.4)';
      x.fillRect(mx(p.x0), mz(p.z0), 20 * sx, 20 * sz);
    }
    // casa
    x.fillStyle = '#e8b04a'; x.fillRect(mx(-22.4), mz(7.8), 10.8 * sx, 8.4 * sz);
    x.fillStyle = '#fff'; x.font = `${Math.max(8, W / 14)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('🏠', mx(-17), mz(12));
    // rotas
    const night = game.s.phase === 'night';
    const active = new Set(Object.keys(laneCounts));
    const avail = new Set(lanesFor(game.s.nights + 1).map((l) => l.id));
    for (const l of LANES) {
      if (!avail.has(l.id)) continue;
      const on = active.has(l.id);
      x.strokeStyle = on ? `rgba(255,70,50,${0.65 + Math.sin(time * 5) * 0.25})` : 'rgba(255,255,255,0.18)';
      x.lineWidth = on ? 2.5 : 1.5;
      x.setLineDash(on ? [5, 3] : [2, 3]);
      x.lineDashOffset = -time * 12;
      x.beginPath();
      l.pts.forEach(([a, b], i) => (i ? x.lineTo(mx(a), mz(b)) : x.moveTo(mx(a), mz(b))));
      x.stroke();
      if (on) {
        const [a, b] = l.pts[0];
        const ix = Math.min(W - 9, Math.max(9, mx(a))), iz = Math.min(H - 9, Math.max(9, mz(b)));
        x.fillStyle = '#ff4a3a'; x.beginPath(); x.arc(ix, iz, 8, 0, 6.3); x.fill();
        x.fillStyle = '#fff'; x.font = `bold ${Math.max(8, W / 16)}px sans-serif`;
        x.fillText(String(laneCounts[l.id]), ix, iz + 0.5);
      }
    }
    x.setLineDash([]);
    // barricadas
    x.fillStyle = '#c9884a';
    for (const w of walls.list) x.fillRect(mx(w.x) - 2, mz(w.z) - 2, 4, 4);
    // zumbis
    for (const z of horde.list) {
      if (z.dead) continue;
      const p = z.g.position;
      const r = z.kind === 'colossus' ? 5 : z.kind === 'brute' ? 3.2 : 2.2;
      x.fillStyle = z.kind === 'crow' ? '#c07aff' : z.burrowed ? '#a0784a' : '#ff3a2a';
      x.beginPath(); x.arc(mx(p.x), mz(p.z), r, 0, 6.3); x.fill();
    }
    // trator
    if (tractor.on) { x.fillStyle = '#ffb02a'; x.fillRect(mx(tractor.x) - 3, mz(tractor.z) - 3, 6, 6); }
    // jogador
    x.save();
    x.translate(mx(px), mz(pz));
    x.rotate(-yaw);
    x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(0, -7); x.lineTo(4.5, 5); x.lineTo(0, 2.5); x.lineTo(-4.5, 5); x.closePath(); x.fill(); x.stroke();
    x.restore();
    x.strokeStyle = night ? 'rgba(255,90,60,0.8)' : 'rgba(255,255,255,0.5)'; x.lineWidth = 2;
    x.strokeRect(1, 1, W - 2, H - 2);
  }
}
