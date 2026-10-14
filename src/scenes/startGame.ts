import type { GameContext } from '@/core/GameContext';
import { gameState } from '@/game/GameState';
import { ensurePlayerState } from '@/game/playerStore';
import { STR } from '@/ui/strings';
import { CharacterScene } from './CharacterScene';
import { MainMenuScene } from './MainMenuScene';
import { PlanetScene } from './PlanetScene';
import { SpaceScene } from './SpaceScene';

/** Welt des aktuellen Seeds betreten: im Orbit → Raumflug, sonst Planet des Schiffs bzw. Startplanet. */
export function enterWorld(ctx: GameContext): void {
  const system = gameState.getSystem();
  const state = gameState.player;
  const loc = state?.ship.location ?? null;
  if (loc?.kind === 'orbit') ctx.scenes.switchTo(new SpaceScene());
  else ctx.scenes.switchTo(new PlanetScene(loc?.kind === 'surface' && system.planets.some((p) => p.id === loc.planetId) ? loc.planetId : system.startPlanetId));
}

/**
 * Spiel für `seed` starten oder fortsetzen: lädt den Spielerzustand, öffnet ohne Charakter zuerst den Editor.
 * `fresh` erzwingt das Neuladen aus der Datenbank (nach Laden eines Slots/Imports).
 */
export async function startGame(ctx: GameContext, seed: string, fresh = false): Promise<void> {
  if (fresh) {
    gameState.player = null;
    gameState.progress = null;
    gameState.surface = null;
    gameState.arrival = null;
  }
  gameState.seed = seed;
  const state = await ensurePlayerState(gameState.seed);
  if (gameState.seed !== seed.trim().toUpperCase().replace(/\s+/g, '-') && gameState.seed !== seed) return;
  if (!state.character) {
    ctx.scenes.switchTo(new CharacterScene({ onDone: () => enterWorld(ctx), onCancel: () => ctx.scenes.switchTo(new MainMenuScene()), applyLabel: STR.character.start }));
    return;
  }
  enterWorld(ctx);
}
