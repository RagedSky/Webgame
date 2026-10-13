import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

describe('Determinismus-Regel', () => {
  it('kein Math.random() im Generierungscode (src/gen, src/math, src/world)', () => {
    const roots = ['src/gen', 'src/math', 'src/world'].map((r) => join(process.cwd(), r));
    const offenders: string[] = [];
    for (const root of roots) {
      if (!existsSync(root)) continue;
      for (const f of walk(root)) {
        if (/Math\.random\s*\(/.test(readFileSync(f, 'utf8'))) offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });
});
