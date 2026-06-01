/**
 * Circle of Fifths — Core Maths Module
 * Ported from COPNew.py.  No UI.  Pure computation only.
 */

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

export const NOTE_NAMES_12 = ['C','G','D','A','E','B','F#','C#','G#','D#','A#','E#'];
export const NOTE_NAMES_7  = ['C','G','D','A','E','B','F#'];

export const JUST_INTERVALS = {
  'm2':   1200 * Math.log2(16/15),
  'M2s':  1200 * Math.log2(10/9),
  'M2L':  1200 * Math.log2(9/8),
  'm3':   1200 * Math.log2(6/5),
  'M3':   1200 * Math.log2(5/4),
  'P4':   1200 * Math.log2(4/3),
  'TT+':  1200 * Math.log2(45/32),
  'TT-':  1200 * Math.log2(64/45),
  'P5':   1200 * Math.log2(3/2),
  'm6':   1200 * Math.log2(8/5),
  'M6':   1200 * Math.log2(5/3),
  'm7s':  1200 * Math.log2(16/9),
  'm7L':  1200 * Math.log2(9/5),
  'M7':   1200 * Math.log2(15/8),
  'd7':   1200 * Math.log2(128/75),
};

export const JUST_RATIOS_DISPLAY = {
  'm2':'16/15', 'M2s':'10/9',  'M2L':'9/8',
  'm3':'6/5',   'M3':'5/4',    'P4':'4/3',
  'TT+':'45/32','TT-':'64/45', 'P5':'3/2',
  'm6':'8/5',   'M6':'5/3',
  'm7s':'16/9', 'm7L':'9/5',   'M7':'15/8',
  'd7':'128/75',
};

// Heptatonic mode step sizes (5-limit just intonation)
const _L = 1200 * Math.log2(9/8);    // large whole tone  ≈ 203.910¢
const _s = 1200 * Math.log2(10/9);   // small whole tone  ≈ 182.404¢
const _h = 1200 * Math.log2(16/15);  // diatonic semitone ≈ 111.731¢
const _A = 1200 * Math.log2(75/64);  // augmented second  ≈ 274.582¢

export const HEPTATONIC_MODES = {
  'Ionian':      [_L, _s, _h, _L, _s, _L, _h],
  'Dorian':      [_L, _h, _s, _L, _s, _h, _L],
  'Phrygian':    [_h, _L, _s, _L, _h, _s, _L],
  'Lydian':      [_L, _s, _L, _h, _s, _L, _h],
  'Mixolydian':  [_L, _s, _h, _L, _s, _h, _L],
  'Aeolian':     [_L, _h, _s, _L, _h, _L, _s],
  'Locrian':     [_h, _L, _s, _h, _L, _s, _L],
  'Harm. minor': [_L, _h, _s, _L, _h, _A, _h],
  'Mel. minor':  [_L, _h, _s, _L, _s, _L, _h],
};

export const CHORD_DEFINITIONS = {
  'Major':        [[1200*Math.log2(5/4),  'M3'],  [1200*Math.log2(3/2),   'P5']],
  'Minor':        [[1200*Math.log2(6/5),  'm3'],  [1200*Math.log2(3/2),   'P5']],
  'Diminished':   [[1200*Math.log2(6/5),  'm3'],  [1200*Math.log2(64/45), 'TT-']],
  'Augmented':    [[1200*Math.log2(5/4),  'M3'],  [1200*Math.log2(8/5),   'm6']],
  'Major 7':      [[1200*Math.log2(5/4),  'M3'],  [1200*Math.log2(3/2),   'P5'],  [1200*Math.log2(15/8),   'M7']],
  'Dominant 7':   [[1200*Math.log2(5/4),  'M3'],  [1200*Math.log2(3/2),   'P5'],  [1200*Math.log2(9/5),    'm7L']],
  'Minor 7':      [[1200*Math.log2(6/5),  'm3'],  [1200*Math.log2(3/2),   'P5'],  [1200*Math.log2(9/5),    'm7L']],
  'Half-dim 7':   [[1200*Math.log2(6/5),  'm3'],  [1200*Math.log2(64/45), 'TT-'], [1200*Math.log2(9/5),    'm7L']],
  'Diminished 7': [[1200*Math.log2(6/5),  'm3'],  [1200*Math.log2(64/45), 'TT-'], [1200*Math.log2(128/75), 'd7']],
  'Minor-maj 7':  [[1200*Math.log2(6/5),  'm3'],  [1200*Math.log2(3/2),   'P5'],  [1200*Math.log2(15/8),   'M7']],
  'Aug-maj 7':    [[1200*Math.log2(5/4),  'M3'],  [1200*Math.log2(8/5),   'm6'],  [1200*Math.log2(15/8),   'M7']],
};

