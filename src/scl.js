// src/scl.js
// Ports load_scl_file() from COPNew.py.
// Takes the text content of a .scl file as a string.
// Returns { description, n, fifthSizes, warning }

/**
 * Parse the text content of a Scala .scl file.
 * @param {string} text - full file contents as a string
 * @returns {{ description: string, n: number, fifthSizes: number[], warning: string|null }}
 */
export function parseSclString(text) {
  // Strip comment lines (start with '!') and blank lines
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('!'));

  if (lines.length < 2) {
    throw new Error('SCL file too short — missing description or pitch count.');
  }

  const description = lines[0];
  const n = parseInt(lines[1], 10);
  if (isNaN(n) || n < 2) {
    throw new Error(`Invalid pitch count: '${lines[1]}'`);
  }

  // Parse n degree lines (each is either a ratio "a/b" or a cents value "x.")
  const degreesCents = [0.0];
  for (let k = 0; k < n; k++) {
    const line = lines[2 + k];
    if (line === undefined) {
      throw new Error(`Expected ${n} pitch degrees but file ended early.`);
    }
    const token = line.split(/\s+/)[0];

    if (token.includes('.')) {
      // Cents value — contains a decimal point
      const val = parseFloat(token);
      if (isNaN(val)) throw new Error(`Cannot parse degree: '${token}'`);
      degreesCents.push(val);
    } else if (token.includes('/')) {
      // Ratio — integer/integer, no decimal point
      const parts = token.split('/');
      const num = parseInt(parts[0], 10);
      const den = parseInt(parts[1], 10);
      if (isNaN(num) || isNaN(den) || den === 0) {
        throw new Error(`Cannot parse ratio: '${token}'`);
      }
      degreesCents.push(1200 * Math.log2(num / den));
    } else {
      // Plain integer ratio — treat as num/1
      const val = parseInt(token, 10);
      if (isNaN(val)) throw new Error(`Cannot parse degree: '${token}'`);
      degreesCents.push(1200 * Math.log2(val));
    }
  }

  // Pitch classes = all degrees except the closing octave (last entry = 1200¢)
  // degreesCents[0] = 0 (unison), degreesCents[n] = octave
  // pitch_classes in Python = degreesCents[:-1] = indices 0..n-1
  const pitchClasses = degreesCents.slice(0, n);

  if (pitchClasses.length < 2) {
    throw new Error('SCL file must contain at least 2 pitch degrees.');
  }

  // Find the generator: pitch class closest to a pure P5 (701.9550¢)
  const targetFifth = 1200 * Math.log2(3 / 2);
  let generator = pitchClasses[1];
  let bestDist = Math.abs(pitchClasses[1] - targetFifth);
  for (let k = 2; k < pitchClasses.length; k++) {
    const dist = Math.abs(pitchClasses[k] - targetFifth);
    if (dist < bestDist) {
      bestDist = dist;
      generator = pitchClasses[k];
    }
  }

  // Warning if generator is far from a pure fifth
  let warning = null;
  const deviationFromFifth = Math.abs(generator - targetFifth);
  if (deviationFromFifth > 60) {
    warning = `Warning: detected generator ${generator.toFixed(1)}¢ is ` +
              `${deviationFromFifth.toFixed(0)}¢ from a pure fifth. ` +
              `Circle-of-fifths layout may be misleading.`;
  }

  // Walk the circle of fifths to order pitches
  const circleDegrees = [0.0];
  const visitedIndices = new Set([0]);
  let current = 0.0;

  for (let step = 0; step < n - 1; step++) {
    current = ((current + generator) % 1200 + 1200) % 1200;
    let bestIdx = null;
    let bestDistCircle = Infinity;
    for (let k = 0; k < pitchClasses.length; k++) {
      if (visitedIndices.has(k)) continue;
      const dist = Math.abs(pitchClasses[k] - current);
      if (dist < bestDistCircle) {
        bestDistCircle = dist;
        bestIdx = k;
      }
    }
    if (bestIdx === null) break;
    circleDegrees.push(pitchClasses[bestIdx]);
    visitedIndices.add(bestIdx);
  }

  // Compute fifth sizes between consecutive circle positions
  const fifthSizes = [];
  for (let i = 0; i < n; i++) {
    const a = circleDegrees[i];
    const b = circleDegrees[(i + 1) % n];
    const fifth = ((b - a) % 1200 + 1200) % 1200;
    fifthSizes.push(fifth);
  }

  // Warn if fewer fifths resolved than expected
  if (circleDegrees.length < n) {
    const extra = `Warning: SCL declared ${n} pitches but only ` +
                  `${circleDegrees.length} could be resolved.`;
    warning = warning ? warning + ' ' + extra : extra;
  }

  return { description, n, fifthSizes, warning };
}