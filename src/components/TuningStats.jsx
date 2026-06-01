import { useEffect, useMemo, useState } from 'react';
import {
  ScaleAnalyser, JUST_INTERVALS, JUST_RATIOS_DISPLAY,
  CHORD_DEFINITIONS, HEPTATONIC_MODES, colorFromDeviation, rgbToHex,
} from '../tuning';

// ── Colour helpers ────────────────────────────────────────────────

const CARD   = { r: 0x31, g: 0x31, b: 0x45 };
const BG_HEX = '#1e1e2e';

function blendCell(devMid, count, total) {
  if (count === 0 || total === 0) return { bg: BG_HEX, fg: 'var(--sep)' };
  const alpha = 0.18 + 0.45 * (count / total);
  const [r, g, b] = colorFromDeviation(devMid);
  const bg = rgbToHex([
    (1 - alpha) * CARD.r / 255 + alpha * r,
    (1 - alpha) * CARD.g / 255 + alpha * g,
    (1 - alpha) * CARD.b / 255 + alpha * b,
  ]);
  return { bg, fg: 'var(--fg)' };
}

function blendChordCell(count, n) {
  if (count === 0) return { bg: BG_HEX, fg: 'var(--sep)' };
  const ratio = count / n;
  const dev   = (1 - ratio) * 40;
  const alpha = 0.12 + 0.4 * ratio;
  const [r, g, b] = colorFromDeviation(dev);
  const bg = rgbToHex([
    (1 - alpha) * CARD.r / 255 + alpha * r,
    (1 - alpha) * CARD.g / 255 + alpha * g,
    (1 - alpha) * CARD.b / 255 + alpha * b,
  ]);
  return { bg, fg: 'var(--fg)' };
}

const BANDS = [
  { key: 'pure',       label: '0–5¢\nPure',      devMid: 2.5,  bandLabel: 'Pure (0–5¢)'        },
  { key: 'subtle',     label: '5–12¢\nSubtle',    devMid: 8.5,  bandLabel: 'Subtle (5–12¢)'     },
  { key: 'noticeable', label: '12–20¢\nNotice',   devMid: 16.0, bandLabel: 'Noticeable (12–20¢)' },
  { key: 'rough',      label: '20¢+\nRough',      devMid: 30.0, bandLabel: 'Rough (20¢+)'       },
];

const COL_NAME  = 90;
const COL_RATIO = 64;
const COL_BAND  = 72;
const MONO      = "'Courier New', monospace";
const SANS      = 'Helvetica, Arial, sans-serif';

// ── Shared sub-components ─────────────────────────────────────────

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--fg)', fontFamily: SANS }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 10, color: 'var(--fg-dim)', fontFamily: SANS, marginTop: 3, maxWidth: 700 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function Sep() {
  return <div style={{ height: 1, background: 'var(--sep)', margin: '20px 0' }} />;
}

function ColHeader({ children, width, align = 'center' }) {
  return (
    <div style={{
      width, minWidth: width, textAlign: align,
      fontSize: 9, fontWeight: 'bold', color: 'var(--fg-dim)',
      fontFamily: SANS, whiteSpace: 'pre-line', lineHeight: 1.3,
      paddingBottom: 4,
    }}>
      {children}
    </div>
  );
}

function CellCount({ count, devMid, total, onClick }) {
  const { bg, fg } = blendCell(devMid, count, total);
  const clickable   = count > 0 && !!onClick;
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        width: COL_BAND, minWidth: COL_BAND,
        textAlign: 'center',
        background: bg, color: fg,
        fontFamily: MONO, fontSize: 10,
        fontWeight: count > 0 ? 'bold' : 'normal',
        padding: '2px 0', borderRadius: 3,
        cursor: clickable ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      {count}
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--panel)', color: 'var(--fg)',
        fontSize: 11, fontFamily: SANS,
        padding: '4px 12px', borderRadius: 4,
        cursor: 'pointer', marginBottom: 16,
      }}
    >
      ← Back
    </button>
  );
}

// ── Interval Census ───────────────────────────────────────────────

