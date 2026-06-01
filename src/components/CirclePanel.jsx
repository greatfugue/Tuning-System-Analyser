import { useMemo, useRef, useCallback } from 'react';
import {
  formatFifthLabel, formatIntervalLabel,
  colorFromDeviation, rgbToHex,
  nearestJustInterval, JUST_INTERVALS,
} from '../tuning';

const R       = 1.0;
const NODE_R  = 0.095;
const LABEL_R = 1.22;
const OFFSET  = 0.04;
const GAP     = 0.22;
const HIT_R   = 0.13;
const VB      = '-1.55 -1.55 3.10 3.10';

const C = {
  bg:     '#1e1e2e',
  card:   '#313145',
  fg:     '#e0e0f0',
  fgDim:  '#888899',
  accent: '#5e9bff',
  sep:    '#3a3a50',
};

function angleToXY(angle, radius = R) {
  return [radius * Math.cos(angle), -radius * Math.sin(angle)];
}

function mod(a, b) { return ((a % b) + b) % b; }

// ── Static sub-components ────────────────────────────────────────

function Ring() {
  return (
    <circle cx={0} cy={0} r={R}
      fill="none" stroke={C.sep} strokeWidth={0.012} />
  );
}

function ArcLabels({ tuning }) {
  return tuning.angles.map((a1, i) => {
    const a2   = tuning.angles[(i + 1) % tuning.n];
    const diff = ((a1 - a2) + 2 * Math.PI) % (2 * Math.PI);
    const mid  = a1 - diff / 2;
    const [lx, ly] = angleToXY(mid, LABEL_R);
    return (
      <text key={i} x={lx} y={ly}
        textAnchor="middle" dominantBaseline="middle"
        fontFamily="Helvetica, Arial, sans-serif"
        fontSize={0.080} fill={C.fgDim}>
        {formatFifthLabel(tuning.fifthSizes[i])}
      </text>
    );
  });
}

function Nodes({ tuning, hoveredIdx }) {
  return tuning.angles.map((angle, i) => {
    const [nx, ny] = angleToXY(angle);
    const name     = tuning.noteNames[i];
    const hovered  = hoveredIdx === i;
    const fs       = name.length === 1 ? 0.090 : 0.075;
    return (
      <g key={i}>
        <circle cx={nx} cy={ny} r={NODE_R}
          fill={hovered ? C.accent : C.card}
          stroke={C.fg} strokeWidth={0.018} />
        <text x={nx} y={ny}
          textAnchor="middle" dominantBaseline="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize={fs} fontWeight="bold"
          fill={hovered ? C.bg : C.fg}
          style={{ pointerEvents: 'none' }}>
          {name}
        </text>
      </g>
    );
  });
}

function TitleAndAttribution({ n }) {
  return (
    <>
      <text x={0} y={-1.32}
        textAnchor="middle" dominantBaseline="middle"
        fontFamily="Helvetica, Arial, sans-serif"
        fontSize={0.10} fill={C.fgDim}>
        {`${n}-Note Tuning System  ·  Circle of Fifths (clockwise)`}
      </text>
      <text x={0} y={1.46}
        textAnchor="middle" dominantBaseline="middle"
        fontFamily="Helvetica, Arial, sans-serif"
        fontSize={0.065} fill={C.sep}>
        Analytical tool developed with Claude (Anthropic), 2026
      </text>
    </>
  );
}

// ── Legend ───────────────────────────────────────────────────────

const LEGEND_ZONES = [
  { lo: 0,  hi: 5,  name: 'Pure',       cents: '0–5c',   label: '< JND'        },
  { lo: 5,  hi: 12, name: 'Subtle',     cents: '5–12c',  label: 'slow beats'   },
  { lo: 12, hi: 20, name: 'Noticeable', cents: '12–20c', label: 'noticeable'   },
  { lo: 20, hi: 40, name: 'Rough',      cents: '20c+',   label: 'rapid / rough'},
];
const MAX_DEV = 40;

