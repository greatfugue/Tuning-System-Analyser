import { useState, useCallback, useEffect, useRef } from 'react';
import LeftPanel    from './components/LeftPanel';
import CirclePanel  from './components/CirclePanel';
import RightSidebar from './components/RightSidebar';
import TuningStats  from './components/TuningStats';
import { resolveOverlayTones } from './tuning';
import './App.css';

const LEFT_WIDTH  = 340;
const RIGHT_WIDTH = 270;

const MONO = "'Courier New', monospace";
const SANS = 'Helvetica, Arial, sans-serif';

const TC = {
  bg:    '#1e1e2e',
  fg:    '#e0e0f0',
  rough: '#ff5555',
  pure:  '#50fa7b',
  sep:   '#3a3a50',
  card:  '#313145',
};

function getAnalysisLines(tuning, hoveredIdx, activeSteps) {
  if (!tuning) return [['Render a tuning system to begin.', 'normal']];

  if (hoveredIdx !== null) {
    return tuning.tooltipLines(hoveredIdx);
  }

  const activeStepNums = [];
  for (const [step, on] of activeSteps.entries()) {
    if (on) activeStepNums.push(step);
  }

  if (activeStepNums.length === 1) {
    return tuning.stepAnalysisLines(activeStepNums[0]);
  }

  if (activeStepNums.length === 0) {
    return [['Hover over a note, or toggle one interval class.', 'normal']];
  }

  return [
    [`${activeStepNums.length} interval classes shown.`, 'normal'],
    ['Toggle just one to see deviation analysis,', 'normal'],
    ['or hover a note for its intervals.', 'normal'],
  ];
}

function tagStyle(tag) {
  switch (tag) {
    case 'header': return { color: TC.fg,    fontWeight: 'bold' };
    case 'rough':  return { color: TC.rough                     };
    case 'pure':   return { color: TC.pure                      };
    default:       return { color: '#888899'                    };
  }
}

export default function App() {
  const [tuning,       setTuning]       = useState(null);
  const [activeSteps,  setActiveSteps]  = useState(new Map());
  const [hoveredIdx,   setHoveredIdx]   = useState(null);
  const [overlay,      setOverlay]      = useState({
    active:  false,
    mode:    'chord',
    type:    'Major',
    rootIdx: 0,
  });
  const [showStats,     setShowStats]     = useState(false);
  const [showFsOverlay, setShowFsOverlay] = useState(false);

  const analysisLines = getAnalysisLines(tuning, hoveredIdx, activeSteps);
  const fsSnapshotRef = useRef(analysisLines);
  if (!showFsOverlay) {
    fsSnapshotRef.current = analysisLines;
  }
  function handleTuningChange(t) {
    setTuning(prev => {
      if (!prev || prev.n !== t.n) {
        setActiveSteps(new Map());
      }
      return t;
    });
    setHoveredIdx(null);
  }

  function handleStepToggle(step, val) {
    setActiveSteps(prev => new Map(prev).set(step, val));
  }

  function handleStepsReset() {
    setActiveSteps(new Map());
  }

  function handleStepsAll(n) {
    const m = new Map();
    for (let s = 1; s < n; s++) m.set(s, true);
    setActiveSteps(m);
  }

  function handleStepsClear(n) {
    const m = new Map();
    for (let s = 1; s < n; s++) m.set(s, false);
    setActiveSteps(m);
  }

  const handleOverlayChange = useCallback((patch) => {
    setOverlay(prev => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    function handleKey(e) {
      // ignore if focus is in an input/textarea
      const tag  = document.activeElement?.tagName;
      const type = document.activeElement?.type;
      if ((tag === 'INPUT' && type !== 'checkbox') || tag === 'TEXTAREA') return;

      if (e.key === 'f' || e.key === 'F') {
        setShowFsOverlay(prev => !prev);
        return;
      }
      if (e.key === 'Escape') {
        setShowFsOverlay(false);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        setOverlay(prev => {
          if (!prev.active || !tuning) return prev;
          const n   = tuning.n;
          const dir = e.key === 'ArrowLeft' ? -1 : +1;
          return { ...prev, rootIdx: ((prev.rootIdx + dir) % n + n) % n };
        });
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [tuning]);

  const overlayData = overlay.active && tuning
    ? resolveOverlayTones(tuning, overlay.mode, overlay.type, overlay.rootIdx)
    : null;

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'row',
      height:        '100%',
      width:         '100%',
      overflow:      'hidden',
      background:    TC.bg,
    }}>

      {/* ── Left panel ───────────────────────────────────── */}
      <div style={{
        width:       LEFT_WIDTH,
        minWidth:    LEFT_WIDTH,
        height:      '100%',
        overflowY:   'auto',
        borderRight: '1px solid var(--sep)',
      }}>
        <LeftPanel
          tuning={tuning}
          onTuningChange={handleTuningChange}
          activeSteps={activeSteps}
          onStepToggle={handleStepToggle}
          onStepsReset={handleStepsReset}
          onStepsAll={handleStepsAll}
          onStepsClear={handleStepsClear}
          hoveredIdx={hoveredIdx}
          onOpenStats={() => setShowStats(true)}
          analysisLines={analysisLines}
        />
      </div>

      {/* ── Centre panel (circle) ────────────────────────── */}
      <div style={{
        flex:       1,
        height:     '100%',
        background: TC.bg,
        overflow:   'hidden',
      }}>
        <CirclePanel
          tuning={tuning}
          activeSteps={activeSteps}
          hoveredIdx={hoveredIdx}
          onHoverChange={setHoveredIdx}
          overlayData={overlayData}
        />
      </div>

      {/* ── Right sidebar ─────────────────────────────────── */}
      <div style={{
        width:      RIGHT_WIDTH,
        minWidth:   RIGHT_WIDTH,
        height:     '100%',
        borderLeft: '1px solid var(--sep)',
        background: TC.bg,
        overflowY:  'auto',
      }}>
        <RightSidebar
          tuning={tuning}
          overlay={overlay}
          onOverlayChange={handleOverlayChange}
        />
      </div>

      {/* ── Tuning Stats modal ───────────────────────────── */}
      {showStats && tuning && (
        <TuningStats
          tuning={tuning}
          onClose={() => setShowStats(false)}
        />
      )}

      {/* ── Fullscreen analysis overlay (F key) ──────────── */}
      {showFsOverlay && (
        <div
          onClick={() => setShowFsOverlay(false)}
          style={{
            position:       'fixed',
            inset:          0,
            background:     'rgba(30,30,46,0.97)',
            zIndex:         300,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '48px 24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width:     '100%',
              maxWidth:  860,
              maxHeight: '80vh',
              overflowY: 'auto',
              background: TC.card,
              borderRadius: 8,
              padding:   '36px 44px',
              boxSizing: 'border-box',
            }}
          >
            {fsSnapshotRef.current.map(([text, tag], i) => (
              <div key={i} style={{
                ...tagStyle(tag),
                fontFamily: MONO,
                fontSize:   18,
                lineHeight: 1.7,
                whiteSpace: 'pre',
              }}>
                {text}
              </div>
            ))}
          </div>
          <div style={{
            marginTop:  20,
            fontFamily: SANS,
            fontSize:   12,
            color:      '#888899',
          }}>
            Press F or Esc to close · click outside to close
          </div>
        </div>
      )}

    </div>
  );
}