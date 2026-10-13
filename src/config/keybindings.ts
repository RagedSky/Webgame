/** Aktionen des Spiels. Tastenbelegung ist pro Aktion eine Liste von KeyboardEvent.code-Werten. */
export type GameAction =
  | 'move_forward'
  | 'move_back'
  | 'move_left'
  | 'move_right'
  | 'jump'
  | 'sprint'
  | 'crouch'
  | 'interact'
  | 'camera'
  | 'catalog'
  | 'map'
  | 'inventory'
  | 'build'
  | 'pause'
  | 'debug'
  | 'screenshot'
  | 'toggle_view'
  | 'fly'
  | 'debug_time'
  | 'debug_weather';

export const DEFAULT_BINDINGS: Record<GameAction, string[]> = {
  move_forward: ['KeyW', 'ArrowUp'],
  move_back: ['KeyS', 'ArrowDown'],
  move_left: ['KeyA', 'ArrowLeft'],
  move_right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['ControlLeft', 'KeyC'],
  interact: ['KeyE'],
  camera: ['KeyQ'],
  catalog: ['Tab'],
  map: ['KeyM'],
  inventory: ['KeyI'],
  build: ['KeyB'],
  pause: ['Escape'],
  debug: ['F3'],
  screenshot: ['F12'],
  toggle_view: ['KeyV'],
  fly: ['KeyG'],
  debug_time: ['KeyT'],
  debug_weather: ['KeyY'],
};

/** Lesbare Namen für die Tastenbelegungs-UI. */
export const ACTION_LABELS: Record<GameAction, string> = {
  move_forward: 'Vorwärts',
  move_back: 'Rückwärts',
  move_left: 'Links',
  move_right: 'Rechts',
  jump: 'Springen',
  sprint: 'Sprinten',
  crouch: 'Ducken',
  interact: 'Interagieren',
  camera: 'Kamera',
  catalog: 'Katalog',
  map: 'Karte',
  inventory: 'Inventar',
  build: 'Bau-Modus',
  pause: 'Pause / Menü',
  debug: 'Debug-Overlay',
  screenshot: 'Screenshot',
  toggle_view: 'Ansicht (Ego/Schulter)',
  fly: 'Flugmodus (Debug)',
  debug_time: 'Zeitraffer (Debug)',
  debug_weather: 'Wetter wechseln (Debug)',
};
