// Cross-generator fairness guards: every generator's own solution must be accepted,
// and the two known-ambiguous puzzle kinds (keypad, anagram) must accept all valid
// readings rather than only one.
import { describe, it, expect } from 'vitest';
import { GENERATORS } from './index';
import { cipherGenerator } from './cipher';
import { anagramGenerator } from './anagram';
import { mulberry32 } from '../rng';

const DIFFS = [1, 2, 3, 4, 5] as const;

// Phone keypad letter→digit groups, for constructing same-code alternate readings.
const KEYPAD: Record<string, string> = {
  A: '2', B: '2', C: '2', D: '3', E: '3', F: '3', G: '4', H: '4', I: '4',
  J: '5', K: '5', L: '5', M: '6', N: '6', O: '6', P: '7', Q: '7', R: '7', S: '7',
  T: '8', U: '8', V: '8', W: '9', X: '9', Y: '9', Z: '9',
};
const GROUP: Record<string, string[]> = {};
for (const [letter, digit] of Object.entries(KEYPAD)) (GROUP[digit] ??= []).push(letter);

describe('fairness', () => {
  for (const g of GENERATORS) {
    it(
      `${g.skill}: solution accepted, prompt/solution/explanation present across seeds`,
      () => {
        const failures: string[] = [];
        for (const d of DIFFS) {
          for (let seed = 1; seed <= 80; seed++) {
            let p;
            try {
              p = g.generate(d, mulberry32(seed));
            } catch (e) {
              failures.push(`${g.skill} d${d} seed${seed}: THREW ${String(e)}`);
              continue;
            }
            if (!p.checkAnswer(p.solution)) failures.push(`d${d} seed${seed}: solution "${p.solution}" rejected`);
            if (!p.prompt?.trim()) failures.push(`d${d} seed${seed}: empty prompt`);
            if (!p.solution) failures.push(`d${d} seed${seed}: empty solution`);
            if (!p.explanation?.trim()) failures.push(`d${d} seed${seed}: empty explanation`);
          }
        }
        if (failures.length) console.log(`${g.skill}:\n${failures.slice(0, 20).join('\n')}\n...total ${failures.length}`);
        expect(failures).toEqual([]);
      },
      30000,
    );
  }

  it('keypad accepts any reading that maps to the same digits', () => {
    let p;
    outer: for (const d of [3, 5] as const) {
      for (let seed = 0; seed < 3000; seed++) {
        const cand = cipherGenerator.generate(d, mulberry32(seed));
        if ((cand.data as { kind: string }).kind === 'keypad') {
          p = cand;
          break outer;
        }
      }
    }
    expect(p, 'expected to generate a keypad puzzle').toBeDefined();
    const word = p!.solution;
    // Swap each letter for a different letter on the same key → same code, different reading.
    const alt = word
      .split('')
      .map((c) => GROUP[KEYPAD[c]].find((x) => x !== c) ?? c)
      .join('');
    expect(p!.checkAnswer(word)).toBe(true);
    expect(p!.checkAnswer(alt)).toBe(true); // a different valid reading of the same digits
    expect(p!.checkAnswer(word + 'A')).toBe(false); // extra letter → different code
  });

  it('anagram accepts common alternate anagrams (MAP / AMP / PAM)', () => {
    for (let seed = 0; seed < 3000; seed++) {
      const p = anagramGenerator.generate(1, mulberry32(seed));
      if (p.solution === 'MAP') {
        expect(p.checkAnswer('AMP')).toBe(true);
        expect(p.checkAnswer('PAM')).toBe(true);
        expect(p.checkAnswer('XYZ')).toBe(false);
        return;
      }
    }
    throw new Error('expected to generate the MAP anagram at difficulty 1');
  });
});