function IntervalCensus({ analyser, onDrilldown }) {
  const rows       = useMemo(() => analyser.intervalPurityTable(), [analyser]);
  const n          = analyser.n;
  const nIntervals = n * (n - 1);

  const totals = BANDS.map((b, bi) =>
    rows.reduce((s, row) => s + row[2 + bi], 0)
  );

  return (
    <div>
      <SectionTitle
        title="Interval Census"
        subtitle={
          `All ${nIntervals} directed intervals (${n} notes × ${n - 1} steps), ` +
          `each assigned to its nearest just target. ` +
          `Columns are disjoint deviation bands. Click a count to see details.`
        }
      />
      <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
        <ColHeader width={COL_NAME}  align="left">Interval</ColHeader>
        <ColHeader width={COL_RATIO} align="left">Ratio</ColHeader>
        {BANDS.map(b => <ColHeader key={b.key} width={COL_BAND}>{b.label}</ColHeader>)}
      </div>
      {rows.map(([name, ratio, pure, subtle, noticeable, rough]) => {
        const counts = [pure, subtle, noticeable, rough];
        const total  = pure + subtle + noticeable + rough;
        return (
          <div key={name} style={{ display: 'flex', gap: 4, marginBottom: 2, alignItems: 'center' }}>
            <div style={{ width: COL_NAME, minWidth: COL_NAME, fontFamily: MONO, fontSize: 10, color: 'var(--fg)' }}>{name}</div>
            <div style={{ width: COL_RATIO, minWidth: COL_RATIO, fontFamily: MONO, fontSize: 10, color: 'var(--fg-dim)' }}>{ratio}</div>
            {BANDS.map((b, bi) => (
              <CellCount key={b.key} count={counts[bi]} devMid={b.devMid} total={total}
                onClick={() => onDrilldown(name, b.key, b.bandLabel)} />
            ))}
          </div>
        );
      })}
      <div style={{ height: 1, background: 'var(--sep)', margin: '6px 0' }} />
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <div style={{ width: COL_NAME, minWidth: COL_NAME, fontFamily: SANS, fontSize: 10, fontWeight: 'bold', color: 'var(--fg)' }}>Total</div>
        <div style={{ width: COL_RATIO, minWidth: COL_RATIO }} />
        {totals.map((cnt, bi) => {
          const pct = nIntervals > 0 ? (100 * cnt / nIntervals).toFixed(0) : 0;
          return (
            <div key={bi} style={{ width: COL_BAND, minWidth: COL_BAND, textAlign: 'center', fontFamily: MONO, fontSize: 9, fontWeight: 'bold', color: 'var(--fg)' }}>
              {cnt}<br /><span style={{ fontSize: 8, color: 'var(--fg-dim)' }}>({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Interval Drilldown ────────────────────────────────────────────

function IntervalDrilldown({ analyser, intervalName, bandKey, bandLabel, onBack }) {
  const rows  = useMemo(() => analyser.intervalDrilldown(intervalName, bandKey), [analyser, intervalName, bandKey]);
  const justC = JUST_INTERVALS[intervalName];
  const ratio = JUST_RATIOS_DISPLAY[intervalName];
  return (
    <div>
      <BackButton onClick={onBack} />
      <SectionTitle
        title={`${intervalName}  ·  ${bandLabel}`}
        subtitle={`Just target: ${intervalName} (${ratio}) = ${justC.toFixed(4)}¢  ·  ${rows.length} instance${rows.length !== 1 ? 's' : ''}, sorted by absolute deviation`}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        {[['From', 48], ['To', 48], ['Cents', 80], ['Deviation', 90]].map(([lbl, w]) => (
          <div key={lbl} style={{ width: w, minWidth: w, fontSize: 9, fontWeight: 'bold', color: 'var(--fg-dim)', fontFamily: SANS }}>{lbl}</div>
        ))}
      </div>
      {rows.length === 0 && <div style={{ color: 'var(--fg-dim)', fontFamily: MONO, fontSize: 10 }}>(none)</div>}
      {rows.map(([from, to, ic, dev], i) => {
        const absDev = Math.abs(dev);
        const color  = absDev >= 20 ? 'var(--rough)' : absDev < 5 ? 'var(--pure)' : 'var(--fg-dim)';
        const sign   = dev >= 0 ? '+' : '';
        return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2, alignItems: 'center' }}>
            <div style={{ width: 48, minWidth: 48, fontFamily: MONO, fontSize: 10, color: 'var(--fg)' }}>{from}</div>
            <div style={{ width: 48, minWidth: 48, fontFamily: MONO, fontSize: 10, color: 'var(--fg)' }}>→{to}</div>
            <div style={{ width: 80, minWidth: 80, fontFamily: MONO, fontSize: 10, color: 'var(--fg-dim)' }}>{ic.toFixed(2)}¢</div>
            <div style={{ width: 90, minWidth: 90, fontFamily: MONO, fontSize: 10, color }}>{sign}{dev.toFixed(2)}¢</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Chord Census ──────────────────────────────────────────────────

const CHORD_NAMES = Object.keys(CHORD_DEFINITIONS);

function ChordCensus({ analyser, onDrilldown }) {
  const n         = analyser.n;
  const chordData = useMemo(() => analyser.chordCensus(), [analyser]);
  const [visible, setVisible] = useState(() =>
    Object.fromEntries(CHORD_NAMES.map(name => [name, true]))
  );

  function toggleChord(name) {
    setVisible(prev => ({ ...prev, [name]: !prev[name] }));
  }

  const visibleNames = CHORD_NAMES.filter(name => visible[name]);
  const strictTotal  = visibleNames.reduce((s, name) => s + chordData[name][0], 0);
  const looseTotal   = visibleNames.reduce((s, name) => s + chordData[name][1], 0);
  const maxPossible  = n * visibleNames.length;

  const COL_CHORD = 110;
  const COL_IVALS = 180;
  const COL_CNT   = 90;

  return (
    <div>
      <SectionTitle
        title="Chord Census"
        subtitle={
          `Counts roots (out of ${n}) where all chord intervals match just targets within threshold. ` +
          `Strict ≤ 12¢, Loose 12–20¢ (disjoint). Click a count to see which roots pass.`
        }
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', marginBottom: 10 }}>
        <span style={{ fontSize: 9, color: 'var(--fg-dim)', fontFamily: SANS, alignSelf: 'center' }}>Show:</span>
        {CHORD_NAMES.map(name => (
          <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: visible[name] ? 'var(--fg)' : 'var(--fg-dim)', fontFamily: SANS, cursor: 'pointer' }}>
            <input type="checkbox" checked={visible[name]} onChange={() => toggleChord(name)}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
            {name}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
        <ColHeader width={COL_CHORD} align="left">Chord</ColHeader>
        <ColHeader width={COL_IVALS} align="left">Intervals</ColHeader>
        <ColHeader width={COL_CNT}>{`Strict ≤12¢\n/ ${n}`}</ColHeader>
        <ColHeader width={COL_CNT}>{`Loose 12–20¢\n/ ${n}`}</ColHeader>
      </div>
      {visibleNames.map(name => {
        const [strictC, looseC] = chordData[name];
        const ivals = CHORD_DEFINITIONS[name].map(([, lbl]) => lbl).join(' + ');
        return (
          <div key={name} style={{ display: 'flex', gap: 4, marginBottom: 2, alignItems: 'center' }}>
            <div style={{ width: COL_CHORD, minWidth: COL_CHORD, fontFamily: MONO, fontSize: 10, fontWeight: 'bold', color: 'var(--fg)' }}>{name}</div>
            <div style={{ width: COL_IVALS, minWidth: COL_IVALS, fontFamily: MONO, fontSize: 9, color: 'var(--fg-dim)' }}>{ivals}</div>
            {[
              { count: strictC, band: 'strict' },
              { count: looseC,  band: 'loose'  },
            ].map(({ count, band }) => {
              const { bg, fg } = blendChordCell(count, n);
              const clickable   = count > 0 && !!onDrilldown;
              return (
                <div key={band}
                  onClick={clickable ? () => onDrilldown(name, band) : undefined}
                  style={{
                    width: COL_CNT, minWidth: COL_CNT, textAlign: 'center',
                    background: bg, color: fg,
                    fontFamily: MONO, fontSize: 10, fontWeight: 'bold',
                    padding: '2px 0', borderRadius: 3,
                    cursor: clickable ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                >
                  {count} / {n}
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{ height: 1, background: 'var(--sep)', margin: '6px 0' }} />
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <div style={{ width: COL_CHORD, minWidth: COL_CHORD, fontFamily: SANS, fontSize: 10, fontWeight: 'bold', color: 'var(--fg)' }}>Total</div>
        <div style={{ width: COL_IVALS, minWidth: COL_IVALS }} />
        {[strictTotal, looseTotal].map((cnt, i) => {
          const pct = maxPossible > 0 ? (100 * cnt / maxPossible).toFixed(0) : 0;
          return (
            <div key={i} style={{ width: COL_CNT, minWidth: COL_CNT, textAlign: 'center', fontFamily: MONO, fontSize: 9, fontWeight: 'bold', color: 'var(--fg)' }}>
              {cnt}<br /><span style={{ fontSize: 8, color: 'var(--fg-dim)' }}>({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Chord Drilldown ───────────────────────────────────────────────

function ChordDrilldown({ analyser, chordName, band, onBack }) {
  const isLoose   = band === 'loose';
  const threshold = isLoose ? ScaleAnalyser.LOOSE : ScaleAnalyser.STRICT;
  const excl      = isLoose ? ScaleAnalyser.STRICT : null;
  const bandLabel = isLoose ? 'Loose (12–20¢)' : 'Strict (≤12¢)';

  const rows = useMemo(
    () => analyser.chordDrilldown(chordName, threshold, excl),
    [analyser, chordName, threshold, excl]
  );

  const ivals = CHORD_DEFINITIONS[chordName].map(([, lbl]) => lbl).join(' + ');

  return (
    <div>
      <BackButton onClick={onBack} />
      <SectionTitle
        title={`${chordName}  ·  ${bandLabel}`}
        subtitle={`${ivals}  ·  ${rows.length} root${rows.length !== 1 ? 's' : ''} pass`}
      />

      {rows.length === 0 && (
        <div style={{ color: 'var(--fg-dim)', fontFamily: MONO, fontSize: 10 }}>(none)</div>
      )}

      {rows.map(([rootName, degRows]) => (
        <div key={rootName} style={{ marginBottom: 12 }}>
          {/* Root header */}
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 'bold', color: 'var(--accent)', marginBottom: 3 }}>
            {rootName}
          </div>
          {/* Degree rows */}
          {degRows.map(([label, actual, dev]) => {
            const absDev = Math.abs(dev);
            const color  = absDev >= 20 ? 'var(--rough)' : absDev < 5 ? 'var(--pure)' : 'var(--fg-dim)';
            const sign   = dev >= 0 ? '+' : '';
            return (
              <div key={label} style={{ display: 'flex', gap: 12, marginBottom: 1, paddingLeft: 12 }}>
                <div style={{ width: 48, minWidth: 48, fontFamily: MONO, fontSize: 10, color: 'var(--fg)' }}>{label}</div>
                <div style={{ width: 72, minWidth: 72, fontFamily: MONO, fontSize: 10, color: 'var(--fg-dim)' }}>{actual.toFixed(2)}¢</div>
                <div style={{ width: 80, minWidth: 80, fontFamily: MONO, fontSize: 10, color }}>{sign}{dev.toFixed(2)}¢</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}


// ── Scale Census ──────────────────────────────────────────────────

const MODE_NAMES   = Object.keys(HEPTATONIC_MODES);
const TOTAL_PAIRS  = 252; // 21 pairs × 12 roots

function ScaleCensus({ analyser, onDrilldown }) {
  const result = useMemo(() => analyser.heptatonicCensus(), [analyser]);

  if (result === null) {
    return (
      <div>
        <SectionTitle title="Scale Census" />
        <div style={{ color: 'var(--fg-dim)', fontFamily: MONO, fontSize: 10 }}>
          Scale census requires a 12-tone system. Current system has {analyser.n} notes.
        </div>
      </div>
    );
  }

  const COL_MODE = 120;
  const nModes   = MODE_NAMES.length;
  const grandTotal = TOTAL_PAIRS * nModes;

  const totals = BANDS.map(b =>
    MODE_NAMES.reduce((s, name) => s + result[name][b.key], 0)
  );

  return (
    <div>
      <SectionTitle
        title="Scale Census"
        subtitle={
          `All 21 undirected pairwise intervals among the 7 scale tones, ` +
          `measured across all 12 roots (${TOTAL_PAIRS} pairs total per mode). ` +
          `Click any count to drill down by root.`
        }
      />

      {/* Column headers */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
        <ColHeader width={COL_MODE} align="left">Scale / Mode</ColHeader>
        {BANDS.map(b => <ColHeader key={b.key} width={COL_BAND}>{b.label}</ColHeader>)}
      </div>

      {/* Data rows */}
      {MODE_NAMES.map((name, mi) => {
        const counts = BANDS.map(b => result[name][b.key]);
        // Separator before Harm. minor (index 7)
        return (
          <div key={name}>
            {name === 'Harm. minor' && (
              <div style={{ height: 1, background: 'var(--sep)', margin: '4px 0' }} />
            )}
            <div style={{ display: 'flex', gap: 4, marginBottom: 2, alignItems: 'center' }}>
              <div style={{ width: COL_MODE, minWidth: COL_MODE, fontFamily: MONO, fontSize: 10, fontWeight: 'bold', color: 'var(--fg)' }}>
                {name}
              </div>
              {BANDS.map((b, bi) => {
                const cnt = counts[bi];
                const { bg, fg } = blendCell(b.devMid, cnt, TOTAL_PAIRS);
                const clickable   = cnt > 0 && !!onDrilldown;
                return (
                  <div key={b.key}
                    onClick={clickable ? () => onDrilldown(name, b.bandLabel) : undefined}
                    style={{
                      width: COL_BAND, minWidth: COL_BAND,
                      textAlign: 'center',
                      background: bg, color: fg,
                      fontFamily: MONO, fontSize: 10,
                      fontWeight: cnt > 0 ? 'bold' : 'normal',
                      padding: '2px 0', borderRadius: 3,
                      cursor: clickable ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    {cnt}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Separator + total row */}
      <div style={{ height: 1, background: 'var(--sep)', margin: '6px 0' }} />
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <div style={{ width: COL_MODE, minWidth: COL_MODE, fontFamily: SANS, fontSize: 10, fontWeight: 'bold', color: 'var(--fg)' }}>
          Total
        </div>
        {totals.map((cnt, bi) => {
          const pct = grandTotal > 0 ? (100 * cnt / grandTotal).toFixed(0) : 0;
          return (
            <div key={bi} style={{ width: COL_BAND, minWidth: COL_BAND, textAlign: 'center', fontFamily: MONO, fontSize: 9, fontWeight: 'bold', color: 'var(--fg)' }}>
              {cnt}<br /><span style={{ fontSize: 8, color: 'var(--fg-dim)' }}>({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ── Scale Level-1 Drilldown (per-root summary) ────────────────────

function ScaleLevel1({ analyser, modeName, bandLabel, onBack, onRoot }) {
  const rootRows = useMemo(
    () => analyser.heptatonicRootPairs(modeName),
    [analyser, modeName]
  );

  const COL_ROOT = 60;

  return (
    <div>
      <BackButton onClick={onBack} />
      <SectionTitle
        title={`${modeName}  ·  all roots`}
        subtitle={`Pairwise interval purity per root (21 pairs each). Click a root name to inspect all pairs.`}
      />

      {/* Column headers */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
        <ColHeader width={COL_ROOT} align="left">Root</ColHeader>
        {BANDS.map(b => <ColHeader key={b.key} width={COL_BAND}>{b.label}</ColHeader>)}
      </div>

      {/* One row per root */}
      {rootRows.map(row => {
        const counts = BANDS.map(b => row[b.key]);
        return (
          <div key={row.rootName} style={{ display: 'flex', gap: 4, marginBottom: 2, alignItems: 'center' }}>
            {/* Clickable root name */}
            <div
              onClick={() => onRoot(row.rootName, row.pairs)}
              style={{
                width: COL_ROOT, minWidth: COL_ROOT,
                fontFamily: MONO, fontSize: 10, fontWeight: 'bold',
                color: 'var(--accent)', cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              {row.rootName}
            </div>
            {/* Count cells — display only, not clickable at this level */}
            {BANDS.map((b, bi) => {
              const cnt       = counts[bi];
              const { bg, fg } = blendCell(b.devMid, cnt, 21);
              return (
                <div key={b.key} style={{
                  width: COL_BAND, minWidth: COL_BAND,
                  textAlign: 'center',
                  background: bg, color: fg,
                  fontFamily: MONO, fontSize: 10,
                  fontWeight: cnt > 0 ? 'bold' : 'normal',
                  padding: '2px 0', borderRadius: 3,
                }}>
                  {cnt}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
// ── Scale Level-2 Drilldown (all pairs for one root) ─────────────

function ScaleLevel2({ modeName, rootName, pairs, onBack }) {
  return (
    <div>
      <BackButton onClick={onBack} />
      <SectionTitle
        title={`${modeName}  ·  ${rootName}`}
        subtitle={`All 21 undirected pairs, sorted worst deviation first.`}
      />

      {/* Column headers */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        {[['Pair', 90], ['Cents', 80], ['~Just', 60], ['Deviation', 90]].map(([lbl, w]) => (
          <div key={lbl} style={{ width: w, minWidth: w, fontSize: 9, fontWeight: 'bold', color: 'var(--fg-dim)', fontFamily: SANS }}>
            {lbl}
          </div>
        ))}
      </div>

      {pairs.map(([na, nb, ic, nearest, dev], i) => {
        const absDev = Math.abs(dev);
        const color  = absDev >= 20 ? 'var(--rough)' : absDev < 5 ? 'var(--pure)' : 'var(--fg-dim)';
        const sign   = dev >= 0 ? '+' : '';
        return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2, alignItems: 'center' }}>
            <div style={{ width: 90, minWidth: 90, fontFamily: MONO, fontSize: 10, color: 'var(--fg)' }}>
              {na}&lt;&gt;{nb}
            </div>
            <div style={{ width: 80, minWidth: 80, fontFamily: MONO, fontSize: 10, color: 'var(--fg-dim)' }}>
              {ic.toFixed(2)}¢
            </div>
            <div style={{ width: 60, minWidth: 60, fontFamily: MONO, fontSize: 10, color: 'var(--fg-dim)' }}>
              ~{nearest}
            </div>
            <div style={{ width: 90, minWidth: 90, fontFamily: MONO, fontSize: 10, color }}>
              {sign}{dev.toFixed(2)}¢
            </div>
          </div>
        );
      })}
    </div>
  );
}
// ── Main modal ────────────────────────────────────────────────────

export default function TuningStats({ tuning, onClose }) {
  const analyser = useMemo(() => new ScaleAnalyser(tuning), [tuning]);
  const [view, setView] = useState({ kind: 'main' });

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') {
        if (view.kind !== 'main') setView({ kind: 'main' });
        else onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, view.kind]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      background: 'var(--bg)', zIndex: 100,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: '1px solid var(--sep)', flexShrink: 0,
      }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--fg)', fontFamily: SANS }}>Tuning Stats</span>
          <span style={{ fontSize: 11, color: 'var(--fg-dim)', fontFamily: SANS, marginLeft: 12 }}>{tuning.n}-note system</span>
          <span style={{ fontSize: 10, color: 'var(--fg-dim)', fontFamily: SANS, marginLeft: 16 }}>
            Deviation thresholds: strict ≤ 12¢  ·  loose 12–20¢  (disjoint bands)
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'var(--panel)', color: 'var(--fg)', fontSize: 13, fontFamily: SANS, padding: '4px 14px', borderRadius: 4, cursor: 'pointer' }}>
          Close ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        {view.kind === 'main' && (
          <>
            <IntervalCensus analyser={analyser} onDrilldown={(name, bk, bl) => setView({ kind: 'interval-drilldown', intervalName: name, bandKey: bk, bandLabel: bl })} />
            <Sep />
            <ChordCensus analyser={analyser} onDrilldown={(name, band) => setView({ kind: 'chord-drilldown', chordName: name, band })} />
            <Sep />
            <ScaleCensus analyser={analyser} onDrilldown={(name, bandLabel) => setView({ kind: 'scale-level1', modeName: name, bandLabel })} />
          </>
        )}
        {view.kind === 'interval-drilldown' && (
          <IntervalDrilldown analyser={analyser} intervalName={view.intervalName} bandKey={view.bandKey} bandLabel={view.bandLabel} onBack={() => setView({ kind: 'main' })} />
        )}
        {view.kind === 'chord-drilldown' && (
          <ChordDrilldown analyser={analyser} chordName={view.chordName} band={view.band} onBack={() => setView({ kind: 'main' })} />
        )}
        {view.kind === 'scale-level1' && (
  <ScaleLevel1
    analyser={analyser}
    modeName={view.modeName}
    bandLabel={view.bandLabel}
    onBack={() => setView({ kind: 'main' })}
    onRoot={(rootName, pairs) => setView({ kind: 'scale-level2', modeName: view.modeName, rootName, pairs })}
  />
)}
{view.kind === 'scale-level2' && (
  <ScaleLevel2
    modeName={view.modeName}
    rootName={view.rootName}
    pairs={view.pairs}
    onBack={() => setView({ kind: 'scale-level1', modeName: view.modeName, bandLabel: view.bandLabel })}
  />
)}
      </div>
    </div>
  );
}