// ─────────────────────────────────────────────
// PURE HELPER FUNCTIONS
// ─────────────────────────────────────────────

/**
 * JS % can return negative values for negative operands.
 * Python % always returns non-negative.  Use this everywhere.
 */
function mod(a, b) {
  return ((a % b) + b) % b;
}

export function getNoteNames(n) {
  if (n === 12) return NOTE_NAMES_12;
  if (n === 7)  return NOTE_NAMES_7;
  return Array.from({length: n}, (_, i) => String(i));
}

/**
 * Returns the key in JUST_INTERVALS whose value is closest to `cents`.
 * No distance threshold — always returns a result.
 */
export function nearestJustInterval(cents) {
  let bestKey  = null;
  let bestDist = Infinity;
  for (const [key, val] of Object.entries(JUST_INTERVALS)) {
    const dist = Math.abs(cents - val);
    if (dist < bestDist) {
      bestDist = dist;
      bestKey  = key;
    }
  }
  return bestKey;
}

/**
 * Takes N fifth sizes in cents.
 * Returns N pitch classes starting from 0, accumulated mod 1200.
 * The closing fifth is NOT included (it's implied).
 */
export function computePitchClasses(fifthSizesCents) {
  const pitches = [0.0];
  let cum = 0.0;
  for (let i = 0; i < fifthSizesCents.length - 1; i++) {
    cum += fifthSizesCents[i];
    pitches.push(mod(cum, 1200));
  }
  return pitches;
}

/**
 * Directed interval from pitch i to pitch j, mod 1200.
 */
export function intervalCentsBetween(pitches, i, j) {
  return mod(pitches[j] - pitches[i], 1200);
}

/**
 * Piecewise linear colour interpolation from deviation in cents.
 * Returns [r, g, b] with each channel in [0, 1].
 */
export function colorFromDeviation(dev) {
  const anchors = [
    [0,  [0.00, 0.78, 0.27]],
    [5,  [0.55, 0.78, 0.00]],
    [12, [0.90, 0.55, 0.00]],
    [20, [0.90, 0.15, 0.00]],
    [40, [1.00, 0.00, 0.00]],
  ];
  dev = Math.max(0, dev);
  if (dev >= anchors[anchors.length - 1][0]) {
    return anchors[anchors.length - 1][1];
  }
  for (let k = 0; k < anchors.length - 1; k++) {
    const [d0, c0] = anchors[k];
    const [d1, c1] = anchors[k + 1];
    if (d0 <= dev && dev <= d1) {
      const t = (dev - d0) / (d1 - d0);
      return [
        c0[0] + t * (c1[0] - c0[0]),
        c0[1] + t * (c1[1] - c0[1]),
        c0[2] + t * (c1[2] - c0[2]),
      ];
    }
  }
  return anchors[0][1];
}

/**
 * Converts [r,g,b] (each 0–1) to a CSS hex string.
 */
export function rgbToHex(rgb) {
  return '#' + rgb.map(c => {
    const v = Math.round(Math.min(1, Math.max(0, c)) * 255);
    return v.toString(16).padStart(2, '0');
  }).join('');
}

