import type { Technique } from '../types';

// Teaching reference for each skill: how to recognize the puzzle and how to crack it.
// Surfaced on the Techniques screen and mirrored by the per-puzzle `explanation` each
// generator produces.
export const TECHNIQUES: Technique[] = [
  {
    skill: 'cipher',
    title: 'Ciphers & Codes: identify the encoding, then reverse it',
    whatToLookFor: [
      'Only the 26 letters A–Z but the text is gibberish → a letterwise cipher: Caesar (uniform shift), Atbash (A↔Z mirror), substitution (scrambled alphabet), or Vigenère (a shift that changes per position with a keyword).',
      'Groups of digits separated by spaces or dashes → A1Z26 (1–26 = alphabet position), binary (8-bit groups = ASCII), or phone-keypad digits 2–9 (each digit = the letters printed on that key).',
      'Dots and dashes with separators (/ or spaces) → Morse code; look each group up in the Morse table.',
      'Real letters in a jumbled order that reads backwards or zig-zags → reverse (write it backwards) or a rail-fence (letters split across rails then concatenated).',
      "A hint naming a 'shift', a 'keyword', or showing 'A→X' sample mappings tells you exactly which family it is and gives you the key.",
    ],
    howToCrack: [
      'Classify the message’s alphabet — letters only, numbers, dots/dashes, or scrambled letters — to narrow it to one cipher family.',
      'If numbers: 1–26 → A1Z26 (n → nth letter); 8-bit groups → binary to decimal to ASCII; digits 2–9 → phone keypad (2=ABC, 3=DEF, 4=GHI, 5=JKL, 6=MNO, 7=PQRS, 8=TUV, 9=WXYZ).',
      'If letters with a constant rule: Caesar → shift each letter back by the given amount (wrap Z→A); Atbash → mirror each letter (A↔Z, B↔Y); substitution → invert the supplied A→X mappings; Vigenère → subtract the repeating keyword letters (A=0…Z=25) mod 26.',
      'If letters are merely reordered: reverse → read right-to-left; 2-rail rail-fence → take the first half as rail 1 and the second half as rail 2, then interleave them.',
      'When a step is ambiguous (e.g. keypad digits map to several letters), try each option and keep the combination that spells a real word.',
    ],
    example: {
      puzzle: 'Rail-fence cipher (2 rails). Decode: ECPSAE',
      solution: 'ESCAPE',
      walkthrough:
        'A 2-rail fence writes the word zig-zag across two rows: rail 1 takes the letters at positions 1,3,5 and rail 2 the letters at positions 2,4,6, then the cipher is rail 1 followed by rail 2. ECPSAE has 6 letters, so the first 3 (ECP) are rail 1 and the last 3 (SAE) are rail 2. Interleave them — E, S, C, A, P, E — to read ESCAPE.',
    },
  },
  {
    skill: 'pattern',
    title: 'Pattern & Sequence: find the rule, then extend it',
    whatToLookFor: [
      "A row of numbers (or letters) ending in a blank or '?' you must fill in.",
      'Whether each step grows by a constant amount (add/subtract) or a constant factor (multiply) — flat vs. accelerating growth is the biggest tell.',
      "Numbers that look 'rounded' like 1, 4, 9, 16, 25 (perfect squares) or that each equal the sum of the two before (Fibonacci).",
      'Differences that swing between two values (e.g. +5, −2, +5, −2) — a sign the operation alternates or two sequences are interleaved.',
      'Letters: convert to alphabet positions (A=1, B=2, … Z=26) and treat them exactly like a number sequence.',
    ],
    howToCrack: [
      'Write the gap between each pair of consecutive terms (t2−t1, t3−t2, …).',
      'If those gaps are all equal it is arithmetic — add that gap to the last term.',
      'If the gaps grow, check the ratio (t2/t1): a constant ratio means geometric — multiply the last term by it.',
      'If neither is constant, test special forms: perfect squares? each term the sum of the previous two? a step that alternates between two operations?',
      'Still stuck? Try term = prev×2 + k, or split the list into odd/even positions to reveal two interleaved sequences.',
      'For letters, map to positions (A=1…Z=26), solve the number pattern, then map the answer back to a letter.',
    ],
    example: {
      puzzle: 'What letter comes next?  A, C, E, G, I, ?',
      solution: 'K',
      walkthrough:
        'Convert to positions: A=1, C=3, E=5, G=7, I=9. The gaps are all +2 (every other letter), so add 2 to the last position: 9 + 2 = 11. Position 11 is K.',
    },
  },
  {
    skill: 'observation',
    title: 'Observation & Memory: snapshot, anchor, and compare',
    whatToLookFor: [
      'A grid of symbols that flashes briefly then disappears — your window to encode it is short and one-shot.',
      'The question is asked AFTER the grid hides, so you must decide what to remember before it vanishes.',
      'Three task shapes: count one symbol, recall the symbol at a given row/column, or spot which single cell changed when a second grid appears.',
      'Grid size and flash speed scale with difficulty — bigger boards and shorter flashes punish whole-grid memorization.',
    ],
    howToCrack: [
      'Decide your encoding strategy before the flash ends; assume the hardest question if you can’t see the prompt first.',
      'For a COUNT task, do one disciplined left-to-right, top-to-bottom sweep tallying only the target symbol — never jump around (that causes double-counting).',
      'For a POSITION task, ignore the rest of the board: count down to the asked row, across to the asked column, and burn just that one symbol into memory.',
      'For a WHAT-CHANGED task, hold a rough snapshot (which rows held which symbols), then after the second grid appears compare row by row; the first mismatch is the change and its current symbol is the answer.',
      'Chunk large grids into rows or 2×2 blocks — working memory holds about four chunks, not 25 cells.',
      'Answer immediately once the grid hides; every extra second of distraction degrades the memory trace.',
    ],
    example: {
      puzzle:
        'A 3×3 grid flashes, then hides:  Row 1 [🔑 🔒 🔑]  Row 2 [⭐ 🔑 🔒]  Row 3 [🔑 🔒 ⭐].  How many 🔑 did you see?',
      solution: '4',
      walkthrough:
        'Commit to counting only 🔑 before the flash ends. One clean sweep, row by row: Row 1 has two (columns 1 and 3) → 2; Row 2 has one (column 2) → 3; Row 3 has one (column 1) → 4. One symbol, one steady sweep, one tally.',
    },
  },
  {
    skill: 'logic',
    title: 'Logic & Lateral: riddles, analogies, and deduction',
    whatToLookFor: [
      "A question phrased as a paradox ('gets wetter the more it dries') — the catch is usually a word with two meanings.",
      "Common words with a second, object-specific sense: 'keys/space/enter' (keyboard), 'hands/face' (clock), 'neck' (bottle).",
      "Wordplay cues like 'spelled', 'forward/backward' — the literal letters matter, not the meaning.",
      "The 'A is to B as C is to ___' template — name the relationship between A and B, then reapply it.",
      'A grid/list scenario: N people each matched to exactly one distinct item, with all-but-one pairing stated.',
    ],
    howToCrack: [
      "For a riddle, identify the contradiction, then re-read each key word hunting for its alternate meaning ('take' = take a step; 'hands' = clock hands).",
      "If meanings don't crack it, switch to wordplay: reverse the word, read it letter-by-letter, or take the question self-referentially.",
      'For an analogy, state the A→B relationship in one sentence (part/whole, young/adult, opposite, worker/workplace), then apply that exact relationship to C.',
      'For deduction, write down every stated pairing and cross each claimed item off the list; the one item nobody else has must belong to the unmentioned person.',
      'Sanity-check: the answer should satisfy ALL clues at once, and a paradoxical riddle should stop being a paradox once read in the intended sense.',
    ],
    example: {
      puzzle:
        'Each person owns one distinct item. Ava owns the key. Ben owns the map. Cara owns the candle. Dan owns the coin. What does Eve own?',
      solution: 'note',
      walkthrough:
        'The five items are key, map, candle, note, coin. The clues assign four of them (key→Ava, map→Ben, candle→Cara, coin→Dan). Cross those off; the only item left unclaimed is the note, so by elimination Eve owns the note.',
    },
  },
  {
    skill: 'combination',
    title: 'Combination Locks: constraint deduction',
    whatToLookFor: [
      'A numeric code of fixed length plus a bullet list of statements all simultaneously true of the code.',
      "Direct reveals that hand you a digit outright ('The 2nd digit is 4') — your easiest footholds.",
      "Parity clues ('the 1st digit is even') that halve a slot to {0,2,4,6,8} or {1,3,5,7,9}.",
      "Relational clues ('the 3rd digit is greater than the 1st') and global clues (digit sum, 'no two digits the same') that couple slots together.",
    ],
    howToCrack: [
      'Draw one blank slot per dial and write the candidates 0–9 under each.',
      'Fill in every direct reveal first — those slots are fixed and shrink the search instantly.',
      'Apply parity clues, crossing out the odd or even half of each named slot.',
      "Apply relational and 'no repeats' clues to link slots and remove already-used digits.",
      'Use the digit-sum clue last as the tie-breaker: the final unknown is forced to whatever makes the total match.',
      'Read the dials left to right, then re-check the code against EVERY clue before entering.',
    ],
    example: {
      puzzle:
        'Clues: 2nd digit is 4 · 3rd digit is even · 1st digit is even · 3rd > 1st · 3rd > 2nd · no two digits the same · digits add to 18.  Find the 3-digit code.',
      solution: '648',
      walkthrough:
        'Place the reveal: _4_. The 3rd digit is even and > 4, so it is 6 or 8. The sum forces digit1 + digit3 = 14; the even pair (digit3 > digit1) that sums to 14 is 6 and 8 → digit1 = 6, digit3 = 8. Check: 6, 4, 8 are distinct, both ends even, 6 < 8, 8 > 4, sum 18. Code = 648.',
    },
  },
  {
    skill: 'anagram',
    title: 'Anagrams & Words: unscramble the letters',
    whatToLookFor: [
      'A pile of jumbled letters asking for a single real word; the letter count is the exact word length.',
      'Themed context (escape rooms) biases the answer toward topical words: KEY, LOCK, CLUE, SECRET, PADLOCK.',
      'Distinctive letters (Q, X, K, V, doubled letters) that sharply narrow the possibilities.',
      'A workable vowel-to-consonant ratio hinting at a pronounceable structure.',
    ],
    howToCrack: [
      "Count the letters and tally vowels vs. consonants so you know the word's shape.",
      'Anchor on the rarest letter and ask which words of that length even contain it.',
      'Test familiar prefixes/suffixes (UN-, RE-, -ING, -ER, -LE, -ET) by pulling those letters out of the pile.',
      'Slot the remaining vowels between the consonants until the letters form a pronounceable sequence.',
      'Lean on the theme: prefer topical words over obscure ones.',
      'Verify by spelling the candidate back — it must use every supplied letter exactly once.',
    ],
    example: {
      puzzle: 'Unscramble these letters into a word:  K C L O',
      solution: 'LOCK',
      walkthrough:
        'Four letters, one vowel (O) and three consonants (L, C, K). Anchor on the rare K and lean on the escape-room theme: the consonants L-C-K around the O spell LOCK, which uses K, C, L, O exactly once each.',
    },
  },
  {
    skill: 'math',
    title: 'Mental Math: order of operations and shortcuts',
    whatToLookFor: [
      "A mixed expression with × alongside + or − (e.g. '6 + 4 × 3') — a trap if you read strictly left to right.",
      "A blank or '?' in an equation, meaning solve for the missing value ('7 × ? = 56').",
      "A percent phrase like '20% of 150', which is just a fraction in disguise.",
      "A short additive run ('4 + 8 + 12 + 16') that rewards pairing over one-by-one addition.",
    ],
    howToCrack: [
      'Scan the whole expression and locate any × or ÷ — those bind tighter and come before + or −.',
      'For chains: compute every product first, then sweep left to right doing additions and subtractions.',
      'For solve-for: isolate the ? by inverting the operation — divide by a known factor or subtract the known addend.',
      'For percent: find 1% (÷100) then multiply, or use shortcuts (25% = ÷4, 50% = ÷2, 10% = ÷10).',
      'For sequence sums: pair the first and last terms and multiply that average by the count of terms.',
      'Sanity-check the magnitude — the answer should feel proportional to the inputs.',
    ],
    example: {
      puzzle: 'Evaluate (mind the order of operations):  6 + 4 × 3',
      solution: '18',
      walkthrough:
        'Do the multiplication first: 4 × 3 = 12. Then add the leading term: 6 + 12 = 18. Reading left-to-right would wrongly give 10 × 3 = 30 — precedence is exactly the trap this tests.',
    },
  },
  {
    skill: 'spatial',
    title: 'Spatial Reasoning: turns, relative directions, and paths',
    whatToLookFor: [
      "A starting compass heading (N/E/S/W) followed by relative turns like 'turn left', 'turn right', 'turn around'.",
      "A facing direction mixed with a body-relative side ('facing East, your destination is to your left') to convert into a compass direction.",
      'Lattice path counting: a small grid where you move only in two directions from one corner to the opposite, asking how many distinct paths.',
    ],
    howToCrack: [
      'Memorize the clockwise ring N → E → S → W → N. Turning RIGHT advances one step clockwise (+90°); LEFT goes one step counter-clockwise (−90°); AROUND is two steps (180°).',
      'For turn sequences, update your heading one turn at a time, writing the new direction after each step so errors do not compound.',
      'For relative directions, mentally stand facing the given way: ahead = that direction, right = next clockwise, left = next counter-clockwise, behind = opposite.',
      'For grid paths, crossing an R×C grid takes exactly C right-moves and R up-moves; the number of orderings is the binomial coefficient C(R+C, R).',
      'Compute C(R+C, R) = (R+C)! / (R!·C!). For small grids just multiply out, e.g. C(6,3) = (6·5·4)/(3·2·1) = 20.',
    ],
    example: {
      puzzle:
        'You are facing NORTH. You turn right, then turn around, then turn left. Which direction are you facing now?',
      solution: 'SOUTH',
      walkthrough:
        'Start NORTH. Turn right (+90° clockwise) → EAST. Turn around (180°) → WEST. Turn left (−90°) → SOUTH. Updating one step at a time on the ring N→E→S→W gives SOUTH.',
    },
  },
];

export function getTechnique(skill: Technique['skill']): Technique | undefined {
  return TECHNIQUES.find((t) => t.skill === skill);
}
