/**
 * S1 Test Suite — Circle of Fifths maths module
 * Run with:  node test_tuning.mjs
 *
 * No test framework needed — plain Node.js.
 * Each test prints PASS or FAIL with details.
 */

import {
  JUST_INTERVALS,
  HEPTATONIC_MODES,
  CHORD_DEFINITIONS,
  NOTE_NAMES_12,
  NOTE_NAMES_7,
  nearestJustInterval,
  computePitchClasses,
  intervalCentsBetween,
  colorFromDeviation,
  parseFifthInput,
  getNoteNames,
  TuningSystem,
  ScaleAnalyser,
} from './tuning.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function approxEq(a, b, tol = 1e-4) {
  return Math.abs(a - b) < tol;
}

function assertApprox(label, got, expected, tol = 1e-4) {
  if (approxEq(got, expected, tol)) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}`);
    console.log(`        expected ${expected}, got ${got}`);
    failed++;
  }
}

function assertEqual(label, got, expected) {
  if (got === expected) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}`);
    console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
    failed++;
  }
}

function assertArrayApprox(label, got, expected, tol = 1e-4) {
  if (got.length !== expected.length) {
    console.log(`  FAIL  ${label} (length mismatch: ${got.length} vs ${expected.length})`);
    failed++;
    return;
  }
  const allOk = got.every((v, i) => approxEq(v, expected[i], tol));
  if (allOk) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}`);
    got.forEach((v, i) => {
      if (!approxEq(v, expected[i], tol))
        console.log(`        index ${i}: expected ${expected[i]}, got ${v}`);
    });
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ─────────────────────────────────`);
}

// ── 1. JUST_INTERVALS values ──────────────────────────────────────────────────
// Reference values computed from Python: 1200*np.log2(ratio)

section('JUST_INTERVALS — 15 values vs Python reference');

const justRef = {
  'm2':   111.73128526977776,
  'M2s':  182.40370172718575,
  'M2L':  203.91000173077483,
  'm3':   315.64128700055443,
  'M3':   386.3137138648348,
  'P4':   498.04499913461267,
  'TT+':  590.2237155956298,
  'TT-':  609.7762844043702,
  'P5':   701.9550008653874,
  'm6':   813.6862861351652,
  'M6':   884.3587127264073,
  'm7s':  996.0899982692252,
  'm7L':  1017.5962864728297,
  'M7':   1088.2687138302225,
  'd7':   925.417571404943,    // 128/75
};

for (const [key, ref] of Object.entries(justRef)) {
  assertApprox(`JUST_INTERVALS['${key}']`, JUST_INTERVALS[key], ref);
}

// ── 2. HEPTATONIC_MODES step sums ────────────────────────────────────────────

section('HEPTATONIC_MODES — all 9 modes sum to 1200¢');

for (const [name, steps] of Object.entries(HEPTATONIC_MODES)) {
  const sum = steps.reduce((a, b) => a + b, 0);
  assertApprox(`${name} steps sum`, sum, 1200.0, 1e-6);
}

// ── 3. computePitchClasses ────────────────────────────────────────────────────

section('computePitchClasses');

// 12-TET: all fifths = 700¢
const tet12 = computePitchClasses(Array(12).fill(700));
assertApprox('12-TET [1] = 700.0000', tet12[1], 700.0);
assertApprox('12-TET [0] = 0.0', tet12[0], 0.0);
// After 12 × 700 = 8400; 8400 mod 1200 = 0 — so the 12th pitch class
// (never stored) would be 0, confirming the circle closes.
// The stored array has exactly 12 entries.
assertEqual('12-TET length', tet12.length, 12);

// Pure P5 system, 7 notes
const p5seven = computePitchClasses(Array(7).fill(1200 * Math.log2(3/2)));
assertApprox('pure-P5 7-note [1]', p5seven[1], 1200 * Math.log2(3/2));

// ── 4. intervalCentsBetween ───────────────────────────────────────────────────

section('intervalCentsBetween');

const pcs = [0, 200, 400, 500, 700, 900, 1100];
assertApprox('0→400 = 400', intervalCentsBetween(pcs, 0, 2), 400.0);
assertApprox('400→0 = 800 (directed wrap)', intervalCentsBetween(pcs, 2, 0), 800.0);
assertApprox('1100→0 = 100 (wrap)', intervalCentsBetween(pcs, 6, 0), 100.0);

// ── 5. nearestJustInterval ────────────────────────────────────────────────────

section('nearestJustInterval');

assertEqual('700c → P5',  nearestJustInterval(700),  'P5');
assertEqual('400c → M3',  nearestJustInterval(400),  'M3');
assertEqual('0.1c → m2',  nearestJustInterval(0.1),  'm2');   // no threshold
assertEqual('1100c → M7', nearestJustInterval(1100), 'M7');
assertEqual('600c → TT+ or TT-', // 600 is equidistant; just check it returns one
  ['TT+','TT-'].includes(nearestJustInterval(600)), true);