export function formatIntervalLabel(cents) {
  return `${cents.toFixed(1)}c`;
}

export function formatFifthLabel(cents) {
  return `${cents.toFixed(2)}c`;
}

/**
 * Parses a fifth-size string: plain number, ratio "a/b", or power "b^(p/q)".
 * Throws on failure.
 */
export function parseFifthInput(s) {
  s = s.trim();

  // Plain decimal
  const asNum = Number(s);
  if (!isNaN(asNum) && asNum > 0 && asNum < 1200) {
    return asNum;
  }

  // Ratio: "3/2"
  const ratioMatch = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (ratioMatch) {
    return 1200 * Math.log2(Number(ratioMatch[1]) / Number(ratioMatch[2]));
  }

  // Power: "5^(1/4)" or "5^1/4"
  const powMatch = s.match(/^([\d.]+)\s*\^\s*\(?\s*([\d.]+)\s*\/\s*([\d.]+)\s*\)?$/);
  if (powMatch) {
    const base = Number(powMatch[1]);
    const exp  = Number(powMatch[2]) / Number(powMatch[3]);
    return 1200 * Math.log2(Math.pow(base, exp));
  }

  throw new Error(`Cannot parse: '${s}'`);
}

// ─────────────────────────────────────────────
// TUNING SYSTEM
// ─────────────────────────────────────────────

export class TuningSystem {
  constructor({ fifthSizes, pitchClasses, n, noteNames, angles }) {
    this.fifthSizes   = fifthSizes;
    this.pitchClasses = pitchClasses;
    this.n            = n;
    this.noteNames    = noteNames;
    this.angles       = angles;
  }

  static fromFifthSizes(sizes) {
    const pitchClasses = computePitchClasses(sizes);
    const n            = sizes.length;
    const noteNames    = getNoteNames(n);
    // angles: start at top (π/2), go clockwise
    const angles       = Array.from({length: n},
      (_, i) => Math.PI/2 - 2*Math.PI*i/n);
    return new TuningSystem({ fifthSizes: sizes, pitchClasses, n, noteNames, angles });
  }

  intervalCents(i, j) {
    return intervalCentsBetween(this.pitchClasses, i, j);
  }

  activeStepState(activeIntervals) {
    // activeIntervals: Map<step, boolean>
    let nActive = 0;
    for (const v of activeIntervals.values()) {
      if (v) nActive++;
    }
    const lblFs = Math.max(3.5, 6.0 - (nActive - 1) * 0.4);

    const activeSteps = [];
    for (const [step, on] of activeIntervals.entries()) {
      if (!on) continue;
      const comp = this.n - step;
      const compToggled = activeIntervals.has(comp) &&
                          activeIntervals.get(comp) &&
                          comp !== step;
      activeSteps.push([step, compToggled]);
    }
    return { nActive, lblFs, activeSteps };
  }

  stepLabel(step) {
    if (this.n === 12) {
      const vals = Array.from({length: this.n},
        (_, i) => this.intervalCents(i, mod(i + step, this.n)));
      const sorted = [...vals].sort((a, b) => a - b);
      const medianCents = sorted[Math.floor(sorted.length / 2)];
      const nearest = nearestJustInterval(medianCents);
      return `${step}~${nearest}`;
    }
    return `${step}gs`;
  }

