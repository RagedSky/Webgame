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
  | 'debug_weather'
  | 'shutter'
  | 'photo_focus_near'
  | 'photo_focus_far'
  | 'photo_aperture'
  | 'photo_exposure_down'
  | 'photo_exposure_up'
  | 'photo_filter'
  | 'photo_grid'
  | 'photo_selfie'
  | 'sample'
  | 'remove'
  | 'rotate'
  | 'slot1'
  | 'slot2'
  | 'slot3'
  | 'slot4';

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
  shutter: ['Space'],
  photo_focus_near: ['Comma'],
  photo_focus_far: ['Period'],
  photo_aperture: ['KeyR'],
  photo_exposure_down: ['Digit1'],
  photo_exposure_up: ['Digit2'],
  photo_filter: ['KeyF'],
  photo_grid: ['KeyH'],
  photo_selfie: ['KeyC'],
  sample: ['KeyF'],
  remove: ['KeyX'],
  rotate: ['KeyR'],
  slot1: ['Digit1'],
  slot2: ['Digit2'],
  slot3: ['Digit3'],
  slot4: ['Digit4'],
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
  shutter: 'Auslöser (Foto-Modus)',
  photo_focus_near: 'Fokus näher',
  photo_focus_far: 'Fokus weiter',
  photo_aperture: 'Blende wechseln',
  photo_exposure_down: 'Belichtung −',
  photo_exposure_up: 'Belichtung +',
  photo_filter: 'Filter wechseln',
  photo_grid: 'Raster ein/aus',
  photo_selfie: 'Selfie-Modus',
  sample: 'Probe / Scan',
  remove: 'Modul entfernen (Bau-Modus)',
  rotate: 'Drehen (Bau-Modus)',
  slot1: 'Modul 1',
  slot2: 'Modul 2',
  slot3: 'Modul 3',
  slot4: 'Modul 4',
};