// ── 6. colorFromDeviation ─────────────────────────────────────────────────────

section('colorFromDeviation — anchor points');

assertArrayApprox('dev=0  → green',    colorFromDeviation(0),  [0.00, 0.78, 0.27]);
assertArrayApprox('dev=5  → yel-grn', colorFromDeviation(5),  [0.55, 0.78, 0.00]);
assertArrayApprox('dev=12 → orange',  colorFromDeviation(12), [0.90, 0.55, 0.00]);
assertArrayApprox('dev=20 → red-org', colorFromDeviation(20), [0.90, 0.15, 0.00]);
assertArrayApprox('dev=40 → red',     colorFromDeviation(40), [1.00, 0.00, 0.00]);
assertArrayApprox('dev=99 → red (clamp)', colorFromDeviation(99), [1.00, 0.00, 0.00]);
assertArrayApprox('dev=-5 → green (clamp)', colorFromDeviation(-5), [0.00, 0.78, 0.27]);

// midpoint interpolation check: dev=8.5 is midway between 5 and 12
const mid512 = colorFromDeviation(8.5);
assertApprox('dev=8.5 r midpoint', mid512[0], (0.55 + 0.90) / 2);

// ── 7. parseFifthInput ────────────────────────────────────────────────────────

section('parseFifthInput');

assertApprox('plain "700"',     parseFifthInput('700'),       700.0);
assertApprox('"3/2"',           parseFifthInput('3/2'),       1200*Math.log2(3/2));
assertApprox('"2^(1/12)"',      parseFifthInput('2^(1/12)'),  1200*Math.log2(Math.pow(2, 1/12)));
assertApprox('"701.955"',       parseFifthInput('701.955'),   701.955);

// ── 8. TuningSystem.fromFifthSizes — 12-TET ───────────────────────────────────

section('TuningSystem — 12-TET');

const ts12 = TuningSystem.fromFifthSizes(Array(12).fill(700));
assertEqual('n = 12',              ts12.n, 12);
assertEqual('noteNames[0]',        ts12.noteNames[0], 'C');
assertApprox('pitchClasses[0]',    ts12.pitchClasses[0], 0.0);
assertApprox('pitchClasses[1]',    ts12.pitchClasses[1], 700.0);
// intervalCents: C→E = 4 steps of 700 mod 1200
assertApprox('C→E (4 fifths)',     ts12.intervalCents(0, 4), mod(4*700, 1200));

function mod(a, b) { return ((a % b) + b) % b; }

// ── 9. TuningSystem — pure P5 ────────────────────────────────────────────────

section('TuningSystem — pure P5 (3/2)');

const pureP5 = 1200 * Math.log2(3/2);
const ts12p  = TuningSystem.fromFifthSizes(Array(12).fill(pureP5));
assertApprox('pitchClasses[1] = pure P5', ts12p.pitchClasses[1], pureP5);

// ── 10. ScaleAnalyser — intervalPurityTable spot checks ──────────────────────

section('ScaleAnalyser.intervalPurityTable — 12-TET spot checks');

const sa12 = new ScaleAnalyser(ts12);
const table = sa12.intervalPurityTable();

// In 12-TET all P5s are 700¢, deviation from 701.955 ≈ 1.955¢ → pure (<5¢)
const p5row = table.find(r => r[0] === 'P5');
if (p5row) {
  // 12 directed P5s (each note has one P5 above it): all should be pure
  assertApprox('12-TET P5 pure count = 12', p5row[2], 12);
  assertEqual ('12-TET P5 rough count = 0', p5row[5], 0);
} else {
  console.log('  FAIL  P5 row not found in table'); failed++;
}

// ── 11. ScaleAnalyser — heptatonicCensus ─────────────────────────────────────

section('ScaleAnalyser.heptatonicCensus — 12-TET totals = 252 per mode');

const census = sa12.heptatonicCensus();
for (const [name, counts] of Object.entries(census)) {
  const total = counts.pure + counts.subtle + counts.noticeable + counts.rough;
  assertEqual(`${name} total pairs`, total, 252);
}

// ── 12. ScaleAnalyser — chordCensus sanity ───────────────────────────────────

section('ScaleAnalyser.chordCensus — 12-TET Major chord = 12 strict');

const cc = sa12.chordCensus();
// In 12-TET, every root can form a major chord within 20¢ (the TET M3 is ~14¢ off pure)
// Strict (≤12¢): M3 deviation is ~13.7¢ so strict should be 0; loose 12
assertEqual('12-TET Major strict = 0',  cc['Major'][0], 0);
assertEqual('12-TET Major loose  = 12', cc['Major'][1], 12);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n════════════════════════════════════════`);
console.log(`  ${passed} passed,  ${failed} failed`);
console.log(`════════════════════════════════════════`);
if (failed > 0) process.exit(1);
