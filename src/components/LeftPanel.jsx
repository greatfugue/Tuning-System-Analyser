import { useState, useRef } from 'react';
import FifthInputs from './FifthInputs';
import { TuningSystem, parseFifthInput } from '../tuning';
import { parseSclString } from '../scl';
import { listPresets, loadPreset, savePreset } from '../presets';

const MIN_N = 3;
const MAX_N = 53;
const COLS  = 5;

export default function LeftPanel({
  tuning,
  onTuningChange,
  activeSteps,
  onStepToggle,
  onStepsReset,
  onStepsAll,
  onStepsClear,
  hoveredIdx,
  onOpenStats,
  analysisLines,
}) {
  const [n, setN]                     = useState(12);
  const [fifths, setFifths]           = useState(Array(12).fill(''));
  const [status, setStatus]           = useState(
    'Enter 12 fifth size(s) then click Render Tuning.');
  const [sclFilename, setSclFilename] = useState('');
  const [presetNames, setPresetNames] = useState(() => listPresets());
  const [selectedPreset, setSelectedPreset] = useState('');

  const fileInputRef = useRef(null);



  // ── Input handlers ─────────────────────────────────────
  function adjN(delta) {
    setN(prev => Math.max(MIN_N, Math.min(MAX_N, prev + delta)));
  }

  function applyN() {
    setFifths(Array(n).fill(''));
    setStatus(`Enter ${n} fifth size(s) then click Render Tuning.`);
    onTuningChange(null);
    onStepsReset();
  }

  function handleRender(parsedSizes) {
    try {
      const t = TuningSystem.fromFifthSizes(parsedSizes);
      onTuningChange(t);
      setStatus(`${t.n}-note system rendered  ·  hover notes to inspect intervals`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  }

  function handleSclImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const { description, n: newN, fifthSizes, warning } =
          parseSclString(evt.target.result);
        setN(newN);
        setFifths(fifthSizes.map(s => s.toFixed(4)));
        setSclFilename(file.name);
        if (warning) {
          setStatus(warning);
        } else {
          const wolf = Math.max(...fifthSizes);
          setStatus(`Loaded: ${description} | ${newN} notes | wolf fifth ≈ ${wolf.toFixed(2)}¢`);
        }
        const t = TuningSystem.fromFifthSizes(fifthSizes);
        onTuningChange(t);
      } catch (err) {
        setStatus(`Import error: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleLoadPreset() {
    if (!selectedPreset) return;
    try {
      const { n: pn, entries } = loadPreset(selectedPreset);
      setN(pn);
      setFifths(entries);
      const sizes = entries.map((s, i) => {
        if (!s || !s.trim()) throw new Error(`Entry ${i + 1} is empty.`);
        return parseFifthInput(s);
      });
      const t = TuningSystem.fromFifthSizes(sizes);
      onTuningChange(t);
      setStatus(`Loaded preset '${selectedPreset}'.`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  }

  function handleSavePreset() {
    const name = window.prompt('Enter a name for this preset:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    savePreset(trimmed, n, fifths.map(f => f || ''));
    const updated = listPresets();
    setPresetNames(updated);
    setSelectedPreset(trimmed);
    setStatus(`Preset '${trimmed}' saved.`);
  }

  // ── Step toggle grid ───────────────────────────────────
  function renderStepToggles() {
    if (!tuning) return null;
    const steps = Array.from({ length: tuning.n - 1 }, (_, i) => i + 1);
    const rows  = [];
    for (let r = 0; r < Math.ceil(steps.length / COLS); r++) {
      rows.push(steps.slice(r * COLS, r * COLS + COLS));
    }
    return rows.map((row, ri) => (
      <div key={ri} style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
        {row.map(step => {
          const checked = activeSteps.get(step) || false;
          const label   = tuning.stepLabel(step);
          return (
            <label key={step} style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 9, color: checked ? 'var(--fg)' : '#b0b0c8',
              fontFamily: 'var(--mono)', cursor: 'pointer',
              width: 52, flexShrink: 0,
            }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={e => onStepToggle(step, e.target.checked)}
                style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              {label}
            </label>
          );
        })}
      </div>
    ));
  }

  // ── Tag → style ────────────────────────────────────────
  function tagStyle(tag) {
    switch (tag) {
      case 'header': return { color: 'var(--fg)',    fontWeight: 'bold' };
      case 'rough':  return { color: 'var(--rough)'                     };
      case 'pure':   return { color: 'var(--pure)'                      };
      default:       return { color: 'var(--fg-dim)'                    };
    }
  }

  // ── Render ─────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', padding: '0 0 16px 0',
      background: 'var(--bg)',
    }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ padding: '12px 16px 4px' }}>
        <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--fg)' }}>
          Circle of Fifths
        </div>
        <div style={{ fontSize: 10, color: 'var(--fg-dim)', marginTop: 2 }}>
          Interactive Tuning System Analyser
        </div>
      </div>

      <div className="sep" />

      {/* ── No. of Pitches ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--fg)' }}>No. of Pitches:</span>
        <Btn onClick={() => adjN(-1)}>−</Btn>
        <span style={{
          width: 28, textAlign: 'center',
          fontFamily: 'var(--mono)', fontWeight: 'bold',
          fontSize: 13, color: 'var(--fg)',
        }}>{n}</span>
        <Btn onClick={() => adjN(+1)}>+</Btn>
        <Btn onClick={applyN} style={{ width: 52 }}>Apply</Btn>
      </div>

      {/* ── SCL import ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px', gap: 8 }}>
        <input ref={fileInputRef} type="file" accept=".scl"
          style={{ display: 'none' }} onChange={handleSclImport} />
        <button
          onClick={() => fileInputRef.current.click()}
          style={{
            height: 30, padding: '0 12px',
            background: '#2d5a2d', color: '#e0ffe0',
            fontSize: 10, fontFamily: 'var(--sans)',
            borderRadius: 4, whiteSpace: 'nowrap',
          }}
        >
          Import .scl file
        </button>
        <span style={{
          fontSize: 9, color: 'var(--fg-dim)', fontFamily: 'var(--sans)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {sclFilename}
        </span>
      </div>

      {/* ── Presets ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px', gap: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--fg)', whiteSpace: 'nowrap' }}>Preset:</span>
        <select
          value={selectedPreset}
          onChange={e => setSelectedPreset(e.target.value)}
          style={{
            flex: 1, height: 28,
            background: 'var(--card)', color: 'var(--fg)',
            fontSize: 10, fontFamily: 'var(--sans)',
            borderRadius: 4, padding: '0 4px', minWidth: 0,
          }}
        >
          <option value="">— select —</option>
          {presetNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <Btn onClick={handleLoadPreset} style={{ width: 48 }}>Load</Btn>
        <Btn onClick={handleSavePreset} style={{ width: 48 }}>Save</Btn>
      </div>

      {/* ── Status bar ──────────────────────────────────── */}
      <div style={{
        margin: '6px 16px', padding: '4px 8px',
        background: 'var(--panel)', borderRadius: 4,
        fontSize: 9, fontFamily: 'var(--mono)',
        color: 'var(--fg-dim)', minHeight: 32, whiteSpace: 'pre-wrap',
      }}>
        {status}
      </div>

      {/* ── Fifth inputs ────────────────────────────────── */}
      <div style={{ padding: '0 16px 4px' }}>
        <div style={{ fontSize: 9, color: 'var(--fg-dim)', marginBottom: 4 }}>
          Fifth sizes (e.g. 3/2 · 701.955 · 5^(1/4)):
        </div>
      </div>

      <FifthInputs
        n={n} fifths={fifths}
        onChange={setFifths} onStatus={setStatus} onRender={handleRender}
      />

      <div className="sep" style={{ margin: '8px 16px' }} />

      {/* ── Render Tuning + Tuning Stats ────────────────── */}
      <div style={{ padding: '0 16px' }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('cof-render'))}
          style={{
            width: '100%', height: 38,
            background: 'var(--accent)', color: '#fff',
            fontSize: 13, fontWeight: 'bold',
            fontFamily: 'var(--sans)', borderRadius: 6, marginBottom: 6,
          }}
        >
          Render Tuning
        </button>
        <button
          disabled={!tuning}
          onClick={tuning ? onOpenStats : undefined}
          style={{
            width: '100%', height: 30,
            background: 'var(--panel)',
            color: tuning ? 'var(--fg)' : 'var(--fg-dim)',
            fontSize: 10, fontFamily: 'var(--sans)',
            borderRadius: 6, cursor: tuning ? 'pointer' : 'default',
            marginBottom: 8,
          }}
        >
          Tuning Stats…
        </button>
      </div>

      <div className="sep" style={{ margin: '0 16px 8px' }} />

      {/* ── Render Intervals ────────────────────────────── */}
      {tuning && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--fg)', marginBottom: 6 }}>
            Render Intervals
          </div>
          <div style={{ marginBottom: 4 }}>
            {renderStepToggles()}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <Btn onClick={() => onStepsAll(tuning.n)}  style={{ width: 48, fontSize: 10 }}>All</Btn>
            <Btn onClick={() => onStepsClear(tuning.n)} style={{ width: 48, fontSize: 10 }}>Clear</Btn>
          </div>
        </div>
      )}

      <div className="sep" style={{ margin: '8px 16px' }} />

      {/* ── Analysis panel ──────────────────────────────── */}
      <div style={{ padding: '0 16px', flex: 1, minHeight: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--fg)', marginBottom: 4 }}>
          Interval Analysis
        </div>
        <div style={{
          minHeight: 210,
          overflow: 'hidden',
          background: 'var(--bg)',
          borderRadius: 4,
          fontFamily: 'var(--mono)',
          fontSize: 10,
          lineHeight: 1.55,
          whiteSpace: 'pre',
        }}>
          {analysisLines.map(([text, tag], i) => (
            <div key={i} style={tagStyle(tag)}>{text}</div>
          ))}
        </div>
      </div>

    </div>
  );
}

function Btn({ onClick, children, style = {} }) {
  return (
    <button onClick={onClick} style={{
      width: 28, height: 28,
      background: 'var(--panel)', color: 'var(--fg)',
      fontSize: 13, borderRadius: 4,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...style,
    }}>
      {children}
    </button>
  );
}