function LegendBar() {
  const steps = 300;
  const barW  = 2.0;
  const barH  = 0.18;
  const barY  = 0;
  const stepW = barW / steps;

  const strips = Array.from({ length: steps }, (_, k) => {
    const dev = (k / steps) * MAX_DEV;
    const hex = rgbToHex(colorFromDeviation(dev));
    return (
      <rect key={k} x={k * stepW} y={barY}
        width={stepW + 0.002} height={barH} fill={hex} />
    );
  });

  const zoneDividers = LEGEND_ZONES.slice(1).map(z => {
    const xPos = (z.lo / MAX_DEV) * barW;
    return (
      <line key={z.lo}
        x1={xPos} y1={barY} x2={xPos} y2={barY + barH}
        stroke="#1e1e2e" strokeWidth={0.010} />
    );
  });

  const zoneLabels = LEGEND_ZONES.map(z => {
    const mid = ((z.lo + z.hi) / 2 / MAX_DEV) * barW;
    return (
      <g key={z.name}>
        <text x={mid} y={barY - 0.110}
          textAnchor="middle" dominantBaseline="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize={0.075} fontWeight="bold" fill="#e0e0f0">
          {z.name}
        </text>
        <text x={mid} y={barY - 0.032}
          textAnchor="middle" dominantBaseline="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize={0.055} fill="#888899">
          {z.cents}
        </text>
        <text x={mid} y={barY + barH / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize={0.050} fontStyle="italic" fill="white" opacity={0.88}>
          {z.label}
        </text>
      </g>
    );
  });

  return <>{strips}{zoneDividers}{zoneLabels}</>;
}

// ── Interval line computation ────────────────────────────────────

function buildIntervalLines(tuning, activeSteps) {
  const n      = tuning.n;
  const angles = tuning.angles;
  const pcs    = tuning.pitchClasses;

  const activeList = [];
  for (const [step, on] of activeSteps.entries()) {
    if (!on) continue;
    const comp        = n - step;
    const compToggled = activeSteps.get(comp) === true && comp !== step;
    activeList.push({ step, compToggled });
  }

  const lines         = [];
  const pendingLabels = [];

  for (const { step, compToggled } of activeList) {
    const selfInverse = (n % 2 === 0 && step === n / 2);
    const useOffset   = selfInverse || compToggled;
    const offsetSign  = step <= n / 2 ? 1 : -1;
    const seen        = new Set();

    for (let i = 0; i < n; i++) {
      const j       = mod(i + step, n);
      const pairKey = `${Math.min(i,j)}-${Math.max(i,j)}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const ic      = mod(pcs[j] - pcs[i], 1200);
      const nearest = nearestJustInterval(ic);
      const dev     = Math.abs(ic - JUST_INTERVALS[nearest]);
      const col     = rgbToHex(colorFromDeviation(dev));

      const [x1, y1] = angleToXY(angles[i]);
      const [x2, y2] = angleToXY(angles[j]);

      const lo = i < j ? i : j;
      const hi = i < j ? j : i;
      const dx = angleToXY(angles[hi])[0] - angleToXY(angles[lo])[0];
      const dy = angleToXY(angles[hi])[1] - angleToXY(angles[lo])[1];
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len < 1e-6) continue;
      const ux = dx/len, uy = dy/len;
      const px = -uy,    py =  ux;

      if (selfInverse) {
        const icJI  = mod(pcs[i] - pcs[j], 1200);
        const devJI = Math.abs(icJI - JUST_INTERVALS[nearestJustInterval(icJI)]);
        const colJI = rgbToHex(colorFromDeviation(devJI));
        lines.push({ x1: x1+px*OFFSET, y1: y1+py*OFFSET,
                     x2: x2+px*OFFSET, y2: y2+py*OFFSET,
                     color: col, alpha: 0.55, lw: 1.5 });
        lines.push({ x1: x1-px*OFFSET, y1: y1-py*OFFSET,
                     x2: x2-px*OFFSET, y2: y2-py*OFFSET,
                     color: colJI, alpha: 0.55, lw: 1.5 });
        pendingLabels.push({
          x: x1+px*OFFSET+ux*GAP, y: y1+py*OFFSET+uy*GAP,
          nodeIdx: i, text: formatIntervalLabel(ic),
        });
        pendingLabels.push({
          x: x2-px*OFFSET-ux*GAP, y: y2-py*OFFSET-uy*GAP,
          nodeIdx: j, text: formatIntervalLabel(icJI),
        });
      } else {
        const ox = useOffset ? px*OFFSET*offsetSign : 0;
        const oy = useOffset ? py*OFFSET*offsetSign : 0;
        lines.push({ x1: x1+ox, y1: y1+oy, x2: x2+ox, y2: y2+oy,
                     color: col, alpha: 0.55, lw: 1.5 });
        const dirX = i < j ?  ux : -ux;
        const dirY = i < j ?  uy : -uy;
        pendingLabels.push({
          x: x1+ox+dirX*GAP, y: y1+oy+dirY*GAP,
          nodeIdx: i, text: formatIntervalLabel(ic),
        });
      }
    }
  }

  return { lines, pendingLabels };
}

/**
 * Build hover lines: all intervals from hoveredIdx, sorted by size.
 * These are drawn brighter and thicker than regular step lines.
 */
function buildHoverLines(tuning, hoveredIdx) {
  if (hoveredIdx === null) return { lines: [], pendingLabels: [] };

  const n      = tuning.n;
  const angles = tuning.angles;
  const pcs    = tuning.pitchClasses;
  const lines  = [];
  const pendingLabels = [];

  for (let step = 1; step < n; step++) {
    const j       = mod(hoveredIdx + step, n);
    const ic      = mod(pcs[j] - pcs[hoveredIdx], 1200);
    const nearest = nearestJustInterval(ic);
    const dev     = Math.abs(ic - JUST_INTERVALS[nearest]);
    const col     = rgbToHex(colorFromDeviation(dev));

    const [x1, y1] = angleToXY(angles[hoveredIdx]);
    const [x2, y2] = angleToXY(angles[j]);

    lines.push({ x1, y1, x2, y2, color: col, alpha: 0.95, lw: 2.2 });

    const dx  = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len < 1e-6) continue;
    const ux = dx/len, uy = dy/len;
    pendingLabels.push({
      x: x1 + ux*GAP, y: y1 + uy*GAP,
      nodeIdx: hoveredIdx,
      text: formatIntervalLabel(ic),
    });
  }

  return { lines, pendingLabels };
}

function resolveLabels(pendingLabels, angles) {
  const groups = new Map();
  for (const lbl of pendingLabels) {
    if (!groups.has(lbl.nodeIdx)) groups.set(lbl.nodeIdx, []);
    groups.get(lbl.nodeIdx).push({ ...lbl });
  }

  const resolved = [];
  for (const [nodeIdx, lbls] of groups.entries()) {
    const [nx, ny] = angleToXY(angles[nodeIdx]);
    lbls.sort((a, b) =>
      Math.atan2(a.y - ny, a.x - nx) - Math.atan2(b.y - ny, b.x - nx));

    const MIN_SEP = 0.35;
    for (let iter = 0; iter < 30; iter++) {
      let changed = false;
      for (let k = 0; k < lbls.length - 1; k++) {
        const angK  = Math.atan2(lbls[k].y   - ny, lbls[k].x   - nx);
        const angK1 = Math.atan2(lbls[k+1].y - ny, lbls[k+1].x - nx);
        let diff = angK1 - angK;
        while (diff >  Math.PI) diff -= 2*Math.PI;
        while (diff < -Math.PI) diff += 2*Math.PI;
        if (Math.abs(diff) < MIN_SEP) {
          const mid  = (angK + angK1) / 2;
          const half = MIN_SEP / 2;
          lbls[k].x   = nx + GAP * Math.cos(mid - half);
          lbls[k].y   = ny + GAP * Math.sin(mid - half);
          lbls[k+1].x = nx + GAP * Math.cos(mid + half);
          lbls[k+1].y = ny + GAP * Math.sin(mid + half);
          changed = true;
        }
      }
      if (!changed) break;
    }
    for (const lbl of lbls) resolved.push(lbl);
  }
  return resolved;
}

function LabelLayer({ labels, fontSize = 0.055, fontColor = C.fgDim }) {
  return labels.map((lbl, k) => {
    const charW = 0.028;
    const w     = lbl.text.length * charW;
    const h     = 0.065;
    return (
      <g key={k}>
        <rect x={lbl.x - w/2} y={lbl.y - h/2}
          width={w} height={h}
          fill={C.card} stroke={C.sep}
          strokeWidth={0.005} rx={0.010} opacity={0.9} />
        <text x={lbl.x} y={lbl.y}
          textAnchor="middle" dominantBaseline="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize={fontSize} fill={fontColor}>
          {lbl.text}
        </text>
      </g>
    );
  });
}

function LineLayer({ lines }) {
  return lines.map((ln, k) => (
    <line key={k}
      x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
      stroke={ln.color}
      strokeWidth={ln.lw * 0.012}
      opacity={ln.alpha}
      strokeLinecap="round" />
  ));
}
// ── Overlay layer ─────────────────────────────────────────────────

function OverlayLayer({ tuning, overlayData }) {
  if (!overlayData) return null;
  const { rootIdx, toneIndices, linePairs } = overlayData;
  const angles = tuning.angles;

  return (
    <>
      {/* Dashed coloured lines between tone pairs */}
      {linePairs.map(({ ia, ib, devCents }, k) => {
        const [x1, y1] = angleToXY(angles[ia]);
        const [x2, y2] = angleToXY(angles[ib]);
        const col = rgbToHex(colorFromDeviation(devCents));
        return (
          <line key={k}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={col} strokeWidth={0.031}
            strokeDasharray="0.06 0.04"
            strokeLinecap="round"
            opacity={0.90} />
        );
      })}

      {/* Tint non-root tone nodes */}
      {toneIndices.filter(i => i !== rootIdx).map((i, k) => {
        const [nx, ny] = angleToXY(angles[i]);
        return (
          <circle key={k} cx={nx} cy={ny} r={NODE_R}
            fill={C.accent} opacity={0.22} />
        );
      })}

      {/* Dashed ring around root */}
      {(() => {
        const [rx, ry] = angleToXY(angles[rootIdx]);
        return (
          <circle cx={rx} cy={ry} r={NODE_R + 0.018}
            fill="none" stroke={C.accent}
            strokeWidth={0.022} strokeDasharray="0.05 0.04" />
        );
      })()}
    </>
  );
}
// ── Main export ──────────────────────────────────────────────────

export default function CirclePanel({
  tuning,
  activeSteps   = new Map(),
  hoveredIdx    = null,
  onHoverChange = () => {},
  overlayData   = null,
}) {
  const svgRef = useRef(null);

  // Convert screen coords → SVG user coords
  const toSVGCoords = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt  = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: svgP.x, y: svgP.y };
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!tuning) return;
    const p = toSVGCoords(e.clientX, e.clientY);
    if (!p) return;

    let closestIdx  = null;
    let closestDist = Infinity;
    for (let i = 0; i < tuning.n; i++) {
      const [nx, ny] = angleToXY(tuning.angles[i]);
      const dist = Math.sqrt((p.x - nx)**2 + (p.y - ny)**2);
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    }
    onHoverChange(closestDist < HIT_R ? closestIdx : null);
  }, [tuning, toSVGCoords, onHoverChange]);

  const handleMouseLeave = useCallback(() => {
    onHoverChange(null);
  }, [onHoverChange]);

  // Compute step lines (memoised)
  const { lines: stepLines, pendingLabels: stepPending } = useMemo(
    () => buildIntervalLines(tuning ?? { n:0, angles:[], pitchClasses:[] }, activeSteps),
    [tuning, activeSteps]
  );

  // Compute hover lines (memoised)
  const { lines: hoverLines, pendingLabels: hoverPending } = useMemo(
    () => tuning ? buildHoverLines(tuning, hoveredIdx) : { lines: [], pendingLabels: [] },
    [tuning, hoveredIdx]
  );

  // Decide which labels to show
  let nActive = 0;
  for (const v of activeSteps.values()) { if (v) nActive++; }
  const hoverOnly   = hoveredIdx !== null && nActive === 0;
  const showStepLbls = nActive > 0 && nActive <= 6;

  const stepLabels  = useMemo(
    () => showStepLbls ? resolveLabels(stepPending, tuning?.angles ?? []) : [],
    [stepPending, tuning, showStepLbls]
  );
  const hoverLabels = useMemo(
    () => hoveredIdx !== null ? resolveLabels(hoverPending, tuning?.angles ?? []) : [],
    [hoverPending, tuning, hoveredIdx]
  );

  if (!tuning) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12,
      }}>
        <div style={{
          fontSize: 28, fontWeight: 'bold',
          color: 'var(--fg)', fontFamily: 'var(--sans)',
        }}>
          Circle of Fifths
        </div>
        <div style={{ fontSize: 13, color: 'var(--fg-dim)', fontFamily: 'var(--sans)' }}>
          Enter fifth sizes in the left panel, then click Render Tuning
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
    }}>
      <svg
        ref={svgRef}
        width="100%" height="88%"
        viewBox={VB}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <rect x="-1.55" y="-1.55" width="3.10" height="3.10" fill={C.bg} />
        <TitleAndAttribution n={tuning.n} />
        <Ring />
        <ArcLabels tuning={tuning} />

        {/* Step lines (dim, behind hover lines) */}
        <LineLayer lines={stepLines} />
        <LabelLayer labels={stepLabels} />

        {/* Hover lines (bright, on top) — only in hover-only mode */}
        {hoverOnly && <LineLayer lines={hoverLines} />}
        {hoverOnly && <LabelLayer labels={hoverLabels} fontSize={0.062} fontColor={C.fg} />}

        {/* Chord / Scale overlay — above interval lines, below nodes */}
        <OverlayLayer tuning={tuning} overlayData={overlayData} />

        {/* Nodes always on top */}
        <Nodes tuning={tuning} hoveredIdx={hoveredIdx} />
      </svg>

      <svg
        width="100%" height="12%"
        viewBox="0 -0.12 2.0 0.44"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        <rect x="0" y="-0.12" width="2.0" height="0.44" fill={C.bg} />
        <g transform="translate(0, 0.06)">
          <LegendBar />
        </g>
      </svg>
    </div>
  );
}