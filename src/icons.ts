/** Ícones desenhados (traço arredondado, 24×24). */
const P: Record<string, string> = {
  wood: '<rect x="3" y="8" width="14" height="8" rx="3"/><ellipse cx="17" cy="12" rx="3.2" ry="4"/><circle cx="17" cy="12" r="1.2"/><path d="M6 11h5M7 14h6"/>',
  metal: '<path d="M3 17l3.5-7h11l3.5 7z"/><path d="M6.5 10l2-4h7l2 4"/><path d="M9 14h6"/>',
  mseed: '<path d="M12 3c5 4 6.5 11 0 18C5.5 14 7 7 12 3z"/><path d="M12 7v10M9.5 10l2.5 2 2.5-2"/>',
  food: '<path d="M3 11h18a9 7 0 0 1-18 0z"/><path d="M8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>',
  sword: '<path d="M20 4L9 15"/><path d="M14 4h6v6"/><path d="M6 13l5 5"/><path d="M4 20l3-3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  heart: '<path d="M12 20C5 15 3 11 3 8a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c0 3-2 7-9 12z"/>',
  leaf: '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z"/><path d="M5 19l8-8"/>',
  drop: '<path d="M12 3c4 6 7 9 7 12a7 7 0 0 1-14 0c0-3 3-6 7-12z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.5c0-1.5-5-1.5-5 .5s5 2 5 4-5 2-5 .5M12 6.5v11"/>',
  house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  boot: '<path d="M7 3h5v10l7 2c2 1 2 4 1 5H5v-7z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
  bolt: '<path d="M13 2L5 13h6l-1 9 9-12h-6z"/>',
  star: '<path d="M12 3l2.6 6 6.4.5-5 4.1 1.6 6.4L12 16.6 6.4 20 8 13.6 3 9.5 9.4 9z"/>',
  crown: '<path d="M3 8l4 5 5-7 5 7 4-5-2 10H5z"/>',
  flame: '<path d="M12 21c-5 0-7-4-6-8 1-3 4-4 4-8 4 2 3 5 5 6 1-2 1-3 1-4 3 3 3 7 2 9-1 3-3 5-6 5z"/>',
  wheat: '<path d="M12 21V8"/><path d="M12 8c-3-1-3-4 0-5 3 1 3 4 0 5zM12 13c-4 0-5-3-4-4 3 0 4 2 4 4zM12 13c4 0 5-3 4-4-3 0-4 2-4 4z"/>',
  tractor: '<circle cx="7" cy="16" r="4"/><circle cx="18" cy="17" r="3"/><path d="M4 12V6h6l2 6h8v3"/>',
  satellite: '<path d="M5 19A10 10 0 0 1 19 5"/><path d="M8 16a6 6 0 0 1 8-8"/><circle cx="12" cy="12" r="2"/>',
  chain: '<path d="M9 15l6-6"/><path d="M7 13l-2 2a3 3 0 0 0 4 4l2-2M13 7l2-2a3 3 0 0 1 4 4l-2 2"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M8 3l2 7M16 3l-2 7M12 13v4"/>',
  recycle: '<path d="M7 16a6 6 0 0 1 2-9l2-1M9 3l2 3-3 2M17 8a6 6 0 0 1-2 9l-2 1M15 21l-2-3 3-2"/>',
  rain: '<path d="M6 13a4 4 0 0 1 1-8 5 5 0 0 1 10 1 3.5 3.5 0 0 1 1 7z"/><path d="M8 16l-1 3M12 16l-1 3M16 16l-1 3"/>',
  bucket: '<path d="M5 8h14l-2 12H7z"/><path d="M5 8c0-5 14-5 14 0"/>',
  bank: '<path d="M3 9l9-5 9 5z"/><path d="M5 9v8M9 9v8M15 9v8M19 9v8M3 20h18"/>',
  fist: '<rect x="6" y="9" width="12" height="9" rx="3"/><path d="M9 9V6M12 9V5M15 9V6"/>',
  wind: '<path d="M3 9h12a3 3 0 1 0-3-3"/><path d="M3 14h15a3 3 0 1 1-3 3"/>',
  brick: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M3 12h18M9 6v6M15 12v6"/>',
  castle: '<path d="M4 20V8h3v2h3V8h4v2h3V8h3v12z"/><path d="M10 20v-5h4v5"/>',
  earth: '<circle cx="12" cy="12" r="9"/><path d="M6 8c3 1 3 4 1 6 2 2 5 1 5 4M15 5c-1 3 2 4 4 5M14 14c1-1 3 0 4 2"/>',
  sprout: '<path d="M12 21V11"/><path d="M12 11c0-4-3-6-7-6 0 4 3 6 7 6zM12 13c0-4 3-6 7-6 0 4-3 6-7 6z"/>',
  skull: '<path d="M5 11a7 7 0 0 1 14 0v4h-3v4H8v-4H5z"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>',
  basket: '<path d="M4 10h16l-2 10H6z"/><path d="M8 10c0-5 8-5 8 0"/>',
  talk: '<path d="M4 5h16v11H10l-4 4v-4H4z"/>',
  hammer: '<path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7L4 20"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  fork: '<path d="M8 3v6a4 4 0 0 0 8 0V3M12 3v18"/>',
  dna: '<path d="M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12"/><path d="M8 7h8M8 17h8"/>',
  moon: '<path d="M20 15A8 8 0 1 1 9 4a6 6 0 0 0 11 11z"/>',
};

export const ICON_NAMES = Object.keys(P);

export function icon(name: string, cls = ''): string {
  return `<svg class="svgi ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] ?? P.star}</svg>`;
}

export const RES = [
  { id: 'wood', name: 'Madeira', icon: 'wood', color: '#c98a4a' },
  { id: 'metal', name: 'Metal', icon: 'metal', color: '#9fb4c8' },
  { id: 'mseed', name: 'Semente mutante', icon: 'mseed', color: '#9dff7a' },
  { id: 'food', name: 'Comida', icon: 'food', color: '#ffb547' },
] as const;
export type ResId = (typeof RES)[number]['id'];