  stepAnalysisLines(step) {
    const vals = Array.from({length: this.n},
      (_, i) => this.intervalCents(i, mod(i + step, this.n)));

    const devs = vals.map(v => {
      const nearest = nearestJustInterval(v);
      return Math.abs(v - JUST_INTERVALS[nearest]);
    });
    const maxDev = devs.length ? Math.max(...devs) : 0;
    const redThreshold = Math.max(12.0, maxDev * 0.6);

    const lines = [[`── ${step}gs ──`, 'header']];
    for (let i = 0; i < this.n; i++) {
      const j       = mod(i + step, this.n);
      const ic      = vals[i];
      const nearest = nearestJustInterval(ic);
      const justC   = JUST_INTERVALS[nearest];
      const ratio   = JUST_RATIOS_DISPLAY[nearest];
      const dev     = ic - justC;
      const sign    = dev >= 0 ? '+' : '';
      const lbl     = formatIntervalLabel(ic);
      const line    = `${this.noteNames[i].padEnd(3)}->${this.noteNames[j].padEnd(3)}` +
                      `  ${lbl.padStart(8)}  ${sign}${dev.toFixed(1)}c  ~${nearest} ${ratio}`;
      const tag     = Math.abs(dev) >= redThreshold ? 'rough' : 'normal';
      lines.push([line, tag]);
    }
    return lines;
  }

  tooltipLines(idx) {
    const rows = [];
    for (let step = 1; step < this.n; step++) {
      const j       = mod(idx + step, this.n);
      const ic      = this.intervalCents(idx, j);
      const nearest = nearestJustInterval(ic);
      const just    = JUST_INTERVALS[nearest];
      const dev     = ic - just;
      const sign    = dev >= 0 ? '+' : '';
      const ratio   = JUST_RATIOS_DISPLAY[nearest];
      rows.push([ic,
        `→${this.noteNames[j]} ~${nearest} ${ratio} ` +
        `${sign}${dev.toFixed(1)}c (${ic.toFixed(1)}c) [${step}gs]`]);
    }
    rows.sort((a, b) => a[0] - b[0]);
    const lines = [[`── ${this.noteNames[idx]} ──`, 'header']];
    for (const [, txt] of rows) {
      lines.push([txt, 'normal']);
    }
    return lines;
  }
}

// ─────────────────────────────────────────────
// SCALE ANALYSER
// ─────────────────────────────────────────────

export class ScaleAnalyser {
  static STRICT = 12.0;
  static LOOSE  = 20.0;

  constructor(tuning) {
    this.tuning = tuning;
    this.n      = tuning.n;
    // Pre-compute all directed intervals
    this._intervals = Array.from({length: tuning.n}, (_, i) =>
      Array.from({length: tuning.n}, (_, j) =>
        mod(tuning.pitchClasses[j] - tuning.pitchClasses[i], 1200)
      )
    );
  }

  intervalPurityTable() {
    const allCents = [];
    for (let i = 0; i < this.n; i++) {
      for (let j = 0; j < this.n; j++) {
        if (i !== j) allCents.push(this._intervals[i][j]);
      }
    }

    const targetBuckets = {};
    for (const name of Object.keys(JUST_INTERVALS)) {
      targetBuckets[name] = { pure: 0, subtle: 0, noticeable: 0, rough: 0 };
    }

    for (const ic of allCents) {
      const nearest = nearestJustInterval(ic);
      const justC   = JUST_INTERVALS[nearest];
      let dev       = Math.abs(ic - justC);
      dev = Math.min(dev, Math.abs(ic - (justC + 1200)), Math.abs(ic - (justC - 1200)));
      if      (dev < 5)  targetBuckets[nearest].pure++;
      else if (dev < 12) targetBuckets[nearest].subtle++;
      else if (dev < 20) targetBuckets[nearest].noticeable++;
      else               targetBuckets[nearest].rough++;
    }

    return Object.keys(JUST_INTERVALS).map(name => {
      const b = targetBuckets[name];
      return [name, JUST_RATIOS_DISPLAY[name], b.pure, b.subtle, b.noticeable, b.rough];
    });
  }

