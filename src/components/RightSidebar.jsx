import { useMemo } from 'react';
import { CHORD_DEFINITIONS, HEPTATONIC_MODES, JUST_INTERVALS,
         JUST_RATIOS_DISPLAY, nearestJustInterval,
         resolveOverlayTones } from '../tuning';

const CHORD_NAMES = Object.keys(CHORD_DEFINITIONS);
const MODE_NAMES  = Object.keys(HEPTATONIC_MODES);
const MONO = "'Courier New', monospace";
const SANS = 'Helvetica, Arial, sans-serif';

// ── Tag colour helper ─────────────────────────────────────────────
function tagColor(devCents) {
  if (devCents >= 12) return 'var(--rough)';
  if (devCents <   5) return 'var(--pure)';
  return 'var(--fg-dim)';
}

// ── Detail lines builder ──────────────────────────────────────────
function buildDetailLines(tuning, overlay) {
  if (!tuning || !overlay.active) {
    return [{ text: 'Select a chord or scale,', color: 'var(--fg-dim)' },
            { text: 'then press Render.',        color: 'var(--fg-dim)' }];
  }

  const resolved = resolveOverlayTones(
    tuning, overlay.mode, overlay.type, overlay.rootIdx);
  if (!resolved) {
    return [{ text: 'Scale view requires a 12-tone system.', color: 'var(--fg-dim)' }];
  }

  const pcs       = tuning.pitchClasses;
  const names     = tuning.noteNames;
  const rootName  = names[resolved.rootIdx];
  const lines     = [{ text: `── ${rootName} ──`, color: 'var(--fg)' }];

  if (overlay.mode === 'chord') {
    // All unique pairs among tone indices
    const idxs = resolved.toneIndices;
    const seen = new Set();
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const ia = idxs[a], ib = idxs[b];
        const key = `${Math.min(ia,ib)}-${Math.max(ia,ib)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ic = Math.min(
          ((pcs[ib] - pcs[ia]) % 1200 + 1200) % 1200,
          ((pcs[ia] - pcs[ib]) % 1200 + 1200) % 1200,
        );
        const nearest = nearestJustInterval(ic);
        const justC   = JUST_INTERVALS[nearest];
        const dev     = ic - justC;
        const devAbs  = Math.min(Math.abs(dev),
          Math.abs(ic - justC + 1200), Math.abs(ic - justC - 1200));
        const sign    = dev >= 0 ? '+' : '';
        lines.push({
          text:  `  ${names[ia]}<>${names[ib]}  ${ic.toFixed(1)}c  ~${nearest}  ${sign}${dev.toFixed(1)}c`,
          color: tagColor(devAbs),
        });
      }
    }
  } else {
    // Consecutive scale steps
    for (const { ia, ib } of resolved.linePairs) {
      const ic = ((pcs[ib] - pcs[ia]) % 1200 + 1200) % 1200;
      const nearest = nearestJustInterval(ic);
      const justC   = JUST_INTERVALS[nearest];
      const dev     = ic - justC;
      const devAbs  = Math.min(Math.abs(dev),
        Math.abs(ic - justC + 1200), Math.abs(ic - justC - 1200));
      const sign    = dev >= 0 ? '+' : '';
      lines.push({
        text:  `  ${names[ia]}->${names[ib]}  ${ic.toFixed(1)}c  ~${nearest}  ${sign}${dev.toFixed(1)}c`,
        color: tagColor(devAbs),
      });
    }
  }

  return lines;
}

// ── Main export ───────────────────────────────────────────────────
export default function RightSidebar({ tuning, overlay, onOverlayChange }) {
  const typeList   = overlay.mode === 'chord' ? CHORD_NAMES : MODE_NAMES;
  const scaleWarn  = overlay.mode === 'scale' && tuning && tuning.n !== 12;
  const rootName   = tuning && overlay.active
    ? tuning.noteNames[((overlay.rootIdx % tuning.n) + tuning.n) % tuning.n]
    : '—';

  const detailLines = useMemo(
    () => buildDetailLines(tuning, overlay),
    [tuning, overlay]
  );

  function set(patch) { onOverlayChange(patch); }

  function handleModeChange(mode) {
    // Reset type to first option for the new mode
    const newType = mode === 'chord' ? CHORD_NAMES[0] : MODE_NAMES[0];
    set({ mode, type: newType, rootIdx: 0 });
  }

  function handleTypeChange(e) {
    set({ type: e.target.value, rootIdx: 0 });
  }

  function cycleRoot(dir) {
    if (!tuning || !overlay.active) return;
    const n = tuning.n;
    set({ rootIdx: ((overlay.rootIdx + dir) % n + n) % n });
  }

  function handleRender() {
    if (!tuning) return;
    set({ active: true });
  }

  function handleClear() {
    set({ active: false });
  }

  // Status line
  let statusText  = 'No overlay active.';
  let statusColor = 'var(--fg-dim)';
  if (overlay.active) {
    if (scaleWarn) {
      statusText  = '⚠ Scale view requires n = 12';
      statusColor = '#ffaa44';
    } else {
      statusText  = `Active · ${overlay.type}  root: ${rootName}`;
      statusColor = 'var(--accent)';
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', padding: '0 0 16px 0',
      background: 'var(--bg)', overflowY: 'auto',
    }}>

      {/* ── Title ───────────────────────────────────────── */}
      <div style={{ padding: '14px 14px 2px' }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--fg)', fontFamily: SANS }}>
          Render Chords / Scales
        </div>
        <div style={{ fontSize: 9, color: 'var(--fg-dim)', fontFamily: SANS, marginTop: 2 }}>
          Visualise chords and scales on the circle
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--sep)', margin: '8px 14px' }} />

      {/* ── Mode selector ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--fg)', fontFamily: SANS }}>Mode:</span>
        {['chord', 'scale'].map(m => (
          <label key={m} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10, color: 'var(--fg)', fontFamily: SANS, cursor: 'pointer',
          }}>
            <input type="radio" name="cv-mode"
              value={m} checked={overlay.mode === m}
              onChange={() => handleModeChange(m)}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </label>
        ))}
      </div>

      {/* ── Type dropdown ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--fg)', fontFamily: SANS, width: 36 }}>Type:</span>
        <select
          value={overlay.type}
          onChange={handleTypeChange}
          style={{
            flex: 1, height: 28,
            background: 'var(--card)', color: 'var(--fg)',
            fontSize: 10, fontFamily: SANS,
            borderRadius: 4, padding: '0 4px',
          }}
        >
          {typeList.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      <div style={{ height: 1, background: 'var(--sep)', margin: '4px 14px' }} />

      {/* ── Root navigator ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 14px', gap: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--fg)', fontFamily: SANS, width: 36 }}>Root:</span>
        <div style={{
          background: 'var(--card)', color: 'var(--fg)',
          fontFamily: MONO, fontSize: 12, fontWeight: 'bold',
          width: 40, textAlign: 'center', padding: '2px 0',
          borderRadius: 4,
        }}>
          {rootName}
        </div>
        {['◀', '▶'].map((sym, i) => (
          <button key={sym}
            onClick={() => cycleRoot(i === 0 ? -1 : +1)}
            disabled={!overlay.active}
            style={{
              width: 30, height: 28,
              background: 'var(--panel)', color: 'var(--fg)',
              fontSize: 13, borderRadius: 4,
              opacity: overlay.active ? 1 : 0.4,
              cursor: overlay.active ? 'pointer' : 'default',
            }}
          >
            {sym}
          </button>
        ))}
      </div>

      <div style={{ height: 1, background: 'var(--sep)', margin: '4px 14px' }} />

      {/* ── Render / Clear ───────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, padding: '6px 14px', alignItems: 'center' }}>
        <button
          onClick={handleRender}
          disabled={!tuning}
          style={{
            height: 34, padding: '0 18px',
            background: tuning ? 'var(--accent)' : 'var(--panel)',
            color: '#fff', fontSize: 11, fontWeight: 'bold',
            fontFamily: SANS, borderRadius: 4,
            cursor: tuning ? 'pointer' : 'default',
            opacity: tuning ? 1 : 0.5,
          }}
        >
          Render
        </button>
        <button
          onClick={handleClear}
          disabled={!overlay.active}
          style={{
            height: 34, padding: '0 14px',
            background: 'var(--panel)', color: 'var(--fg)',
            fontSize: 10, fontFamily: SANS, borderRadius: 4,
            opacity: overlay.active ? 1 : 0.4,
            cursor: overlay.active ? 'pointer' : 'default',
          }}
        >
          Clear
        </button>
      </div>

      {/* ── Status ──────────────────────────────────────── */}
      <div style={{
        padding: '0 14px 6px',
        fontSize: 9, fontFamily: SANS,
        color: statusColor,
      }}>
        {statusText}
      </div>

      <div style={{ height: 1, background: 'var(--sep)', margin: '4px 14px' }} />

      {/* ── Deviation detail ─────────────────────────────── */}
      <div style={{ padding: '6px 14px 2px' }}>
        <div style={{ fontSize: 9, fontWeight: 'bold', color: 'var(--fg)', fontFamily: SANS, marginBottom: 4 }}>
          Interval Deviations (From Just)
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 9, lineHeight: 1.6,
          whiteSpace: 'pre',
        }}>
          {detailLines.map((ln, i) => (
            <div key={i} style={{ color: ln.color }}>{ln.text}</div>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--sep)', margin: '8px 14px' }} />

      {/* ── Keyboard shortcuts ───────────────────────────── */}
      <div style={{ padding: '0 14px' }}>
        <div style={{ fontSize: 9, fontWeight: 'bold', color: 'var(--fg)', fontFamily: SANS, marginBottom: 4 }}>
          Keyboard Shortcuts
        </div>
        {[['← / →', 'Cycle chord/scale root']].map(([key, desc]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{
              background: 'var(--card)', color: 'var(--fg)',
              fontFamily: MONO, fontSize: 9,
              padding: '1px 6px', borderRadius: 3,
              whiteSpace: 'nowrap',
            }}>
              {key}
            </div>
            <div style={{ fontSize: 9, color: 'var(--fg-dim)', fontFamily: SANS }}>{desc}</div>
          </div>
        ))}
      </div>

    </div>
  );
}