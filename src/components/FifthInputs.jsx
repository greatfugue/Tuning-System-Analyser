import { useEffect, useRef } from 'react';
import { parseFifthInput, getNoteNames } from '../tuning';

export default function FifthInputs({ n, fifths, onChange, onStatus, onRender }) {
  const noteNames = getNoteNames(n);

  // ── Listen for the render trigger from the top-level button ──
  useEffect(() => {
    function handler() { attemptRender(); }
    window.addEventListener('cof-render', handler);
    return () => window.removeEventListener('cof-render', handler);
  });

  function updateFifth(i, val) {
    const next = [...fifths];
    next[i] = val;
    onChange(next);
  }

  function attemptRender() {
    const sizes = [];
    for (let i = 0; i < n; i++) {
      const raw = (fifths[i] || '').trim();
      if (!raw) {
        onStatus(`Fifth ${i + 1} is empty.`);
        return;
      }
      try {
        sizes.push(parseFifthInput(raw));
      } catch (e) {
        onStatus(`Fifth ${i + 1}: ${e.message}`);
        return;
      }
    }
    onRender(sizes);
  }

  return (
    <div style={{
      flex:      1,
      overflowY: 'auto',
      padding:   '0 16px',
      minHeight: 0,
    }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{
          display:       'flex',
          alignItems:    'center',
          gap:           8,
          marginBottom:  3,
        }}>
          <span style={{
            width:      56,
            fontSize:   9,
            color:      'var(--fg-dim)',
            fontFamily: 'var(--sans)',
            flexShrink: 0,
          }}>
            {noteNames[i]}→{noteNames[(i + 1) % n]}
          </span>
          <input
            type="text"
            value={fifths[i] || ''}
            onChange={e => updateFifth(i, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') attemptRender(); }}
            style={{
              flex:         1,
              height:       26,
              background:   'var(--card)',
              color:        'var(--fg)',
              fontSize:     10,
              fontFamily:   'var(--mono)',
              padding:      '0 6px',
              borderRadius: 4,
            }}
          />
        </div>
      ))}
    </div>
  );
}