  chordCensus() {
    const result = {};
    const pcs    = this.tuning.pitchClasses;

    for (const [chordName, intervals] of Object.entries(CHORD_DEFINITIONS)) {
      let strictOk = 0;
      let looseOk  = 0;
      for (let rootIdx = 0; rootIdx < this.n; rootIdx++) {
        const rootPc = pcs[rootIdx];
        let sPass = true;
        let lPass = true;
        for (const [targetCents] of intervals) {
          const needed  = mod(rootPc + targetCents, 1200);
          const minDist = Math.min(...pcs.map(pc =>
            Math.min(Math.abs(pc - needed),
                     Math.abs(pc - needed + 1200),
                     Math.abs(pc - needed - 1200))
          ));
          if (minDist > ScaleAnalyser.LOOSE)  { lPass = false; sPass = false; break; }
          if (minDist > ScaleAnalyser.STRICT) { sPass = false; }
        }
        if (sPass)       strictOk++;
        else if (lPass)  looseOk++;
      }
      result[chordName] = [strictOk, looseOk];
    }
    return result;
  }

  heptatonicCensus() {
    if (this.n !== 12) return null;
    const pcs    = this.tuning.pitchClasses;
    const result = {};

    for (const [modeName, steps] of Object.entries(HEPTATONIC_MODES)) {
      const cumulative = [];
      let acc = 0.0;
      for (let k = 0; k < steps.length - 1; k++) {
        acc += steps[k];
        cumulative.push(mod(acc, 1200));
      }

      const counts = { pure: 0, subtle: 0, noticeable: 0, rough: 0 };

      for (const rootPc of pcs) {
        const tonePcs = [rootPc];
        for (const target of cumulative) {
          const needed = mod(rootPc + target, 1200);
          const best   = pcs.reduce((bpc, pc) => {
            const dNew = Math.min(Math.abs(pc - needed),
                                  Math.abs(pc - needed + 1200),
                                  Math.abs(pc - needed - 1200));
            const dOld = Math.min(Math.abs(bpc - needed),
                                  Math.abs(bpc - needed + 1200),
                                  Math.abs(bpc - needed - 1200));
            return dNew < dOld ? pc : bpc;
          });
          tonePcs.push(best);
        }

        for (let a = 0; a < 7; a++) {
          for (let b = a + 1; b < 7; b++) {
            const ic = Math.min(
              mod(tonePcs[b] - tonePcs[a], 1200),
              mod(tonePcs[a] - tonePcs[b], 1200));
            const nearest = nearestJustInterval(ic);
            const justC   = JUST_INTERVALS[nearest];
            let dev = Math.abs(ic - justC);
            dev = Math.min(dev,
              Math.abs(ic - (justC + 1200)),
              Math.abs(ic - (justC - 1200)));
            if      (dev < 5)  counts.pure++;
            else if (dev < 12) counts.subtle++;
            else if (dev < 20) counts.noticeable++;
            else               counts.rough++;
          }
        }
      }
      result[modeName] = counts;
    }
    return result;
  }

  heptatonicRootPairs(modeName) {
    const pcs       = this.tuning.pitchClasses;
    const noteNames = this.tuning.noteNames;
    const steps     = HEPTATONIC_MODES[modeName];
    const cumulative = [];
    let acc = 0.0;
    for (let k = 0; k < steps.length - 1; k++) {
      acc += steps[k];
      cumulative.push(mod(acc, 1200));
    }

    return pcs.map((rootPc, rootIdx) => {
      const toneIdxs = [rootIdx];
      for (const target of cumulative) {
        const needed   = mod(rootPc + target, 1200);
        const bestIdx  = pcs.reduce((bIdx, pc, k) => {
          const dNew = Math.min(Math.abs(pc - needed),
                                Math.abs(pc - needed + 1200),
                                Math.abs(pc - needed - 1200));
          const dOld = Math.min(Math.abs(pcs[bIdx] - needed),
                                Math.abs(pcs[bIdx] - needed + 1200),
                                Math.abs(pcs[bIdx] - needed - 1200));
          return dNew < dOld ? k : bIdx;
        }, 0);
        toneIdxs.push(bestIdx);
      }

      const counts = { pure: 0, subtle: 0, noticeable: 0, rough: 0 };
      const pairs  = [];
      for (let a = 0; a < 7; a++) {
        for (let b = a + 1; b < 7; b++) {
          const ia = toneIdxs[a], ib = toneIdxs[b];
          const ic = Math.min(
            mod(pcs[ib] - pcs[ia], 1200),
            mod(pcs[ia] - pcs[ib], 1200));
          const nearest = nearestJustInterval(ic);
          const justC   = JUST_INTERVALS[nearest];
          const dev     = ic - justC;
          let dist      = Math.abs(dev);
          dist = Math.min(dist,
            Math.abs(ic - (justC + 1200)),
            Math.abs(ic - (justC - 1200)));
          if      (dist < 5)  counts.pure++;
          else if (dist < 12) counts.subtle++;
          else if (dist < 20) counts.noticeable++;
          else                counts.rough++;
          pairs.push([noteNames[ia], noteNames[ib], ic, nearest, dev]);
        }
      }
      pairs.sort((a, b) => Math.abs(b[4]) - Math.abs(a[4]));
      return {
        rootName:   noteNames[rootIdx],
        pure:       counts.pure,
        subtle:     counts.subtle,
        noticeable: counts.noticeable,
        rough:      counts.rough,
        pairs,
      };
    });
  }

