/** Silbenbasierte Namensgeneratoren für Systeme, Sterne, Planeten und Monde. */
import type { Random } from '@/math/Random';
import { capitalize } from '@/math/utils';

const ONSETS = ['k', 'v', 'r', 'th', 'z', 'm', 'n', 's', 'l', 'dr', 'gr', 'kr', 't', 'p', 'y', 'b', 'd', 'f', 'h', 'j', 'tr', 'ch', 'v', 'n', 'l', 'r'];
const NUCLEI = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'o', 'ae', 'ia', 'ou', 'ey', 'ai', 'io', 'ei'];
const CODAS = ['', '', '', 'n', 'r', 's', 'k', 'l', 'th', 'x', 'm', 'nd', 'rn', 'l'];
const BLOCKLIST = ['shit', 'fuck', 'arsch', 'nazi', 'cunt', 'kack', 'fick', 'hitl', 'rape', 'piss', 'dick', 'kuk'];

/** Ein aussprechbares Pseudo-Wort mit 2–3 Silben. */
export function syllableWord(rng: Random, syllables = rng.int(2, 3)): string {
  let out = '';
  for (let i = 0; i < syllables; i++) {
    const onset = i === 0 ? rng.pick(ONSETS) : rng.bool(0.8) ? rng.pick(ONSETS) : '';
    const nucleus = rng.pick(NUCLEI);
    const coda = i === syllables - 1 ? rng.pick(CODAS) : rng.bool(0.3) ? rng.pick(CODAS) : '';
    out += onset + nucleus + coda;
  }
  // Doppelte Konsonantencluster entschärfen
  out = out.replace(/([^aeiou])\1/g, '$1');
  const lower = out.toLowerCase();
  if (BLOCKLIST.some((b) => lower.includes(b))) return syllableWord(rng, syllables);
  return capitalize(out);
}

export function systemName(rng: Random): string {
  const word = syllableWord(rng, rng.int(2, 3));
  const style = rng.int(0, 2);
  if (style === 0) return `${word}-${rng.int(1, 999)}`;
  if (style === 1) return `${word} ${rng.pick(['Prime', 'Majoris', 'Minoris', 'Tertia', 'Nova', 'Secunda'])}`;
  return word;
}

export function planetName(rng: Random, _index: number): string {
  return syllableWord(rng, rng.int(2, 3));
}

export function moonName(rng: Random): string {
  return syllableWord(rng, rng.int(1, 2));
}