  intervalDrilldown(intervalName, band) {
    const justC    = JUST_INTERVALS[intervalName];
    const limits   = { pure: [0, 5], subtle: [5, 12], noticeable: [12, 20], rough: [20, Infinity] };
    const [lo, hi] = limits[band];
    const noteNames = this.tuning.noteNames;
    const rows = [];

    for (let i = 0; i < this.n; i++) {
      for (let j = 0; j < this.n; j++) {
        if (i === j) continue;
        const ic = this._intervals[i][j];
        if (nearestJustInterval(ic) !== intervalName) continue;
        let dev = Math.abs(ic - justC);
        dev = Math.min(dev, Math.abs(ic - (justC + 1200)), Math.abs(ic - (justC - 1200)));
        if (dev >= lo && dev < hi) {
          rows.push([noteNames[i], noteNames[j], ic, ic - justC]);
        }
      }
    }
    rows.sort((a, b) => Math.abs(a[3]) - Math.abs(b[3]));
    return rows;
  }

  chordDrilldown(chordName, threshold, excludeBelow = null) {
    const pcs       = this.tuning.pitchClasses;
    const noteNames = this.tuning.noteNames;
    const intervals = CHORD_DEFINITIONS[chordName];
    const result    = [];

    for (let rootIdx = 0; rootIdx < this.n; rootIdx++) {
      const rootPc  = pcs[rootIdx];
      const degRows = [];
      let passes    = true;
      let maxDist   = 0.0;

      for (const [targetCents, label] of intervals) {
        const needed  = mod(rootPc + targetCents, 1200);
        const bestPc  = pcs.reduce((bpc, pc) => {
          const dNew = Math.min(Math.abs(pc - needed),
                                Math.abs(pc - needed + 1200),
                                Math.abs(pc - needed - 1200));
          const dOld = Math.min(Math.abs(bpc - needed),
                                Math.abs(bpc - needed + 1200),
                                Math.abs(bpc - needed - 1200));
          return dNew < dOld ? pc : bpc;
        });
        const dist = Math.min(Math.abs(bestPc - needed),
                              Math.abs(bestPc - needed + 1200),
                              Math.abs(bestPc - needed - 1200));
        if (dist > threshold) { passes = false; break; }
        maxDist = Math.max(maxDist, dist);
        const actual = mod(bestPc - rootPc, 1200);
        degRows.push([label, actual, actual - targetCents]);
      }

      if (passes) {
        if (excludeBelow === null || maxDist >= excludeBelow) {
          result.push([noteNames[rootIdx], degRows]);
        }
      }
    }
    return result;
  }
}
// ─────────────────────────────────────────────
// OVERLAY TONE RESOLVER
// ─────────────────────────────────────────────

/**
 * Resolves which notes and lines to draw for a chord/scale overlay.
 *
 * @param {TuningSystem} tuning
 * @param {'chord'|'scale'} mode
 * @param {string} type   - chord name (key of CHORD_DEFINITIONS) or
 *                          mode name (key of HEPTATONIC_MODES)
 * @param {number} rootIdx - index into tuning.noteNames / pitchClasses
 *
 * @returns {{
 *   rootIdx:     number,
 *   toneIndices: number[],          // all participating note indices
 *   linePairs:   {ia:number, ib:number, devCents:number}[],
 * } | null}
 * Returns null if mode==='scale' and tuning.n !== 12.
 */
export function resolveOverlayTones(tuning, mode, type, rootIdx) {
  const pcs = tuning.pitchClasses;
  const n   = tuning.n;
  rootIdx   = mod(rootIdx, n);
  const rootPc = pcs[rootIdx];

  // ── Helper: find the index in pcs closest to a target pitch class ──────
  function closestIdx(target) {
    let best = 0, bestDist = Infinity;
    for (let k = 0; k < n; k++) {
      const d = Math.min(
        Math.abs(pcs[k] - target),
        Math.abs(pcs[k] - target + 1200),
        Math.abs(pcs[k] - target - 1200),
      );
      if (d < bestDist) { bestDist = d; best = k; }
    }
    return best;
  }

  // ── Helper: deviation of an actual interval from its nearest just target ─
  function deviationCents(ic) {
    const nearest = nearestJustInterval(ic);
    const justC   = JUST_INTERVALS[nearest];
    return Math.min(
      Math.abs(ic - justC),
      Math.abs(ic - justC + 1200),
      Math.abs(ic - justC - 1200),
    );
  }

  if (mode === 'chord') {
    const intervals = CHORD_DEFINITIONS[type];
    if (!intervals) return null;

    // Collect tone indices: root + one index per chord degree
    const toneIndices = [rootIdx];
    for (const [targetCents] of intervals) {
      const needed = mod(rootPc + targetCents, 1200);
      toneIndices.push(closestIdx(needed));
    }

    // All unique pairs among tone indices
    const linePairs = [];
    const seen = new Set();
    for (let a = 0; a < toneIndices.length; a++) {
      for (let b = a + 1; b < toneIndices.length; b++) {
        const ia = toneIndices[a], ib = toneIndices[b];
        const key = `${Math.min(ia,ib)}-${Math.max(ia,ib)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ic = Math.min(
          mod(pcs[ib] - pcs[ia], 1200),
          mod(pcs[ia] - pcs[ib], 1200),
        );
        linePairs.push({ ia, ib, devCents: deviationCents(ic) });
      }
    }

    return { rootIdx, toneIndices, linePairs };
  }

  if (mode === 'scale') {
    if (n !== 12) return null;
    const steps = HEPTATONIC_MODES[type];
    if (!steps) return null;

    // Build ordered tone indices walking up the scale
    const toneIndices = [rootIdx];
    let acc = 0.0;
    for (let k = 0; k < steps.length - 1; k++) {
      acc += steps[k];
      toneIndices.push(closestIdx(mod(rootPc + acc, 1200)));
    }

    // Sort by ascending pitch class distance from root (matches Python)
    const sorted = [...toneIndices].sort(
      (a, b) => mod(pcs[a] - rootPc, 1200) - mod(pcs[b] - rootPc, 1200)
    );

    // Consecutive step pairs only (including closing wrap back to root)
    const linePairs = [];
    for (let k = 0; k < sorted.length; k++) {
      const ia = sorted[k];
      const ib = sorted[(k + 1) % sorted.length];
      const ic = mod(pcs[ib] - pcs[ia], 1200);
      // Closing step wraps: interval will be small (near 0) — correct behaviour
      linePairs.push({ ia, ib, devCents: deviationCents(ic) });
    }

    return { rootIdx, toneIndices: sorted, linePairs };
  }

  return null;
}