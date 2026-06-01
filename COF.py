#!/usr/bin/env python3
"""
Circle of Fifths Interactive Tuning Analyser
Input fifths manually or import a .scl file.
"""

import tkinter as tk
from tkinter import filedialog
import customtkinter as ctk
import matplotlib
matplotlib.use('TkAgg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import numpy as np
import re, os, json
from collections import defaultdict

# ── Appearance defaults ───────────────────────────────────────────────────────
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# ─────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────

NOTE_NAMES_12 = ['C','G','D','A','E','B','F#','C#','G#','D#','A#','E#']
NOTE_NAMES_7  = ['C','G','D','A','E','B','F#']

PRESETS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cop_presets.json')

JUST_INTERVALS = {
    'm2':   1200*np.log2(16/15),
    'M2s':  1200*np.log2(10/9),
    'M2L':  1200*np.log2(9/8),
    'm3':   1200*np.log2(6/5),
    'M3':   1200*np.log2(5/4),
    'P4':   1200*np.log2(4/3),
    'TT+':  1200*np.log2(45/32),
    'TT-':  1200*np.log2(64/45),
    'P5':   1200*np.log2(3/2),
    'm6':   1200*np.log2(8/5),
    'M6':   1200*np.log2(5/3),
    'm7s':  1200*np.log2(16/9),
    'm7L':  1200*np.log2(9/5),
    'M7':   1200*np.log2(15/8),
    'd7':   1200*np.log2(128/75),
}

JUST_RATIOS_DISPLAY = {
    'm2':'16/15', 'M2s':'10/9',  'M2L':'9/8',
    'm3':'6/5',   'M3':'5/4',    'P4':'4/3',
    'TT+':'45/32','TT-':'64/45', 'P5':'3/2',
    'm6':'8/5',   'M6':'5/3',
    'm7s':'16/9', 'm7L':'9/5',   'M7':'15/8',
    'd7': '128/75',
}

def nearest_just_interval(cents):
    if cents is None:
        return None
    return min(JUST_INTERVALS.keys(),
               key=lambda k: abs(cents - JUST_INTERVALS[k]))

# ─────────────────────────────────────────────
# THEME HELPERS
# ─────────────────────────────────────────────

def get_theme_colors():
    """Semantic colour palette — dark mode only."""
    return {
        'bg':      '#1e1e2e',
        'panel':   '#2a2a3e',
        'card':    '#313145',
        'fg':      '#e0e0f0',
        'fg_dim':  '#888899',
        'accent':  '#5e9bff',
        'accent2': '#a78bfa',
        'sep':     '#3a3a50',
        'rough':   '#ff5555',
        'pure':    '#50fa7b',
        'plot_bg': '#1e1e2e',
        'mono':    'Courier New',
        'sans':    'Helvetica',
    }

# ─────────────────────────────────────────────
# MATHS HELPERS
# ─────────────────────────────────────────────

def get_note_names(n):
    if n == 12: return NOTE_NAMES_12
    if n == 7:  return NOTE_NAMES_7
    return [str(i) for i in range(n)]

def parse_fifth_input(s):
    s = s.strip()
    try:
        val = float(s)
        if 0 < val < 1200:
            return val
    except ValueError:
        pass
    m = re.match(r'^(\d+)\s*/\s*(\d+)$', s)
    if m:
        return 1200*np.log2(int(m.group(1))/int(m.group(2)))
    m = re.match(r'^([\d.]+)\s*\^\s*\(?\s*([\d.]+)\s*/\s*([\d.]+)\s*\)?$', s)
    if m:
        base = float(m.group(1))
        exp  = float(m.group(2))/float(m.group(3))
        return 1200*np.log2(base**exp)
    raise ValueError(f"Cannot parse: '{s}'")

def compute_pitch_classes(fifth_sizes_cents):
    pitches = [0.0]
    cum = 0.0
    for f in fifth_sizes_cents[:-1]:
        cum += f
        pitches.append(cum % 1200)
    return pitches

def interval_cents_between(pitches, i, j):
    return (pitches[j] - pitches[i]) % 1200

def color_from_deviation(dev):
    anchors = [
        (0,  (0.0, 0.78, 0.27)),
        (5,  (0.55, 0.78, 0.0)),
        (12, (0.9, 0.55, 0.0)),
        (20, (0.9, 0.15, 0.0)),
        (40, (1.0, 0.0,  0.0)),
    ]
    dev = max(0, dev)
    if dev >= anchors[-1][0]:
        return anchors[-1][1]
    for k in range(len(anchors)-1):
        d0, c0 = anchors[k]
        d1, c1 = anchors[k+1]
        if d0 <= dev <= d1:
            t = (dev - d0) / (d1 - d0)
            return tuple(c0[i] + t*(c1[i]-c0[i]) for i in range(3))
    return anchors[0][1]

def format_interval_label(interval_cents):
    return f"{interval_cents:.1f}c"

def format_fifth_label(fifth_cents):
    return f"{fifth_cents:.2f}c"

# ─────────────────────────────────────────────
# SCL FILE LOADER
# ─────────────────────────────────────────────

def load_scl_file(filepath):
    with open(filepath, 'r') as f:
        raw = [l.strip() for l in f if l.strip() and not l.strip().startswith('!')]

    description = raw[0] if raw else "Unknown"
    n = int(raw[1])

    degrees_cents = [0.0]
    for line in raw[2:2+n]:
        token = line.split()[0]
        if '/' in token and '.' not in token:
            num, den = token.split('/')
            degrees_cents.append(1200*np.log2(int(num)/int(den)))
        elif '.' in token:
            degrees_cents.append(float(token))
        else:
            degrees_cents.append(1200*np.log2(float(token)))

    pitch_classes = degrees_cents[:-1]
    if len(pitch_classes) < 2:
        raise ValueError("SCL file must contain at least 2 pitch degrees.")
    target_fifth  = 1200*np.log2(3/2)
    generator     = min(pitch_classes[1:], key=lambda x: abs(x - target_fifth))

    deviation_from_fifth = abs(generator - target_fifth)
    warning = None
    if deviation_from_fifth > 60:
        warning = (f"Warning: detected generator {generator:.1f}¢ is "
                   f"{deviation_from_fifth:.0f}¢ from a pure fifth. "
                   f"Circle-of-fifths layout may be misleading.")

    circle_degrees  = [0.0]
    visited_indices = {0}
    current = 0.0
    for _ in range(n - 1):
        current = (current + generator) % 1200
        best_idx  = None
        best_dist = float('inf')
        for idx, p in enumerate(pitch_classes):
            if idx not in visited_indices:
                dist = abs(p - current)
                if dist < best_dist:
                    best_dist = dist
                    best_idx  = idx
        if best_idx is None:
            break
        circle_degrees.append(pitch_classes[best_idx])
        visited_indices.add(best_idx)

    fifth_sizes = []
    for i in range(n):
        a = circle_degrees[i]
        b = circle_degrees[(i + 1) % n]
        fifth = (b - a) % 1200
        fifth_sizes.append(fifth)

    return description, n, fifth_sizes, warning

# ─────────────────────────────────────────────
# TUNING SYSTEM
# ─────────────────────────────────────────────

from dataclasses import dataclass, field

@dataclass
class TuningSystem:
    fifth_sizes:   list
    pitch_classes: list
    n:             int
    note_names:    list
    angles:        list

    @classmethod
    def from_fifth_sizes(cls, sizes):
        pitch_classes = compute_pitch_classes(sizes)
        n             = len(sizes)
        note_names    = get_note_names(n)
        angles        = [np.pi/2 - 2*np.pi*i/n for i in range(n)]
        return cls(
            fifth_sizes   = sizes,
            pitch_classes = pitch_classes,
            n             = n,
            note_names    = note_names,
            angles        = angles,
        )

    def interval_cents(self, i, j):
        return interval_cents_between(self.pitch_classes, i, j)

    def active_step_state(self, active_intervals):
        n_active = sum(1 for v in active_intervals.values() if v.get())
        lbl_fs   = max(3.5, 6.0 - (n_active - 1) * 0.4)

        active_steps = []
        for step, bvar in active_intervals.items():
            if not bvar.get():
                continue
            comp         = self.n - step
            comp_toggled = (comp in active_intervals and
                            active_intervals[comp].get() and
                            comp != step)
            active_steps.append((step, comp_toggled))

        return {
            'n_active':     n_active,
            'lbl_fs':       lbl_fs,
            'active_steps': active_steps,
        }

    def step_label(self, step):
        if self.n == 12:
            vals = [self.interval_cents(i, (i + step) % self.n)
                    for i in range(self.n)]
            median_cents = sorted(vals)[len(vals) // 2]
            nearest = nearest_just_interval(median_cents)
            return f"{step}~{nearest}"
        return f"{step}gs"

    def step_analysis_lines(self, step):
        vals = [self.interval_cents(i, (i + step) % self.n)
                for i in range(self.n)]

        devs = [abs(v - JUST_INTERVALS[nearest_just_interval(v)]) for v in vals]
        max_dev = max(devs) if devs else 0
        red_threshold = max(12.0, max_dev * 0.6)

        lines = [(f"── {step}gs ──", 'header')]
        for i in range(self.n):
            j       = (i + step) % self.n
            ic      = vals[i]
            nearest = nearest_just_interval(ic)
            just_c  = JUST_INTERVALS[nearest]
            ratio   = JUST_RATIOS_DISPLAY[nearest]
            dev     = ic - just_c
            sign    = '+' if dev >= 0 else ''
            lbl     = format_interval_label(ic)
            line    = (f"{self.note_names[i]:3s}→{self.note_names[j]:3s}"
                       f"  {lbl:>8s}  {sign}{dev:.1f}c  ~{nearest} {ratio}")
            tag     = 'rough' if abs(dev) >= red_threshold else 'normal'
            lines.append((line, tag))
        return lines

    def tooltip_lines(self, idx):
        rows = []
        for step in range(1, self.n):
            j       = (idx + step) % self.n
            ic      = self.interval_cents(idx, j)
            nearest = nearest_just_interval(ic)
            just    = JUST_INTERVALS[nearest]
            dev     = ic - just
            sign    = '+' if dev >= 0 else ''
            ratio   = JUST_RATIOS_DISPLAY[nearest]
            rows.append((ic,
                f"→{self.note_names[j]} ~{nearest} {ratio} "
                f"{sign}{dev:.1f}c ({ic:.1f}c) [{step}gs]"))
        rows.sort(key=lambda x: x[0])
        lines = [(f"── {self.note_names[idx]} ──", 'header')]
        for _, txt in rows:
            lines.append((txt, 'normal'))
        return lines


# ─────────────────────────────────────────────
# SCALE ANALYSER
# ─────────────────────────────────────────────

CHORD_DEFINITIONS = {
    'Major':       [(1200*np.log2(5/4),  'M3'),  (1200*np.log2(3/2),  'P5')],
    'Minor':       [(1200*np.log2(6/5),  'm3'),  (1200*np.log2(3/2),  'P5')],
    'Diminished':  [(1200*np.log2(6/5),  'm3'),  (1200*np.log2(64/45),'TT-')],
    'Augmented':   [(1200*np.log2(5/4),  'M3'),  (1200*np.log2(8/5),  'm6')],
    'Major 7':     [(1200*np.log2(5/4),  'M3'),  (1200*np.log2(3/2),  'P5'),  (1200*np.log2(15/8), 'M7')],
    'Dominant 7':  [(1200*np.log2(5/4),  'M3'),  (1200*np.log2(3/2),  'P5'),  (1200*np.log2(9/5),  'm7L')],
    'Minor 7':     [(1200*np.log2(6/5),  'm3'),  (1200*np.log2(3/2),  'P5'),  (1200*np.log2(9/5),  'm7L')],
    'Half-dim 7':  [(1200*np.log2(6/5),  'm3'),  (1200*np.log2(64/45),'TT-'), (1200*np.log2(9/5),  'm7L')],
    'Diminished 7':[(1200*np.log2(6/5),  'm3'),  (1200*np.log2(64/45),'TT-'), (1200*np.log2(128/75), 'd7')],
    'Minor-maj 7': [(1200*np.log2(6/5),  'm3'),  (1200*np.log2(3/2),  'P5'),  (1200*np.log2(15/8), 'M7')],
    'Aug-maj 7':   [(1200*np.log2(5/4),  'M3'),  (1200*np.log2(8/5),  'm6'),  (1200*np.log2(15/8), 'M7')],
}

_L = 1200*np.log2(9/8)
_s = 1200*np.log2(10/9)
_h = 1200*np.log2(16/15)
_A = 1200*np.log2(75/64)

HEPTATONIC_MODES = {
    'Ionian':      [_L, _s, _h, _L, _s, _L, _h],
    'Dorian':      [_L, _h, _s, _L, _s, _h, _L],
    'Phrygian':    [_h, _L, _s, _L, _h, _s, _L],
    'Lydian':      [_L, _s, _L, _h, _s, _L, _h],
    'Mixolydian':  [_L, _s, _h, _L, _s, _h, _L],
    'Aeolian':     [_L, _h, _s, _L, _h, _L, _s],
    'Locrian':     [_h, _L, _s, _h, _L, _s, _L],
    'Harm. minor': [_L, _h, _s, _L, _h, _A, _h],
    'Mel. minor':  [_L, _h, _s, _L, _s, _L, _h],
}

_DEGREE_NAMES = ['2nd', '3rd', '4th', '5th', '6th', '7th']


class ScaleAnalyser:
    STRICT = 12.0
    LOOSE  = 20.0

    def __init__(self, tuning: 'TuningSystem'):
        self.tuning = tuning
        self.n      = tuning.n
        self._intervals = [
            [(tuning.pitch_classes[j] - tuning.pitch_classes[i]) % 1200
             for j in range(self.n)]
            for i in range(self.n)
        ]

    def interval_purity_table(self):
        all_cents = []
        for i in range(self.n):
            for j in range(self.n):
                if i != j:
                    all_cents.append(self._intervals[i][j])

        target_buckets = {name: {'pure':0,'subtle':0,'noticeable':0,'rough':0}
                          for name in JUST_INTERVALS}

        for ic in all_cents:
            nearest = nearest_just_interval(ic)
            just_c  = JUST_INTERVALS[nearest]
            dev     = abs(ic - just_c)
            dev     = min(dev, abs(ic-(just_c+1200)), abs(ic-(just_c-1200)))
            if dev < 5:
                target_buckets[nearest]['pure'] += 1
            elif dev < 12:
                target_buckets[nearest]['subtle'] += 1
            elif dev < 20:
                target_buckets[nearest]['noticeable'] += 1
            else:
                target_buckets[nearest]['rough'] += 1

        rows = []
        for name in JUST_INTERVALS:
            b = target_buckets[name]
            rows.append((
                name,
                JUST_RATIOS_DISPLAY[name],
                b['pure'], b['subtle'], b['noticeable'], b['rough']
            ))
        return rows

    def chord_census(self):
        result = {}
        pcs = self.tuning.pitch_classes

        for chord_name, intervals in CHORD_DEFINITIONS.items():
            strict_ok = 0
            loose_ok  = 0
            for root_idx in range(self.n):
                root_pc = pcs[root_idx]
                s_pass = True
                l_pass = True
                for (target_cents, _label) in intervals:
                    needed = (root_pc + target_cents) % 1200
                    min_dist = min(
                        min(abs(pc - needed), abs(pc - needed + 1200),
                            abs(pc - needed - 1200))
                        for pc in pcs
                    )
                    if min_dist > self.LOOSE:
                        l_pass = False
                        s_pass = False
                        break
                    if min_dist > self.STRICT:
                        s_pass = False
                if s_pass:
                    strict_ok += 1
                elif l_pass:
                    loose_ok += 1
            result[chord_name] = (strict_ok, loose_ok)
        return result

    def heptatonic_census(self):
        if self.n != 12:
            return None

        pcs    = self.tuning.pitch_classes
        result = {}

        for mode_name, steps in HEPTATONIC_MODES.items():
            cumulative = []
            acc = 0.0
            for st in steps[:-1]:
                acc += st
                cumulative.append(acc % 1200)

            counts = {'pure': 0, 'subtle': 0, 'noticeable': 0, 'rough': 0}

            for root_pc in pcs:
                tone_pcs = [root_pc]
                for target in cumulative:
                    needed = (root_pc + target) % 1200
                    best   = min(pcs, key=lambda pc,
                                 nd=needed: min(abs(pc - nd),
                                                abs(pc - nd + 1200),
                                                abs(pc - nd - 1200)))
                    tone_pcs.append(best)

                for a in range(7):
                    for b in range(a + 1, 7):
                        ic = min(
                            (tone_pcs[b] - tone_pcs[a]) % 1200,
                            (tone_pcs[a] - tone_pcs[b]) % 1200)
                        nearest = nearest_just_interval(ic)
                        just_c  = JUST_INTERVALS[nearest]
                        dev     = abs(ic - just_c)
                        dev     = min(dev,
                                      abs(ic - (just_c + 1200)),
                                      abs(ic - (just_c - 1200)))
                        if dev < 5:
                            counts['pure'] += 1
                        elif dev < 12:
                            counts['subtle'] += 1
                        elif dev < 20:
                            counts['noticeable'] += 1
                        else:
                            counts['rough'] += 1

            result[mode_name] = counts

        return result

    def heptatonic_root_pairs(self, mode_name):
        pcs        = self.tuning.pitch_classes
        note_names = self.tuning.note_names
        steps      = HEPTATONIC_MODES[mode_name]
        cumulative = []
        acc = 0.0
        for st in steps[:-1]:
            acc += st
            cumulative.append(acc % 1200)

        rows = []
        for root_idx, root_pc in enumerate(pcs):
            tone_idxs = [root_idx]
            for target in cumulative:
                needed = (root_pc + target) % 1200
                best_idx = min(range(self.n),
                    key=lambda k, nd=needed: min(
                        abs(pcs[k] - nd),
                        abs(pcs[k] - nd + 1200),
                        abs(pcs[k] - nd - 1200)))
                tone_idxs.append(best_idx)

            counts = {'pure': 0, 'subtle': 0, 'noticeable': 0, 'rough': 0}
            pairs  = []
            for a in range(7):
                for b in range(a + 1, 7):
                    ia, ib = tone_idxs[a], tone_idxs[b]
                    ic = min(
                        (pcs[ib] - pcs[ia]) % 1200,
                        (pcs[ia] - pcs[ib]) % 1200)
                    nearest = nearest_just_interval(ic)
                    just_c  = JUST_INTERVALS[nearest]
                    dev     = ic - just_c
                    dist    = abs(dev)
                    dist    = min(dist,
                                  abs(ic - (just_c + 1200)),
                                  abs(ic - (just_c - 1200)))
                    if dist < 5:
                        counts['pure'] += 1
                    elif dist < 12:
                        counts['subtle'] += 1
                    elif dist < 20:
                        counts['noticeable'] += 1
                    else:
                        counts['rough'] += 1
                    pairs.append((note_names[ia], note_names[ib],
                                  ic, nearest, dev))

            pairs.sort(key=lambda p: abs(p[4]), reverse=True)
            rows.append({
                'root_name':   note_names[root_idx],
                'pure':        counts['pure'],
                'subtle':      counts['subtle'],
                'noticeable':  counts['noticeable'],
                'rough':       counts['rough'],
                'pairs':       pairs,
            })
        return rows

    def interval_drilldown(self, interval_name, band):
        just_c   = JUST_INTERVALS[interval_name]
        limits   = {'pure': (0, 5), 'subtle': (5, 12),
                    'noticeable': (12, 20), 'rough': (20, float('inf'))}
        lo, hi   = limits[band]
        note_names = self.tuning.note_names

        rows = []
        for i in range(self.n):
            for j in range(self.n):
                if i == j:
                    continue
                ic  = self._intervals[i][j]
                if nearest_just_interval(ic) != interval_name:
                    continue
                dev = abs(ic - just_c)
                dev = min(dev, abs(ic - (just_c + 1200)), abs(ic - (just_c - 1200)))
                if lo <= dev < hi:
                    rows.append((note_names[i], note_names[j], ic, ic - just_c))
        rows.sort(key=lambda r: abs(r[3]))
        return rows

    def chord_drilldown(self, chord_name, threshold, exclude_below=None):
        pcs        = self.tuning.pitch_classes
        note_names = self.tuning.note_names
        intervals  = CHORD_DEFINITIONS[chord_name]
        result     = []

        for root_idx in range(self.n):
            root_pc  = pcs[root_idx]
            deg_rows = []
            passes   = True
            max_dist = 0.0
            for (target_cents, label) in intervals:
                needed  = (root_pc + target_cents) % 1200
                best_pc = min(pcs,
                    key=lambda pc: min(abs(pc - needed),
                                       abs(pc - needed + 1200),
                                       abs(pc - needed - 1200)))
                dist = min(abs(best_pc - needed),
                           abs(best_pc - needed + 1200),
                           abs(best_pc - needed - 1200))
                if dist > threshold:
                    passes = False
                    break
                max_dist = max(max_dist, dist)
                actual = (best_pc - root_pc) % 1200
                deg_rows.append((label, actual, actual - target_cents))
            if passes:
                if exclude_below is None or max_dist >= exclude_below:
                    result.append((note_names[root_idx], deg_rows))
        return result


# ─────────────────────────────────────────────
# TUNING STATS WINDOW  (was ScaleInfoWindow)
# ─────────────────────────────────────────────

class TuningStatsWindow:
    """
    Popup showing Tuning Stats for the current TuningSystem.
    Sections: Interval Census, Chord Census, Scale Census.
    """

    MONO = 'Courier New'
    SANS = 'Helvetica'

    def __init__(self, parent, tuning: 'TuningSystem'):
        self.tuning   = tuning
        self.analyser = ScaleAnalyser(tuning)
        self._parent  = parent

        self.win = ctk.CTkToplevel(parent)
        self.win.title(f"Tuning Stats — {tuning.n}-note system")
        self.win.geometry('820x860')
        self.win.resizable(True, True)

        self._chord_vars = {name: tk.BooleanVar(value=True)
                            for name in CHORD_DEFINITIONS}

        self._build()

    def _tc(self):
        """Current theme colours."""
        return get_theme_colors()

    # ── Build ─────────────────────────────────────────────────────────────

    def _build(self):
        tc = self._tc()

        outer = ctk.CTkFrame(self.win, fg_color=tc['bg'])
        outer.pack(fill=tk.BOTH, expand=True)

        canvas = tk.Canvas(outer, bg=tc['bg'], highlightthickness=0)
        vsb    = ctk.CTkScrollbar(outer, command=canvas.yview)
        canvas.configure(yscrollcommand=vsb.set)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self._inner = tk.Frame(canvas, bg=tc['bg'])
        canvas.create_window((0, 0), window=self._inner, anchor='nw')
        self._inner.bind('<Configure>',
            lambda e: canvas.configure(scrollregion=canvas.bbox('all')))

        import platform
        _platform = platform.system()

        def on_wheel(e):
            if not canvas.winfo_exists(): return
            canvas.yview_scroll(int(-1 * e.delta) if _platform == 'Darwin'
                                else int(-1 * (e.delta / 120)), 'units')

        def on_b4(e):
            if canvas.winfo_exists(): canvas.yview_scroll(-1, 'units')
        def on_b5(e):
            if canvas.winfo_exists(): canvas.yview_scroll(1, 'units')

        canvas.bind('<Enter>', lambda e: (
            canvas.bind_all('<MouseWheel>', on_wheel),
            canvas.bind_all('<Button-4>', on_b4),
            canvas.bind_all('<Button-5>', on_b5)))
        canvas.bind('<Leave>', lambda e: (
            canvas.unbind_all('<MouseWheel>'),
            canvas.unbind_all('<Button-4>'),
            canvas.unbind_all('<Button-5>')))
        self.win.bind('<Destroy>', lambda e: (
            canvas.unbind_all('<MouseWheel>'),
            canvas.unbind_all('<Button-4>'),
            canvas.unbind_all('<Button-5>')))

        self._canvas = canvas
        self._build_header()
        self._sep()
        self._build_interval_census()
        self._sep()
        self._build_chord_census()
        self._sep()
        self._build_scale_census()

    def _sep(self):
        tc = self._tc()
        tk.Frame(self._inner, bg=tc['sep'], height=1).pack(
            fill=tk.X, padx=16, pady=8)

    def _section_title(self, text, subtitle=None):
        tc = self._tc()
        tk.Label(self._inner, text=text, bg=tc['bg'],
                 font=(self.SANS, 13, 'bold'), fg=tc['fg'],
                 anchor='w').pack(fill=tk.X, padx=16, pady=(8, 1))
        if subtitle:
            tk.Label(self._inner, text=subtitle, bg=tc['bg'],
                     font=(self.SANS, 9), fg=tc['fg_dim'],
                     anchor='w', wraplength=760, justify=tk.LEFT).pack(
                     fill=tk.X, padx=16, pady=(0, 6))

    # ── Drilldown popup ───────────────────────────────────────────────────

    def _show_drilldown(self, title, lines):
        tc  = self._tc()
        pop = ctk.CTkToplevel(self.win)
        pop.title(title)
        pop.geometry('560x380')
        pop.resizable(True, True)

        outer = ctk.CTkFrame(pop, fg_color=tc['bg'])
        outer.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        txt = tk.Text(outer, bg=tc['bg'], fg=tc['fg'],
                      font=(self.MONO, 10), wrap=tk.NONE,
                      relief=tk.FLAT, cursor='arrow',
                      insertbackground=tc['fg'])
        vsb = ctk.CTkScrollbar(outer, command=txt.yview)
        hsb = ctk.CTkScrollbar(outer, orientation='horizontal',
                               command=txt.xview)
        txt.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        hsb.pack(side=tk.BOTTOM, fill=tk.X)
        txt.pack(fill=tk.BOTH, expand=True)

        txt.tag_configure('header', foreground=tc['fg'],
                          font=(self.SANS, 11, 'bold'))
        txt.tag_configure('subhdr', foreground=tc['fg_dim'],
                          font=(self.SANS, 10, 'bold'))
        txt.tag_configure('normal', foreground=tc['fg_dim'])
        txt.tag_configure('rough',  foreground=tc['rough'])
        txt.tag_configure('dim',    foreground=tc['sep'])

        for text, tag in lines:
            txt.insert(tk.END, text + '\n', tag)
        txt.config(state=tk.DISABLED)
        pop.bind('<Escape>', lambda e: pop.destroy())
        pop.focus_force()

    # ── Header ────────────────────────────────────────────────────────────

    def _build_header(self):
        tc = self._tc()
        tk.Label(self._inner,
                 text=f"Tuning Stats  ·  {self.tuning.n}-note system",
                 bg=tc['bg'], font=(self.SANS, 15, 'bold'),
                 fg=tc['fg']).pack(anchor='w', padx=16, pady=(14, 2))
        tk.Label(self._inner,
                 text="Deviation thresholds: strict ≤ 12¢  ·  loose 12–20¢  (disjoint)",
                 bg=tc['bg'], font=(self.SANS, 9), fg=tc['fg_dim']).pack(
                 anchor='w', padx=16, pady=(0, 4))

    # ── Section 1: Interval Census ────────────────────────────────────────

    def _build_interval_census(self):
        tc = self._tc()
        self._section_title(
            "Interval Census",
            f"All {self.tuning.n*(self.tuning.n-1)} directed intervals "
            f"({self.tuning.n} notes × {self.tuning.n-1} steps), "
            f"each assigned to its nearest just target.  Click a count to see details.")

        rows = self.analyser.interval_purity_table()

        grid = tk.Frame(self._inner, bg=tc['bg'])
        grid.pack(fill=tk.X, padx=16, pady=(0, 2))

        col_specs = [
            ('Interval',       10, 'w'),
            ('Ratio',           7, 'center'),
            ('0–5¢\nPure',      7, 'center'),
            ('5–12¢\nSubtle',   7, 'center'),
            ('12–20¢\nNotice',  7, 'center'),
            ('20¢+\nRough',     7, 'center'),
        ]
        for col, (txt, w, anc) in enumerate(col_specs):
            tk.Label(grid, text=txt, width=w, bg=tc['bg'],
                     font=(self.SANS, 9, 'bold'), fg=tc['fg_dim'],
                     anchor=anc, justify=tk.CENTER).grid(
                     row=0, column=col, padx=2, pady=(0, 2))

        band_devs  = [2.5, 8.5, 16, 30]
        band_keys  = ['pure', 'subtle', 'noticeable', 'rough']
        band_names = ['Pure (0–5¢)', 'Subtle (5–12¢)',
                      'Noticeable (12–20¢)', 'Rough (20¢+)']

        for r, (name, ratio, pure, subtle, notice, rough) in enumerate(rows):
            grid_row = r + 1
            counts = [pure, subtle, notice, rough]
            total  = pure + subtle + notice + rough

            tk.Label(grid, text=name, width=10, bg=tc['bg'],
                     font=(self.MONO, 10), fg=tc['fg'],
                     anchor='w').grid(row=grid_row, column=0, padx=2, pady=1)
            tk.Label(grid, text=ratio, width=7, bg=tc['bg'],
                     font=(self.MONO, 10), fg=tc['fg_dim'],
                     anchor='center').grid(row=grid_row, column=1, padx=2, pady=1)

            for col, (cnt, dev, band_key, band_name) in enumerate(
                    zip(counts, band_devs, band_keys, band_names)):
                rgb = color_from_deviation(dev)
                if total > 0 and cnt > 0:
                    alpha   = 0.18 + 0.45 * (cnt / total)
                    card_r  = int(tc['card'][1:3], 16)
                    card_g  = int(tc['card'][3:5], 16)
                    card_b  = int(tc['card'][5:7], 16)
                    card_ch = (card_r, card_g, card_b)
                    bg_rgb  = tuple(int((1 - alpha)*card_ch[i] + alpha*rgb[i]*255)
                                    for i in range(3))
                    bg_hex  = '#{:02x}{:02x}{:02x}'.format(*bg_rgb)
                    fg_col  = tc['fg']
                else:
                    bg_hex = tc['bg']
                    fg_col = tc['sep']

                def make_cb(iname=name, bkey=band_key, bname=band_name):
                    def cb():
                        rows_ = self.analyser.interval_drilldown(iname, bkey)
                        just_c = JUST_INTERVALS[iname]
                        lines  = [(f"{bname}  ·  {iname} ({JUST_RATIOS_DISPLAY[iname]})"
                                   f"  ·  just = {just_c:.1f}c", 'header'),
                                  (f"{'From':<6}  {'To':<6}  {'Cents':>9}  {'Dev':>9}", 'subhdr'),
                                  ('', 'normal')]
                        for fn, tn, ic, dv in rows_:
                            sign = '+' if dv >= 0 else ''
                            tag  = 'rough' if abs(dv) >= 20 else 'normal'
                            lines.append(
                                (f"{fn:<6}  {'->'+tn:<6}  {ic:>8.2f}c  "
                                 f"{sign}{dv:>7.2f}c", tag))
                        if not rows_:
                            lines.append(('(none)', 'dim'))
                        self._show_drilldown(f"{iname}  ·  {bname}", lines)
                    return cb

                cursor = 'hand2' if cnt > 0 else 'arrow'
                lbl = tk.Label(grid, text=str(cnt), width=7,
                               bg=bg_hex, fg=fg_col,
                               font=(self.MONO, 10, 'bold' if cnt > 0 else 'normal'),
                               anchor='center', cursor=cursor)
                lbl.grid(row=grid_row, column=col + 2, padx=2, pady=1)
                if cnt > 0:
                    lbl.bind('<Button-1>', lambda e, cb=make_cb(): cb())

        n_intervals = self.tuning.n * (self.tuning.n - 1)
        col_totals  = [sum(r[2+c] for r in rows) for c in range(4)]
        sep_row     = len(rows) + 1
        tot_row     = len(rows) + 2

        tk.Frame(grid, bg=tc['sep'], height=1).grid(
            row=sep_row, column=0, columnspan=6,
            sticky='ew', padx=0, pady=(4, 2))

        tk.Label(grid, text='Total', width=10, bg=tc['bg'],
                 font=(self.SANS, 10, 'bold'), fg=tc['fg'],
                 anchor='w').grid(row=tot_row, column=0, padx=2, pady=1)
        tk.Label(grid, text='', width=7, bg=tc['bg']).grid(
            row=tot_row, column=1, padx=2)

        for col, cnt in enumerate(col_totals):
            pct = 100 * cnt / n_intervals if n_intervals > 0 else 0
            tk.Label(grid, text=f"{cnt}\n({pct:.0f}%)", width=7,
                     bg=tc['bg'], fg=tc['fg'],
                     font=(self.MONO, 9, 'bold'),
                     anchor='center', justify=tk.CENTER).grid(
                     row=tot_row, column=col + 2, padx=2, pady=1)

    # ── Section 2: Chord Census ───────────────────────────────────────────

    def _build_chord_census(self):
        tc = self._tc()
        self._section_title(
            "Chord Census",
            "Counts roots (out of n) where all chord intervals match just "
            "targets within threshold.  Click a count to see which roots pass.")

        tog_fr = tk.Frame(self._inner, bg=tc['bg'])
        tog_fr.pack(fill=tk.X, padx=16, pady=(0, 6))
        tk.Label(tog_fr, text="Show:", bg=tc['bg'],
                 font=(self.SANS, 9), fg=tc['fg_dim']).pack(side=tk.LEFT)
        for name, var in self._chord_vars.items():
            tk.Checkbutton(tog_fr, text=name, variable=var,
                           bg=tc['bg'], fg=tc['fg'],
                           selectcolor=tc['card'],
                           activebackground=tc['bg'],
                           activeforeground=tc['fg'],
                           font=(self.SANS, 9),
                           command=self._refresh_chord_rows).pack(
                           side=tk.LEFT, padx=(4, 0))

        self._chord_grid = tk.Frame(self._inner, bg=tc['bg'])
        self._chord_grid.pack(fill=tk.X, padx=16)

        chord_col_specs = [
            ('Chord',                           14, 'w'),
            ('Intervals',                       22, 'w'),
            (f'Strict ≤12¢\n/ {self.tuning.n}',  9, 'center'),
            (f'Loose 12–20¢\n/ {self.tuning.n}', 9, 'center'),
        ]
        for col, (txt, w, anc) in enumerate(chord_col_specs):
            tk.Label(self._chord_grid, text=txt, width=w, bg=tc['bg'],
                     font=(self.SANS, 9, 'bold'), fg=tc['fg_dim'],
                     anchor=anc, justify=tk.CENTER).grid(
                     row=0, column=col, padx=2, pady=(0, 3))

        self._chord_data = self.analyser.chord_census()
        self._refresh_chord_rows()

    def _refresh_chord_rows(self):
        tc = self._tc()
        for w in self._chord_grid.grid_slaves():
            info = w.grid_info()
            if int(info.get('row', 0)) > 0:
                w.destroy()

        n       = self.tuning.n
        visible = [name for name, var in self._chord_vars.items() if var.get()]
        grid_row = 1

        for chord_name in visible:
            strict_c, loose_c = self._chord_data[chord_name]
            intervals    = CHORD_DEFINITIONS[chord_name]
            interval_str = ' + '.join(lbl for _, lbl in intervals)

            tk.Label(self._chord_grid, text=chord_name, width=14, bg=tc['bg'],
                     font=(self.MONO, 10, 'bold'), fg=tc['fg'],
                     anchor='w').grid(row=grid_row, column=0, padx=2, pady=1)
            tk.Label(self._chord_grid, text=interval_str, width=22, bg=tc['bg'],
                     font=(self.MONO, 9), fg=tc['fg_dim'],
                     anchor='w').grid(row=grid_row, column=1, padx=2, pady=1)

            for col, (count, thresh, excl, tlbl) in enumerate([
                (strict_c, self.analyser.STRICT, None,                '≤12¢'),
                (loose_c,  self.analyser.LOOSE,  self.analyser.STRICT, '12–20¢'),
            ]):
                ratio   = count / n if n > 0 else 0
                dev     = (1 - ratio) * 40
                rgb     = color_from_deviation(dev)
                alpha   = 0.12 + 0.4 * ratio
                card_r  = int(tc['card'][1:3], 16)
                card_g  = int(tc['card'][3:5], 16)
                card_b  = int(tc['card'][5:7], 16)
                card_ch = (card_r, card_g, card_b)
                bg_rgb  = tuple(int((1-alpha)*card_ch[i] + alpha*rgb[i]*255) for i in range(3))
                bg_hex  = '#{:02x}{:02x}{:02x}'.format(*bg_rgb)

                def make_cb(cname=chord_name, thr=thresh, ex=excl, tlbl_=tlbl):
                    def cb():
                        roots = self.analyser.chord_drilldown(cname, thr, exclude_below=ex)
                        idef  = CHORD_DEFINITIONS[cname]
                        lines = [(f"{cname}  ·  {tlbl_}  ·  "
                                  f"{' + '.join(l for _,l in idef)}", 'header'),
                                 ('', 'normal')]
                        for root_name, deg_rows in roots:
                            lines.append((f"  {root_name}", 'subhdr'))
                            for (lbl, actual, dv) in deg_rows:
                                tag = 'rough' if abs(dv) >= 20 else 'normal'
                                lines.append(
                                    (f"    {lbl:<5}  {actual:>8.2f}c  "
                                     f"{dv:>+8.2f}c", tag))
                        if not roots:
                            lines.append(('(none)', 'dim'))
                        self._show_drilldown(f"{cname}  ·  {tlbl_}", lines)
                    return cb

                cursor = 'hand2' if count > 0 else 'arrow'
                lbl = tk.Label(self._chord_grid, text=f"{count} / {n}", width=9,
                               bg=bg_hex, fg=tc['fg'],
                               font=(self.MONO, 10, 'bold'),
                               anchor='center', cursor=cursor)
                lbl.grid(row=grid_row, column=col + 2, padx=2, pady=1)
                if count > 0:
                    lbl.bind('<Button-1>', lambda e, cb=make_cb(): cb())

            grid_row += 1

        if not visible:
            return

        n_chords     = len(visible)
        max_possible = n * n_chords
        strict_total = sum(self._chord_data[name][0] for name in visible)
        loose_total  = sum(self._chord_data[name][1] for name in visible)

        tk.Frame(self._chord_grid, bg=tc['sep'], height=1).grid(
            row=grid_row, column=0, columnspan=4,
            sticky='ew', padx=0, pady=(4, 2))
        grid_row += 1

        tk.Label(self._chord_grid, text='Total', width=14, bg=tc['bg'],
                 font=(self.SANS, 10, 'bold'), fg=tc['fg'],
                 anchor='w').grid(row=grid_row, column=0, padx=2, pady=1)
        tk.Label(self._chord_grid, text='', width=22, bg=tc['bg']).grid(
            row=grid_row, column=1, padx=2)

        for col, cnt in enumerate([strict_total, loose_total]):
            pct = 100 * cnt / max_possible if max_possible > 0 else 0
            tk.Label(self._chord_grid, text=f"{cnt}\n({pct:.0f}%)", width=9,
                     bg=tc['bg'], fg=tc['fg'],
                     font=(self.MONO, 9, 'bold'),
                     anchor='center', justify=tk.CENTER).grid(
                     row=grid_row, column=col + 2, padx=2, pady=1)

    # ── Section 3: Scale Census ───────────────────────────────────────────

    def _build_scale_census(self):
        tc = self._tc()
        TOTAL_PAIRS = 252

        self._section_title(
            "Scale Census",
            f"All 21 undirected pairwise intervals among the 7 scale tones, "
            f"measured across all 12 roots ({TOTAL_PAIRS} pairs total per mode).  "
            f"Click any count to drill down by root.")

        if self.tuning.n != 12:
            tk.Label(self._inner,
                     text="Scale census requires a 12-tone system.\n"
                          f"Current system has {self.tuning.n} notes.",
                     bg=tc['bg'], font=(self.SANS, 10), fg=tc['fg_dim'],
                     justify=tk.LEFT).pack(anchor='w', padx=16, pady=8)
            return

        result = self.analyser.heptatonic_census()
        frame  = tk.Frame(self._inner, bg=tc['bg'])
        frame.pack(fill=tk.X, padx=16)

        band_devs = [2.5, 8.5, 16, 30]
        col_specs = [
            ('Scale / Mode',         16, 'w'),
            ('0–5¢\nPure',            7, 'center'),
            ('5–12¢\nSubtle',         7, 'center'),
            ('12–20¢\nNotice',        7, 'center'),
            ('20¢+\nRough',           7, 'center'),
        ]
        for col, (txt, w, anc) in enumerate(col_specs):
            tk.Label(frame, text=txt, width=w, bg=tc['bg'],
                     font=(self.SANS, 9, 'bold'), fg=tc['fg_dim'],
                     anchor=anc, justify=tk.CENTER).grid(
                     row=0, column=col, padx=2, pady=(0, 3))

        grid_row   = 1
        band_keys  = ['pure', 'subtle', 'noticeable', 'rough']
        band_names = ['Pure (0–5¢)', 'Subtle (5–12¢)',
                      'Noticeable (12–20¢)', 'Rough (20¢+)']

        for mode_name, counts in result.items():
            if mode_name == 'Harm. minor':
                tk.Frame(frame, bg=tc['sep'], height=1).grid(
                    row=grid_row, column=0, columnspan=5,
                    sticky='ew', padx=4, pady=4)
                grid_row += 1

            tk.Label(frame, text=mode_name, width=16, bg=tc['bg'],
                     font=(self.MONO, 10, 'bold'), fg=tc['fg'],
                     anchor='w').grid(row=grid_row, column=0, padx=2, pady=1)

            count_vals = [counts[k] for k in band_keys]
            for col, (cnt, dev, bkey, bname) in enumerate(
                    zip(count_vals, band_devs, band_keys, band_names)):
                rgb = color_from_deviation(dev)
                if cnt > 0:
                    alpha   = 0.15 + 0.45 * (cnt / TOTAL_PAIRS)
                    card_r  = int(tc['card'][1:3], 16)
                    card_g  = int(tc['card'][3:5], 16)
                    card_b  = int(tc['card'][5:7], 16)
                    card_ch = (card_r, card_g, card_b)
                    bg_rgb  = tuple(int((1 - alpha) * card_ch[i] + alpha * rgb[i] * 255)
                                    for i in range(3))
                    bg_hex  = '#{:02x}{:02x}{:02x}'.format(*bg_rgb)
                    fg_col  = tc['fg']
                else:
                    bg_hex = tc['bg']
                    fg_col = tc['sep']

                def make_cb(mname=mode_name, bname_=bname):
                    def cb():
                        self._show_scale_level1(mname, bname_)
                    return cb

                cursor = 'hand2' if cnt > 0 else 'arrow'
                lbl = tk.Label(frame, text=str(cnt), width=7,
                               bg=bg_hex, fg=fg_col,
                               font=(self.MONO, 10, 'bold' if cnt > 0 else 'normal'),
                               anchor='center', cursor=cursor)
                lbl.grid(row=grid_row, column=col + 1, padx=2, pady=1)
                if cnt > 0:
                    lbl.bind('<Button-1>', lambda e, cb=make_cb(): cb())

            grid_row += 1

        tk.Frame(frame, bg=tc['sep'], height=1).grid(
            row=grid_row, column=0, columnspan=5,
            sticky='ew', padx=4, pady=4)
        grid_row += 1
        tk.Label(frame, text='Total', width=16, bg=tc['bg'],
                 font=(self.MONO, 10, 'bold'), fg=tc['fg'],
                 anchor='w').grid(row=grid_row, column=0, padx=2, pady=1)

        n_modes     = len(result)
        grand_total = TOTAL_PAIRS * n_modes
        for col, bkey in enumerate(band_keys):
            cnt = sum(counts[bkey] for counts in result.values())
            pct = 100 * cnt / grand_total if grand_total > 0 else 0
            tk.Label(frame, text=f"{cnt}\n({pct:.0f}%)", width=7,
                     bg=tc['bg'], fg=tc['fg'],
                     font=(self.MONO, 9, 'bold'),
                     anchor='center', justify=tk.CENTER).grid(
                     row=grid_row, column=col + 1, padx=2, pady=1)

    # ── Scale drilldown level 1 ───────────────────────────────────────────

    def _show_scale_level1(self, mode_name, band_name):
        tc        = self._tc()
        root_rows = self.analyser.heptatonic_root_pairs(mode_name)

        pop = ctk.CTkToplevel(self.win)
        pop.title(f"{mode_name}  ·  all roots")
        pop.geometry('580x420')
        pop.resizable(True, True)

        tk.Label(pop,
                 text=f"{mode_name}  —  pairwise interval purity per root  "
                      f"(21 pairs each)  ·  click a root to inspect",
                 bg=tc['bg'], font=(self.SANS, 9), fg=tc['fg_dim'],
                 wraplength=540, justify=tk.LEFT).pack(
                 anchor='w', padx=12, pady=(8, 4))

        outer = ctk.CTkFrame(pop, fg_color=tc['bg'])
        outer.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))

        grid = tk.Frame(outer, bg=tc['bg'])
        grid.pack(fill=tk.X)

        col_specs = [
            ('Root',        6,  'w'),
            ('Pure\n0–5¢',  6,  'center'),
            ('Subtle\n5–12¢', 7, 'center'),
            ('Notice\n12–20¢', 7, 'center'),
            ('Rough\n20¢+',  6, 'center'),
        ]
        for col, (txt, w, anc) in enumerate(col_specs):
            tk.Label(grid, text=txt, width=w, bg=tc['bg'],
                     font=(self.SANS, 9, 'bold'), fg=tc['fg_dim'],
                     anchor=anc, justify=tk.CENTER).grid(
                     row=0, column=col, padx=3, pady=(0, 2))

        band_devs = [2.5, 8.5, 16, 30]
        band_keys = ['pure', 'subtle', 'noticeable', 'rough']

        for r, row in enumerate(root_rows):
            grid_row  = r + 1
            root_name = row['root_name']

            def make_l2(rname=root_name, rrow=row):
                def cb():
                    self._show_scale_level2(mode_name, rname, rrow['pairs'])
                return cb

            lbl = tk.Label(grid, text=root_name, width=6, bg=tc['bg'],
                           font=(self.MONO, 10, 'bold'), fg=tc['accent'],
                           anchor='w', cursor='hand2')
            lbl.grid(row=grid_row, column=0, padx=3, pady=1)
            lbl.bind('<Button-1>', lambda e, cb=make_l2(): cb())

            for col, (bkey, dev) in enumerate(zip(band_keys, band_devs)):
                cnt    = row[bkey]
                rgb    = color_from_deviation(dev)
                alpha  = 0.15 + 0.45 * (cnt / 21) if cnt > 0 else 0
                if alpha > 0:
                    card_r  = int(tc['card'][1:3], 16)
                    card_g  = int(tc['card'][3:5], 16)
                    card_b  = int(tc['card'][5:7], 16)
                    card_ch = (card_r, card_g, card_b)
                    bg_rgb  = tuple(int((1 - alpha) * card_ch[i] + alpha * rgb[i] * 255)
                                    for i in range(3))
                    bg_hex  = '#{:02x}{:02x}{:02x}'.format(*bg_rgb)
                    fg_col  = tc['fg']
                else:
                    bg_hex = tc['bg']
                    fg_col = tc['sep']
                tk.Label(grid, text=str(cnt), width=6,
                         bg=bg_hex, fg=fg_col,
                         font=(self.MONO, 10),
                         anchor='center').grid(
                         row=grid_row, column=col + 1, padx=3, pady=1)

        pop.bind('<Escape>', lambda e: pop.destroy())
        pop.focus_force()

    # ── Scale drilldown level 2 ───────────────────────────────────────────

    def _show_scale_level2(self, mode_name, root_name, pairs):
        tc  = self._tc()
        pop = ctk.CTkToplevel(self.win)
        pop.title(f"{mode_name}  ·  {root_name}  ·  all pairs")
        pop.geometry('500x440')
        pop.resizable(True, True)

        outer = ctk.CTkFrame(pop, fg_color=tc['bg'])
        outer.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        txt = tk.Text(outer, bg=tc['bg'], fg=tc['fg'],
                      font=(self.MONO, 10), wrap=tk.NONE,
                      relief=tk.FLAT, cursor='arrow')
        vsb = ctk.CTkScrollbar(outer, command=txt.yview)
        txt.configure(yscrollcommand=vsb.set)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        txt.pack(fill=tk.BOTH, expand=True)

        txt.tag_configure('header', foreground=tc['fg'],
                          font=(self.SANS, 11, 'bold'))
        txt.tag_configure('subhdr', foreground=tc['fg_dim'],
                          font=(self.SANS, 10, 'bold'))
        txt.tag_configure('normal', foreground=tc['fg_dim'])
        txt.tag_configure('rough',  foreground=tc['rough'])
        txt.tag_configure('pure',   foreground=tc['pure'])

        txt.insert(tk.END,
                   f"{mode_name}  ·  {root_name}  —  21 pairs, worst first\n",
                   'header')
        txt.insert(tk.END,
                   f"{'Pair':<14}  {'Cents':>9}  {'~Just':<6}  {'Dev':>9}\n",
                   'subhdr')
        txt.insert(tk.END, '\n', 'normal')

        for (na, nb, ic, nearest, dev) in pairs:
            dist = abs(dev)
            dist = min(dist,
                       abs(ic - (JUST_INTERVALS[nearest] + 1200)),
                       abs(ic - (JUST_INTERVALS[nearest] - 1200)))
            sign = '+' if dev >= 0 else ''
            tag  = ('rough' if dist >= 20 else
                    'pure'  if dist <  5  else 'normal')
            pair_str = f"{na}<>{nb}"
            txt.insert(tk.END,
                       f"{pair_str:<14}  {ic:>9.2f}c  ~{nearest:<5}"
                       f"  {sign}{dev:>8.2f}c\n", tag)

        txt.config(state=tk.DISABLED)
        pop.bind('<Escape>', lambda e: pop.destroy())
        pop.focus_force()


# ─────────────────────────────────────────────
# PRESET MANAGER
# ─────────────────────────────────────────────

class PresetManager:
    def __init__(self, filepath):
        self.filepath = filepath

    def _read(self):
        try:
            with open(self.filepath, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def list_presets(self):
        return list(self._read().keys())

    def load(self, name):
        presets = self._read()
        if name not in presets:
            raise KeyError(f"Preset '{name}' not found.")
        return presets[name]

    def save(self, name, n, entries):
        presets = self._read()
        presets[name] = {'n': n, 'entries': entries}
        with open(self.filepath, 'w') as f:
            json.dump(presets, f, indent=2)


# ─────────────────────────────────────────────
# RENDERER
# ─────────────────────────────────────────────

class Renderer:
    R      = 1.0
    NODE_R = 0.095
    OFFSET = 0.04
    GAP    = 0.22

    def __init__(self, master_frame, bg='#1e1e2e'):
        self.bg = bg
        self.fig, self.ax = plt.subplots(figsize=(8, 8), dpi=150,
                                          facecolor=bg)
        self.fig.subplots_adjust(left=0.04, right=0.96,
                                 top=0.96,  bottom=0.04)
        self.canvas = FigureCanvasTkAgg(self.fig, master=master_frame)
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        self.legend_fig, self.legend_ax = plt.subplots(
            figsize=(3.1, 1.8), dpi=150, facecolor=bg)
        self.legend_fig.subplots_adjust(left=0.02, right=0.98,
                                        top=0.92,  bottom=0.02)

        self._node_patches:    dict = {}
        self._node_texts:      dict = {}
        self._dynamic_artists: list = []
        self._overlay_artists: list = []
        self._node_positions:  list = []

    @property
    def node_positions(self):
        return self._node_positions

    # ── Legend ────────────────────────────────────────────────────────────

    def draw_legend(self):
        tc  = get_theme_colors()
        ax  = self.legend_ax
        ax.clear()
        ax.set_facecolor(self.bg)
        ax.axis('off')
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)

        # ── Gradient bar ──────────────────────────────────────────────────
        max_dev = 40
        bar_y   = 0.08   # bottom of bar (in axes coords)
        bar_h   = 0.40   # height of bar
        steps   = 300
        for k in range(steps):
            dev = k / steps * max_dev
            c   = color_from_deviation(dev)
            ax.bar(k / steps, bar_h, width=1.01 / steps, bottom=bar_y,
                   color=c, linewidth=0, align='edge')

        # ── Zone definitions ──────────────────────────────────────────────
        zones = [
            (0,   5,  'Pure',       '0–5c'),
            (5,   12, 'Subtle',     '5–12c'),
            (12,  20, 'Noticeable', '12–20c'),
            (20,  40, 'Rough',      '20c+'),
        ]

        fg     = '#e0e0f0'
        fg_dim = '#888899'

        for x0, x1, name, cents in zones:
            mid = (x0 + x1) / 2 / max_dev

            # Zone name above bar
            ax.text(mid, 0.96, name,
                    ha='center', va='top',
                    fontsize=6.5, fontfamily='Helvetica',
                    color=fg, fontweight='bold')

            # Cent range just below name
            ax.text(mid, 0.78, cents,
                    ha='center', va='top',
                    fontsize=5.5, fontfamily='Helvetica',
                    color=fg_dim)

            # Divider lines between zones
            if x0 > 0:
                ax.axvline(x0 / max_dev,
                           ymin=bar_y, ymax=bar_y + bar_h,
                           color='#1e1e2e', lw=1.5)

        # ── Perceptual labels inside the bar ──────────────────────────────
        inside = [
            (0,   5,  '< JND'),
            (5,   12, 'slow beats'),
            (12,  20, 'noticeable'),
            (20,  40, 'rapid / rough'),
        ]
        bar_mid_y = bar_y + bar_h / 2
        for x0, x1, label in inside:
            mid = (x0 + x1) / 2 / max_dev
            ax.text(mid, bar_mid_y, label,
                    ha='center', va='center',
                    fontsize=5.0, fontfamily='Helvetica',
                    color='white', style='italic', alpha=0.88)

        self.legend_fig.canvas.draw()

    # ── Static layer ──────────────────────────────────────────────────────

    def draw_static(self, tuning):
        tc     = get_theme_colors()
        R      = self.R
        NODE_R = self.NODE_R

        self.ax.clear()
        self.ax.set_aspect('equal')
        self.ax.axis('off')
        self.ax.set_xlim(-1.45, 1.45)
        self.ax.set_ylim(-1.45, 1.45)
        self.fig.patch.set_facecolor(self.bg)
        self.ax.set_facecolor(self.bg)

        node_edge   = tc['fg']
        node_fill   = tc['card']
        node_fg     = tc['fg']
        fifth_label = tc['fg_dim']

        self.ax.add_patch(plt.Circle((0, 0), R, fill=False,
                                     color=tc['sep'], lw=1.0, zorder=3))

        for i in range(tuning.n):
            a1   = tuning.angles[i]
            a2   = tuning.angles[(i + 1) % tuning.n]
            diff = (a1 - a2) % (2 * np.pi)
            mid  = a1 - diff / 2
            lbl  = format_fifth_label(tuning.fifth_sizes[i])
            self.ax.text(1.22 * np.cos(mid), 1.22 * np.sin(mid), lbl,
                         ha='center', va='center', fontsize=7,
                         color=fifth_label, fontfamily='Helvetica', zorder=5)

        self._node_patches   = {}
        self._node_texts     = {}
        self._node_positions = []
        for i, (ang, name) in enumerate(zip(tuning.angles, tuning.note_names)):
            x, y = R * np.cos(ang), R * np.sin(ang)
            self._node_positions.append((x, y))
            patch = plt.Circle((x, y), NODE_R, color=node_fill,
                               ec=node_edge, lw=1.8, zorder=6)
            self.ax.add_patch(patch)
            self._node_patches[i] = patch
            fs = 9 if len(name) == 1 else 7.5
            txt = self.ax.text(x, y, name, ha='center', va='center',
                               fontsize=fs, color=node_fg,
                               fontweight='bold', fontfamily='Helvetica',
                               zorder=7)
            self._node_texts[i] = txt

        self.ax.set_title(
            f"{tuning.n}-Note Tuning System  ·  Circle of Fifths (clockwise)",
            fontsize=10, fontfamily='Helvetica', color=tc['fg_dim'], pad=10)
        self.ax.text(0, -1.42,
                     "Analytical tool developed with Claude (Anthropic), 2026",
                     ha='center', va='top', fontsize=5.5,
                     fontfamily='Helvetica', color=tc['sep'], zorder=1)

        self._dynamic_artists = []
        self._overlay_artists = []   # ax.clear() orphans these; reset here

    # ── Dynamic layer ─────────────────────────────────────────────────────

    def draw_dynamic(self, tuning, hover_note, active_steps,
                     n_active, lbl_fs, hover_only):
        tc = get_theme_colors()

        for artist in self._dynamic_artists:
            try:
                artist.remove()
            except ValueError:
                pass
        self._dynamic_artists = []

        node_fill_hover = tc['accent']
        node_fg_hover   = tc['bg']
        node_fill_norm  = tc['card']
        node_fg_norm    = tc['fg']

        for i, patch in self._node_patches.items():
            hovered = (hover_note == i)
            patch.set_facecolor(node_fill_hover if hovered else node_fill_norm)
            self._node_texts[i].set_color(node_fg_hover if hovered else node_fg_norm)

        all_pending_labels = []

        if hover_only:
            for step in range(1, tuning.n):
                artists = self._draw_interval_lines(
                    tuning, step, 5.5, all_pending_labels,
                    hover_note, hover_only=True,
                    complement_toggled=False)
                self._dynamic_artists.extend(artists)
        else:
            for step, comp_toggled in active_steps:
                artists = self._draw_interval_lines(
                    tuning, step, lbl_fs, all_pending_labels,
                    hover_note, hover_only=False,
                    complement_toggled=comp_toggled)
                self._dynamic_artists.extend(artists)

        if all_pending_labels and n_active <= 6:
            self._resolve_and_draw_labels(all_pending_labels, tuning.angles)

        self.canvas.draw()

    # ── Interval lines ────────────────────────────────────────────────────

    def _draw_interval_lines(self, tuning, step, lbl_fs, all_labels,
                             hover_note, hover_only, complement_toggled):
        tc     = get_theme_colors()
        R      = self.R
        OFFSET = self.OFFSET
        GAP    = self.GAP
        n      = tuning.n
        angles = tuning.angles

        self_inverse = (n % 2 == 0 and step == n // 2)
        use_offset   = self_inverse or complement_toggled
        offset_sign  = 1 if step <= n // 2 else -1

        seen    = set()
        created = []

        for i in range(n):
            if hover_only and i != hover_note:
                continue

            j    = (i + step) % n
            pair = (min(i, j), max(i, j))
            if not hover_only and pair in seen:
                continue
            seen.add(pair)

            ic_ij   = tuning.interval_cents(i, j)
            nearest = nearest_just_interval(ic_ij)
            dev     = abs(ic_ij - JUST_INTERVALS[nearest])

            x1, y1 = R * np.cos(angles[i]), R * np.sin(angles[i])
            x2, y2 = R * np.cos(angles[j]), R * np.sin(angles[j])

            lo, hi   = (i, j) if i < j else (j, i)
            dx, dy   = (R * np.cos(angles[hi]) - R * np.cos(angles[lo]),
                        R * np.sin(angles[hi]) - R * np.sin(angles[lo]))
            length   = np.sqrt(dx**2 + dy**2)
            if length < 1e-6:
                continue
            ux, uy = dx / length, dy / length
            px, py = -uy, ux

            is_hovered = hover_only
            lw    = 2.2 if is_hovered else 1.5
            alpha = 0.95 if is_hovered else 0.55
            zord  = 3   if is_hovered else 2
            fs    = lbl_fs * 1.3 if is_hovered else lbl_fs

            if use_offset and not hover_only:
                ox, oy = px * OFFSET * offset_sign, py * OFFSET * offset_sign
            else:
                ox, oy = 0, 0

            lx1, ly1 = x1 + ox, y1 + oy
            lx2, ly2 = x2 + ox, y2 + oy

            col = color_from_deviation(dev)

            if self_inverse and not hover_only:
                lines1 = self.ax.plot(
                    [x1+px*OFFSET, x2+px*OFFSET],
                    [y1+py*OFFSET, y2+py*OFFSET],
                    color=col, alpha=alpha, lw=lw, zorder=zord)
                ic_ji  = tuning.interval_cents(j, i)
                dev_ji = abs(ic_ji - JUST_INTERVALS[nearest_just_interval(ic_ji)])
                lines2 = self.ax.plot(
                    [x1-px*OFFSET, x2-px*OFFSET],
                    [y1-py*OFFSET, y2-py*OFFSET],
                    color=color_from_deviation(dev_ji),
                    alpha=alpha, lw=lw, zorder=zord)
                created.extend(lines1)
                created.extend(lines2)
                all_labels.append([
                    x1+px*OFFSET+ux*GAP, y1+py*OFFSET+uy*GAP,
                    ux, uy, fs, i,
                    format_interval_label(ic_ij), is_hovered])
                all_labels.append([
                    x2-px*OFFSET-ux*GAP, y2-py*OFFSET-uy*GAP,
                    -ux, -uy, fs, j,
                    format_interval_label(ic_ji), is_hovered])
            else:
                lines = self.ax.plot(
                    [lx1, lx2], [ly1, ly2],
                    color=col, alpha=alpha, lw=lw, zorder=zord)
                created.extend(lines)
                dir_x = ux if i < j else -ux
                dir_y = uy if i < j else -uy
                all_labels.append([
                    lx1+ux*GAP, ly1+uy*GAP,
                    dir_x, dir_y, fs, i,
                    format_interval_label(ic_ij), is_hovered])

        return created

    # ── Chord / Scale overlay ─────────────────────────────────────────────

    def clear_chord_overlay(self):
        for artist in self._overlay_artists:
            try:
                artist.remove()
            except (ValueError, NotImplementedError):
                pass
        self._overlay_artists = []

    def draw_chord_overlay(self, tuning, tone_data, root_idx, mode='chord'):
        tc = get_theme_colors()
        self.clear_chord_overlay()

        R          = self.R
        pcs        = tuning.pitch_classes
        angles     = tuning.angles
        root_color = tc['accent']
        line_zorder = 4
        tint_alpha  = 0.22

        def _node_xy(idx):
            return R * np.cos(angles[idx]), R * np.sin(angles[idx])

        def _draw_line(idx_a, idx_b, dev):
            col = color_from_deviation(dev)
            ax_, ay_ = _node_xy(idx_a)
            bx_, by_ = _node_xy(idx_b)
            line, = self.ax.plot(
                [ax_, bx_], [ay_, by_],
                color=col, alpha=0.90, lw=2.6,
                linestyle=(0, (5, 3)),
                zorder=line_zorder,
                solid_capstyle='round')
            self._overlay_artists.append(line)

        def _tint_node(idx, color_hex):
            patch = self._node_patches.get(idx)
            if patch is None:
                return
            nx, ny = _node_xy(idx)
            tint = plt.Circle(
                (nx, ny), self.NODE_R,
                color=color_hex, alpha=tint_alpha, zorder=5)
            self.ax.add_patch(tint)
            self._overlay_artists.append(tint)

        rx, ry = _node_xy(root_idx)
        circ = plt.Circle(
            (rx, ry), self.NODE_R + 0.018,
            fill=False, ec=root_color, lw=2.2, zorder=5,
            linestyle='--')
        self.ax.add_patch(circ)
        self._overlay_artists.append(circ)

        if mode == 'chord':
            tone_indices = [root_idx] + [t[0] for t in tone_data]
            for (tidx, _, _) in tone_data:
                _tint_node(tidx, root_color)

            seen_pairs = set()
            for a in range(len(tone_indices)):
                for b in range(a + 1, len(tone_indices)):
                    ia, ib = tone_indices[a], tone_indices[b]
                    pair = (min(ia, ib), max(ia, ib))
                    if pair in seen_pairs:
                        continue
                    seen_pairs.add(pair)
                    ic = min(
                        (pcs[ib] - pcs[ia]) % 1200,
                        (pcs[ia] - pcs[ib]) % 1200)
                    nearest = nearest_just_interval(ic)
                    dev = abs(ic - JUST_INTERVALS[nearest])
                    dev = min(dev,
                              abs(ic - (JUST_INTERVALS[nearest] + 1200)),
                              abs(ic - (JUST_INTERVALS[nearest] - 1200)))
                    _draw_line(ia, ib, dev)
        else:
            all_tone_idxs = {root_idx}
            for (ia, ib, _, _) in tone_data:
                all_tone_idxs.add(ia)
                all_tone_idxs.add(ib)
            for tidx in all_tone_idxs:
                if tidx != root_idx:
                    _tint_node(tidx, root_color)

            for (ia, ib, _just_step, _label) in tone_data:
                actual_step = (pcs[ib] - pcs[ia]) % 1200
                nearest     = nearest_just_interval(actual_step)
                dev         = abs(actual_step - JUST_INTERVALS[nearest])
                dev         = min(dev,
                              abs(actual_step - (JUST_INTERVALS[nearest] + 1200)),
                              abs(actual_step - (JUST_INTERVALS[nearest] - 1200)))
                _draw_line(ia, ib, dev)

        self.canvas.draw()

    # ── Label collision resolver ──────────────────────────────────────────

    def _resolve_and_draw_labels(self, all_pending_labels, angles):
        tc      = get_theme_colors()
        R       = self.R
        GAP_LBL = self.GAP

        node_groups = defaultdict(list)
        for idx, lbl in enumerate(all_pending_labels):
            node_groups[lbl[5]].append(idx)

        for node_i, idxs in node_groups.items():
            nx = R * np.cos(angles[node_i])
            ny = R * np.sin(angles[node_i])

            idxs.sort(key=lambda idx: np.arctan2(
                all_pending_labels[idx][3], all_pending_labels[idx][2]))

            for idx in idxs:
                ux, uy = all_pending_labels[idx][2], all_pending_labels[idx][3]
                all_pending_labels[idx][0] = nx + ux * GAP_LBL
                all_pending_labels[idx][1] = ny + uy * GAP_LBL

            def lbl_box(idx):
                lx, ly = all_pending_labels[idx][0], all_pending_labels[idx][1]
                fs  = all_pending_labels[idx][4]
                txt = all_pending_labels[idx][6]
                w = len(txt) * 0.025 * (fs / 6)
                h = 0.055 * (fs / 6)
                return (lx - w/2, ly - h/2, lx + w/2, ly + h/2)

            def overlaps(b1, b2):
                return not (b1[2] < b2[0] or b2[2] < b1[0] or
                            b1[3] < b2[1] or b2[3] < b1[1])

            for _ in range(50):
                changed = False
                for a in range(len(idxs)):
                    for b in range(a + 1, len(idxs)):
                        ia, ib = idxs[a], idxs[b]
                        if overlaps(lbl_box(ia), lbl_box(ib)):
                            ang_a = np.arctan2(
                                all_pending_labels[ia][1] - ny,
                                all_pending_labels[ia][0] - nx)
                            ang_b = np.arctan2(
                                all_pending_labels[ib][1] - ny,
                                all_pending_labels[ib][0] - nx)
                            delta = 0.04
                            nax = nx + GAP_LBL * np.cos(ang_a - delta)
                            nay = ny + GAP_LBL * np.sin(ang_a - delta)
                            if np.sqrt(nax**2 + nay**2) < R - 0.01:
                                all_pending_labels[ia][0] = nax
                                all_pending_labels[ia][1] = nay
                                changed = True
                            nbx = nx + GAP_LBL * np.cos(ang_b + delta)
                            nby = ny + GAP_LBL * np.sin(ang_b + delta)
                            if np.sqrt(nbx**2 + nby**2) < R - 0.01:
                                all_pending_labels[ib][0] = nbx
                                all_pending_labels[ib][1] = nby
                                changed = True
                if not changed:
                    break

        for item in all_pending_labels:
            lx, ly, ux, uy, fs, node_i, txt, is_hovered = item
            fc = tc['card']
            fw = 'bold' if is_hovered else 'normal'
            fg = tc['fg'] if is_hovered else tc['fg_dim']
            t = self.ax.text(
                lx, ly, txt, ha='center', va='center',
                fontsize=fs, color=fg,
                fontfamily='Helvetica', fontweight=fw, zorder=5,
                bbox=dict(boxstyle='round,pad=0.12', fc=fc,
                          ec=tc['sep'], lw=0.5, alpha=0.9))
            self._dynamic_artists.append(t)


# ─────────────────────────────────────────────
# APPLICATION
# ─────────────────────────────────────────────

class CircleOfFifthsApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Circle of Fifths — Tuning Analyser")

        # ── UI state ──────────────────────────────────────────────────────
        self.n_notes          = tk.IntVar(value=12)
        self.active_intervals = {}
        self.fifth_entries    = []
        self.hover_note       = None
        self._overlay         = None
        self.status_text      = tk.StringVar(value="Load a .scl file or enter fifth sizes, then click Render Tuning.")
        self._toggle_frame    = None
        self._current_system_name = ""   # shown in title bar

        # ── Domain components ─────────────────────────────────────────────
        self.tuning  = None
        self.presets = PresetManager(PRESETS_FILE)

        # ── Render state ──────────────────────────────────────────────────
        self._render_state = None

        # ── Chord / Scale overlay state ───────────────────────────────────
        self._cv_active   = False
        self._cv_mode     = 'chord'
        self._cv_type     = None
        self._cv_root_idx = 0

        self._build_ui()
        self._rebuild_fifth_inputs()

    # ── Theme helpers ─────────────────────────────────────────────────────

    def _tc(self):
        return get_theme_colors()

    # ── UI construction ───────────────────────────────────────────────────

    def _build_ui(self):
        tc   = self._tc()
        MONO = tc['mono']
        SANS = tc['sans']

        self.root.configure(bg=tc['bg'])

        # ── Left panel ────────────────────────────────────────────────────
        left = ctk.CTkFrame(self.root, fg_color=tc['bg'], width=340,
                            corner_radius=0)
        left.pack(side=tk.LEFT, fill=tk.Y, padx=0, pady=0)
        left.pack_propagate(False)

        # ── Fixed header (outside scroll) ─────────────────────────────────
        header = tk.Frame(left, bg=tc['bg'])
        header.pack(side=tk.TOP, fill=tk.X, padx=16, pady=(12, 4))
        tk.Label(header, text="Circle of Fifths",
                 font=(SANS, 18, 'bold'), bg=tc['bg'],
                 fg=tc['fg']).pack(side=tk.LEFT)

        # ── Scrollable left panel content ─────────────────────────────────
        left_canvas = tk.Canvas(left, bg=tc['bg'], highlightthickness=0)
        left_vsb    = ctk.CTkScrollbar(left, command=left_canvas.yview)
        left_canvas.configure(yscrollcommand=left_vsb.set)
        left_vsb.pack(side=tk.RIGHT, fill=tk.Y)
        left_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        linner = tk.Frame(left_canvas, bg=tc['bg'])
        _lwin = left_canvas.create_window((0, 0), window=linner, anchor='nw')
        linner.bind('<Configure>',
            lambda e: left_canvas.configure(
                scrollregion=left_canvas.bbox('all')))
        left_canvas.bind('<Configure>',
            lambda e: left_canvas.itemconfig(_lwin, width=e.width))
        self._bind_scroll_to_canvas(left_canvas)

        # ── App subtitle ──────────────────────────────────────────────────
        tk.Label(linner, text="Interactive Tuning System Analyser",
                 font=(SANS, 10), bg=tc['bg'], fg=tc['fg_dim']).pack(
                 anchor='w', padx=16, pady=(0, 10))

        tk.Frame(linner, bg=tc['sep'], height=1).pack(
            fill=tk.X, padx=16, pady=(0, 10))

        # ── No. of Pitches ────────────────────────────────────────────────
        nf = tk.Frame(linner, bg=tc['bg'])
        nf.pack(fill=tk.X, padx=16, pady=4)
        tk.Label(nf, text="No. of Pitches:", bg=tc['bg'],
                 font=(SANS, 11), fg=tc['fg']).pack(side=tk.LEFT)
        self._n_minus = ctk.CTkButton(nf, text="−", width=28, height=28,
                                       command=lambda: self._adj_n(-1),
                                       fg_color=tc['panel'],
                                       hover_color=tc['card'],
                                       text_color=tc['fg'])
        self._n_minus.pack(side=tk.LEFT, padx=(8, 2))
        self._n_label = tk.Label(nf, textvariable=self.n_notes,
                                  width=3, font=(MONO, 12, 'bold'),
                                  bg=tc['bg'], fg=tc['fg'])
        self._n_label.pack(side=tk.LEFT)
        self._n_plus = ctk.CTkButton(nf, text="+", width=28, height=28,
                                      command=lambda: self._adj_n(+1),
                                      fg_color=tc['panel'],
                                      hover_color=tc['card'],
                                      text_color=tc['fg'])
        self._n_plus.pack(side=tk.LEFT, padx=(2, 8))
        ctk.CTkButton(nf, text="Apply", width=60, height=28,
                       command=self._rebuild_fifth_inputs,
                       fg_color=tc['panel'], hover_color=tc['card'],
                       text_color=tc['fg'],
                       font=(SANS, 10)).pack(side=tk.LEFT)

        # ── SCL import ────────────────────────────────────────────────────
        sf = tk.Frame(linner, bg=tc['bg'])
        sf.pack(fill=tk.X, padx=16, pady=4)
        ctk.CTkButton(sf, text="Import .scl file",
                       command=self._import_scl,
                       fg_color='#2d5a2d', hover_color='#3a7a3a',
                       text_color='#e0ffe0',
                       font=(SANS, 10), height=30).pack(side=tk.LEFT)
        self.scl_label = tk.Label(sf, text="", bg=tc['bg'],
                                   font=(SANS, 9), fg=tc['fg_dim'])
        self.scl_label.pack(side=tk.LEFT, padx=8)

        # ── Presets ───────────────────────────────────────────────────────
        pf = tk.Frame(linner, bg=tc['bg'])
        pf.pack(fill=tk.X, padx=16, pady=4)
        tk.Label(pf, text="Preset:", bg=tc['bg'],
                 font=(SANS, 10), fg=tc['fg']).pack(side=tk.LEFT)
        self.preset_var = tk.StringVar(value="")
        self.preset_dropdown = ctk.CTkComboBox(
            pf, variable=self.preset_var, width=150,
            state='readonly', font=(SANS, 10),
            command=lambda v: self._load_preset())
        self.preset_dropdown.pack(side=tk.LEFT, padx=6)
        ctk.CTkButton(pf, text="Save", command=self._save_preset,
                       width=56, height=28,
                       fg_color=tc['panel'], hover_color=tc['card'],
                       text_color=tc['fg'],
                       font=(SANS, 10)).pack(side=tk.LEFT)
        self._refresh_preset_dropdown()

        # ── Status bar ────────────────────────────────────────────────────
        self._status_lbl = tk.Label(
            linner, textvariable=self.status_text,
            bg=tc['panel'], fg=tc['fg_dim'],
            font=(MONO, 9), wraplength=280,
            justify=tk.LEFT, padx=8, pady=4,
            relief=tk.FLAT)
        self._status_lbl.pack(fill=tk.X, padx=16, pady=6)

        # ── Fifth entry area ──────────────────────────────────────────────
        tk.Label(linner,
                 text="Fifth sizes  (e.g.  3/2  ·  701.955  ·  5^(1/4)):",
                 bg=tc['bg'], font=(SANS, 9), fg=tc['fg_dim']).pack(
                 pady=(4, 2), anchor='w', padx=16)

        fifth_outer = tk.Frame(linner, bg=tc['bg'])
        fifth_outer.pack(fill=tk.BOTH, padx=16)
        self.fifths_canvas = tk.Canvas(fifth_outer, bg=tc['bg'],
                                       highlightthickness=0, height=160)
        fifth_vsb = ctk.CTkScrollbar(fifth_outer,
                                     command=self.fifths_canvas.yview)
        self.fifths_canvas.configure(yscrollcommand=fifth_vsb.set)
        fifth_vsb.pack(side=tk.RIGHT, fill=tk.Y)
        self.fifths_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.fifths_inner = tk.Frame(self.fifths_canvas, bg=tc['bg'])
        self.fifths_canvas.create_window((0, 0), window=self.fifths_inner,
                                          anchor='nw')
        self.fifths_inner.bind('<Configure>',
            lambda e: self.fifths_canvas.configure(
                scrollregion=self.fifths_canvas.bbox('all')))
        self._bind_scroll_to_canvas(self.fifths_canvas)

        # ── Render Tuning + Tuning Stats buttons ──────────────────────────
        ctk.CTkButton(linner, text="Render Tuning",
                       command=self._draw,
                       fg_color=tc['accent'],
                       hover_color='#3a7adf',
                       text_color='#ffffff',
                       font=(SANS, 13, 'bold'),
                       height=38).pack(fill=tk.X, padx=16, pady=(10, 3))
        self._stats_btn = ctk.CTkButton(
            linner, text="Tuning Stats…",
            command=self._open_tuning_stats,
            fg_color=tc['panel'], hover_color=tc['card'],
            text_color=tc['fg_dim'],
            font=(SANS, 10), height=30,
            state='disabled')
        self._stats_btn.pack(fill=tk.X, padx=16, pady=(0, 8))

        tk.Frame(linner, bg=tc['sep'], height=1).pack(
            fill=tk.X, padx=16, pady=(0, 8))

        # ── Render Intervals ──────────────────────────────────────────────
        tk.Label(linner, text="Render Intervals",
                 bg=tc['bg'], font=(SANS, 12, 'bold'),
                 fg=tc['fg']).pack(anchor='w', padx=16, pady=(0, 4))

        tog_outer = tk.Frame(linner, bg=tc['bg'])
        tog_outer.pack(fill=tk.X, padx=16)
        tog_canvas = tk.Canvas(tog_outer, bg=tc['bg'],
                               highlightthickness=0, height=72)
        tog_vsb = ctk.CTkScrollbar(tog_outer, command=tog_canvas.yview)
        tog_canvas.configure(yscrollcommand=tog_vsb.set)
        tog_vsb.pack(side=tk.RIGHT, fill=tk.Y)
        tog_canvas.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self._toggle_frame = tk.Frame(tog_canvas, bg=tc['bg'])
        _togwin = tog_canvas.create_window((0, 0), window=self._toggle_frame,
                                           anchor='nw', width=280)
        self._toggle_frame.bind('<Configure>',
            lambda e: tog_canvas.configure(
                scrollregion=tog_canvas.bbox('all')))
        tog_canvas.bind('<Configure>',
            lambda e: tog_canvas.itemconfig(_togwin, width=max(1, e.width)))
        self._tog_canvas = tog_canvas
        self._bind_scroll_to_canvas(tog_canvas)

        brow = tk.Frame(linner, bg=tc['bg'])
        brow.pack(fill=tk.X, padx=16, pady=4)
        for txt, cmd in [("All", self._show_all), ("Clear", self._clear_all)]:
            ctk.CTkButton(brow, text=txt, command=cmd,
                           width=56, height=28,
                           fg_color=tc['panel'], hover_color=tc['card'],
                           text_color=tc['fg'],
                           font=(SANS, 10)).pack(side=tk.LEFT, padx=(0, 6))

        tk.Frame(linner, bg=tc['sep'], height=1).pack(
            fill=tk.X, padx=16, pady=(6, 4))

        # ── Legend ────────────────────────────────────────────────────────
        tk.Label(linner, text="Deviation from Pure Intonation",
                 bg=tc['bg'], font=(SANS, 10, 'bold'),
                 fg=tc['fg']).pack(anchor='w', padx=16, pady=(4, 1))
        tk.Label(linner,
                 text="Psychoacoustic thresholds (cents deviation from just ratio)",
                 bg=tc['bg'], font=(SANS, 8), fg=tc['fg_dim']).pack(
                 anchor='w', padx=16, pady=(0, 2))

        # ── Right sidebar ─────────────────────────────────────────────────
        right_sidebar = ctk.CTkFrame(self.root, fg_color=tc['bg'],
                                     width=270, corner_radius=0)
        right_sidebar.pack(side=tk.RIGHT, fill=tk.Y)
        right_sidebar.pack_propagate(False)

        # ── Centre panel (circle) ─────────────────────────────────────────
        right_panel = ctk.CTkFrame(self.root, fg_color=tc['bg'],
                                   corner_radius=0)
        right_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self._left_inner   = linner
        self._right_panel  = right_panel
        self._right_sidebar = right_sidebar

        self.renderer = Renderer(right_panel, bg=tc['bg'])
        self.renderer.canvas.mpl_connect('motion_notify_event', self._on_hover)

        # Legend canvas embedded in left panel
        legend_canvas = FigureCanvasTkAgg(
            self.renderer.legend_fig, master=linner)
        legend_canvas.get_tk_widget().pack(
            fill=tk.X, padx=16, pady=(0, 4))
        self.renderer.draw_legend()

        # ── Analysis panel ────────────────────────────────────────────────
        tk.Frame(linner, bg=tc['sep'], height=1).pack(
            fill=tk.X, padx=16, pady=(4, 2))
        self.analysis_text = tk.Text(
            linner, bg=tc['bg'], fg=tc['fg'],
            font=(MONO, 10), wrap=tk.WORD,
            relief=tk.FLAT, height=13,
            state=tk.DISABLED, cursor='arrow',
            insertbackground=tc['fg'])
        self.analysis_text.tag_configure('rough',  foreground=tc['rough'])
        self.analysis_text.tag_configure('header', foreground=tc['fg'],
                                          font=(SANS, 11, 'bold'))
        self.analysis_text.tag_configure('normal', foreground=tc['fg_dim'])
        self.analysis_text.pack(fill=tk.X, padx=16, pady=2)
        self._set_analysis("Hover over a note, or toggle one interval class.")

        # ── Right sidebar content ─────────────────────────────────────────
        self._build_right_sidebar(right_sidebar, tc, SANS, MONO)

        # ── Welcome overlay (shown until first render) ────────────────────
        self._build_welcome_overlay(right_panel, tc, SANS)

        # Keybinds
        self.root.bind('<f>', self._toggle_panel_fullscreen)
        self.root.bind('<F>', self._toggle_panel_fullscreen)
        self.root.bind('<Left>',  lambda e: self._cv_cycle(-1))
        self.root.bind('<Right>', lambda e: self._cv_cycle(+1))

    # ── Welcome overlay ───────────────────────────────────────────────────

    def _build_welcome_overlay(self, parent, tc, SANS):
        """Fullscreen welcome shown until the first tuning is rendered."""
        self._welcome = tk.Frame(parent, bg=tc['bg'])
        self._welcome.place(relx=0, rely=0, relwidth=1, relheight=1)

        inner = tk.Frame(self._welcome, bg=tc['bg'])
        inner.place(relx=0.5, rely=0.45, anchor='center')

        tk.Label(inner, text="Circle of Fifths",
                 font=(SANS, 32, 'bold'), bg=tc['bg'],
                 fg=tc['fg']).pack(pady=(0, 4))
        tk.Label(inner, text="Interactive Tuning System Analyser",
                 font=(SANS, 14), bg=tc['bg'],
                 fg=tc['fg_dim']).pack(pady=(0, 32))

        ctk.CTkButton(inner, text="Import .scl file",
                       command=self._import_scl,
                       fg_color='#2d5a2d', hover_color='#3a7a3a',
                       text_color='#e0ffe0',
                       font=(SANS, 13), width=220, height=40).pack(pady=6)

        tk.Label(inner, text="— or —",
                 font=(SANS, 10), bg=tc['bg'],
                 fg=tc['fg_dim']).pack(pady=4)

        # Preset quick-load row
        preset_row = tk.Frame(inner, bg=tc['bg'])
        preset_row.pack(pady=4)
        names = self.presets.list_presets()
        if names:
            tk.Label(preset_row, text="Load preset:",
                     font=(SANS, 10), bg=tc['bg'],
                     fg=tc['fg_dim']).pack(side=tk.LEFT, padx=(0, 6))
            self._welcome_preset_var = tk.StringVar(value=names[0])
            ctk.CTkComboBox(preset_row,
                             variable=self._welcome_preset_var,
                             values=names, width=160,
                             font=(SANS, 10),
                             state='readonly').pack(side=tk.LEFT, padx=(0, 6))
            ctk.CTkButton(preset_row, text="Load",
                           command=self._welcome_load_preset,
                           fg_color=tc['accent'],
                           text_color='#ffffff',
                           font=(SANS, 10), width=60, height=30).pack(
                           side=tk.LEFT)
        else:
            tk.Label(preset_row,
                     text="Enter fifth sizes in the left panel,\nthen click Render Tuning.",
                     font=(SANS, 11), bg=tc['bg'],
                     fg=tc['fg_dim'], justify=tk.CENTER).pack()

        tk.Label(inner,
                 text="— or enter fifth sizes in the left panel —",
                 font=(SANS, 10), bg=tc['bg'],
                 fg=tc['fg_dim']).pack(pady=(8, 0))

    def _welcome_load_preset(self):
        name = self._welcome_preset_var.get()
        self.preset_var.set(name)
        self._load_preset()

    def _dismiss_welcome(self):
        if hasattr(self, '_welcome') and self._welcome.winfo_exists():
            self._welcome.destroy()

    # ── Input helpers ─────────────────────────────────────────────────────

    def _adj_n(self, delta):
        new = max(3, min(53, self.n_notes.get() + delta))
        self.n_notes.set(new)

    @staticmethod
    def _make_scroll_handler(canvas):
        import platform
        _platform = platform.system()

        def on_wheel(e):
            if not canvas.winfo_exists(): return
            canvas.yview_scroll(
                int(-1 * e.delta) if _platform == 'Darwin'
                else int(-1 * (e.delta / 120)), 'units')

        def on_b4(e):
            if canvas.winfo_exists(): canvas.yview_scroll(-1, 'units')
        def on_b5(e):
            if canvas.winfo_exists(): canvas.yview_scroll(1, 'units')

        return on_wheel, on_b4, on_b5

    @staticmethod
    def _bind_scroll_to_canvas(canvas):
        on_wheel, on_b4, on_b5 = CircleOfFifthsApp._make_scroll_handler(canvas)
        canvas.bind('<Enter>', lambda e: (
            canvas.bind_all('<MouseWheel>', on_wheel),
            canvas.bind_all('<Button-4>', on_b4),
            canvas.bind_all('<Button-5>', on_b5)))
        canvas.bind('<Leave>', lambda e: (
            canvas.unbind_all('<MouseWheel>'),
            canvas.unbind_all('<Button-4>'),
            canvas.unbind_all('<Button-5>')))

    def _rebuild_step_toggles(self, n):
        tc = self._tc()
        for w in self._toggle_frame.winfo_children():
            w.destroy()
        self.active_intervals = {}
        self._step_buttons    = {}
        cols = 5
        for step in range(1, n):
            var = tk.BooleanVar(value=False)
            self.active_intervals[step] = var
            cb = tk.Checkbutton(
                self._toggle_frame, text=f"s{step}",
                variable=var, bg=tc['bg'],
                fg=tc['fg'], selectcolor=tc['card'],
                activebackground=tc['bg'],
                activeforeground=tc['fg'],
                font=('Courier New', 9),
                command=self._draw)
            cb.grid(row=(step-1)//cols, column=(step-1)%cols,
                    sticky='w', padx=1, pady=0)
            self._step_buttons[step] = cb
        self._tog_canvas.configure(
            scrollregion=self._tog_canvas.bbox('all'))

    def _update_step_labels(self):
        if self.tuning is None or not hasattr(self, '_step_buttons'):
            return
        for step, cb in self._step_buttons.items():
            cb.config(text=self.tuning.step_label(step))

    def _rebuild_fifth_inputs(self):
        tc = self._tc()
        for w in self.fifths_inner.winfo_children():
            w.destroy()
        n = self.n_notes.get()
        self.fifth_entries = []
        names = get_note_names(n)
        for i in range(n):
            row = tk.Frame(self.fifths_inner, bg=tc['bg'])
            row.pack(fill=tk.X, pady=1)
            tk.Label(row, text=f"{names[i]}→{names[(i+1)%n]}",
                     width=8, anchor='w', bg=tc['bg'],
                     font=('Helvetica', 9), fg=tc['fg_dim']).pack(side=tk.LEFT)
            var = tk.StringVar(value='')
            tk.Entry(row, textvariable=var, width=14,
                     font=('Courier New', 10), relief=tk.FLAT,
                     bg=tc['card'], fg=tc['fg'],
                     insertbackground=tc['fg']).pack(side=tk.LEFT, padx=4)
            self.fifth_entries.append(var)
        self._rebuild_step_toggles(n)
        self.status_text.set(f"Enter {n} fifth size(s) then click Render Tuning.")

    def _parse_all_fifths(self):
        sizes = []
        for i, var in enumerate(self.fifth_entries):
            raw = var.get().strip()
            if not raw:
                self.status_text.set(f"Fifth {i+1} is empty.")
                return None
            try:
                sizes.append(parse_fifth_input(raw))
            except Exception as e:
                self.status_text.set(f"Fifth {i+1}: {e}")
                return None
        return sizes

    # ── Draw ──────────────────────────────────────────────────────────────

    def _draw(self):
        sizes = self._parse_all_fifths()
        if sizes is None:
            return

        self.tuning = TuningSystem.from_fifth_sizes(sizes)

        step_state = self.tuning.active_step_state(self.active_intervals)
        hover_only = (step_state['n_active'] == 0 and
                      self.hover_note is not None)
        self._render_state = {**step_state, 'hover_only': hover_only}

        self.renderer.draw_static(self.tuning)
        self.renderer.draw_dynamic(
            self.tuning,
            hover_note   = self.hover_note,
            active_steps = step_state['active_steps'],
            n_active     = step_state['n_active'],
            lbl_fs       = step_state['lbl_fs'],
            hover_only   = hover_only,
        )

        if self._cv_active:
            self._cv_apply_overlay()

        self.status_text.set(
            f"{self.tuning.n}-note system rendered  ·  "
            f"hover notes to inspect intervals")
        self._update_step_labels()
        self._update_analysis_panel()
        self._stats_btn.configure(state='normal')
        self._cv_refresh_ui()
        self._dismiss_welcome()

        # Update window title with system info
        n = self.tuning.n
        self.root.title(
            f"{self._current_system_name or f'{n}-note tuning system'}"
            f"  —  Circle of Fifths Analyser")

    # ── Right sidebar ─────────────────────────────────────────────────────

    def _build_right_sidebar(self, sb, tc, SANS, MONO):
        # Inner scroll for sidebar
        sb_canvas = tk.Canvas(sb, bg=tc['bg'], highlightthickness=0)
        sb_vsb    = ctk.CTkScrollbar(sb, command=sb_canvas.yview)
        sb_canvas.configure(yscrollcommand=sb_vsb.set)
        sb_vsb.pack(side=tk.RIGHT, fill=tk.Y)
        sb_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        sbinner = tk.Frame(sb_canvas, bg=tc['bg'])
        _sbwin = sb_canvas.create_window((0, 0), window=sbinner, anchor='nw')
        sbinner.bind('<Configure>',
            lambda e: sb_canvas.configure(
                scrollregion=sb_canvas.bbox('all')))
        sb_canvas.bind('<Configure>',
            lambda e: sb_canvas.itemconfig(_sbwin, width=e.width))
        self._bind_scroll_to_canvas(sb_canvas)

        tk.Label(sbinner, text="Render Chords / Scales",
                 font=(SANS, 13, 'bold'), bg=tc['bg'],
                 fg=tc['fg']).pack(anchor='w', padx=14, pady=(14, 1))
        tk.Label(sbinner, text="Visualise chords and scales on the circle",
                 font=(SANS, 9), bg=tc['bg'], fg=tc['fg_dim']).pack(
                 anchor='w', padx=14, pady=(0, 8))

        tk.Frame(sbinner, bg=tc['sep'], height=1).pack(
            fill=tk.X, padx=14, pady=(0, 8))

        # Mode selector
        mode_fr = tk.Frame(sbinner, bg=tc['bg'])
        mode_fr.pack(fill=tk.X, padx=14, pady=(0, 6))
        tk.Label(mode_fr, text="Mode:", bg=tc['bg'],
                 font=(SANS, 10), fg=tc['fg']).pack(side=tk.LEFT)
        self._cv_mode_var = tk.StringVar(value='Chord')
        for txt in ('Chord', 'Scale'):
            tk.Radiobutton(mode_fr, text=txt, variable=self._cv_mode_var,
                           value=txt, bg=tc['bg'], fg=tc['fg'],
                           selectcolor=tc['card'],
                           activebackground=tc['bg'],
                           activeforeground=tc['fg'],
                           font=(SANS, 10),
                           command=self._cv_on_mode_change).pack(
                           side=tk.LEFT, padx=(6, 0))

        # Type dropdown
        type_fr = tk.Frame(sbinner, bg=tc['bg'])
        type_fr.pack(fill=tk.X, padx=14, pady=(0, 6))
        tk.Label(type_fr, text="Type:", bg=tc['bg'],
                 font=(SANS, 10), fg=tc['fg'], width=5,
                 anchor='w').pack(side=tk.LEFT)
        self._cv_type_var = tk.StringVar()
        self._cv_type_dd  = ctk.CTkComboBox(
            type_fr, variable=self._cv_type_var,
            width=180, state='readonly', font=(SANS, 10),
            command=lambda v: self._cv_on_type_change())
        self._cv_type_dd.pack(side=tk.LEFT, padx=(4, 0))

        tk.Frame(sbinner, bg=tc['sep'], height=1).pack(
            fill=tk.X, padx=14, pady=(4, 6))

        # Root navigator
        root_fr = tk.Frame(sbinner, bg=tc['bg'])
        root_fr.pack(fill=tk.X, padx=14, pady=(0, 4))
        tk.Label(root_fr, text="Root:", bg=tc['bg'],
                 font=(SANS, 10), fg=tc['fg'], width=5,
                 anchor='w').pack(side=tk.LEFT)
        self._cv_root_label = tk.Label(
            root_fr, text="—",
            bg=tc['card'], fg=tc['fg'],
            font=(MONO, 12, 'bold'), width=5,
            anchor='center', relief=tk.FLAT, padx=4)
        self._cv_root_label.pack(side=tk.LEFT, padx=(4, 6))
        self._cv_prev_btn = ctk.CTkButton(
            root_fr, text="◀", width=30, height=28,
            fg_color=tc['panel'], hover_color=tc['card'],
            text_color=tc['fg'],
            command=lambda: self._cv_cycle(-1))
        self._cv_prev_btn.pack(side=tk.LEFT, padx=(0, 2))
        self._cv_next_btn = ctk.CTkButton(
            root_fr, text="▶", width=30, height=28,
            fg_color=tc['panel'], hover_color=tc['card'],
            text_color=tc['fg'],
            command=lambda: self._cv_cycle(+1))
        self._cv_next_btn.pack(side=tk.LEFT)

        tk.Frame(sbinner, bg=tc['sep'], height=1).pack(
            fill=tk.X, padx=14, pady=(4, 6))

        # Render / Clear buttons
        btn_fr = tk.Frame(sbinner, bg=tc['bg'])
        btn_fr.pack(fill=tk.X, padx=14, pady=(0, 4))
        self._cv_show_btn = ctk.CTkButton(
            btn_fr, text="Render",
            command=self._cv_activate,
            fg_color=tc['accent'],
            hover_color='#3a7adf',
            text_color='#ffffff',
            font=(SANS, 11, 'bold'),
            height=34, width=100)
        self._cv_show_btn.pack(side=tk.LEFT, padx=(0, 6))
        self._cv_clear_btn = ctk.CTkButton(
            btn_fr, text="Clear",
            command=self._cv_clear,
            fg_color=tc['panel'], hover_color=tc['card'],
            text_color=tc['fg'],
            font=(SANS, 10), height=34, width=70)
        self._cv_clear_btn.pack(side=tk.LEFT)

        self._cv_status_lbl = tk.Label(
            sbinner, text="No overlay active",
            bg=tc['bg'], fg=tc['fg_dim'],
            font=(SANS, 9), anchor='w', wraplength=230)
        self._cv_status_lbl.pack(anchor='w', padx=14, pady=(0, 6))

        tk.Frame(sbinner, bg=tc['sep'], height=1).pack(
            fill=tk.X, padx=14, pady=(4, 6))

        # Deviation summary
        tk.Label(sbinner, text="Interval Deviations (From Just)",
                 bg=tc['bg'], font=(SANS, 9, 'bold'),
                 fg=tc['fg']).pack(anchor='w', padx=14, pady=(0, 2))
        self._cv_detail_text = tk.Text(
            sbinner, bg=tc['bg'], fg=tc['fg'],
            font=(MONO, 9), wrap=tk.NONE,
            relief=tk.FLAT, height=10,
            state=tk.DISABLED, cursor='arrow',
            insertbackground=tc['fg'])
        self._cv_detail_text.tag_configure('rough',  foreground=tc['rough'])
        self._cv_detail_text.tag_configure('header', foreground=tc['fg'],
                                            font=(SANS, 10, 'bold'))
        self._cv_detail_text.tag_configure('normal', foreground=tc['fg_dim'])
        self._cv_detail_text.tag_configure('pure',   foreground=tc['pure'])
        self._cv_detail_text.pack(fill=tk.X, padx=14, pady=(0, 4))

        tk.Frame(sbinner, bg=tc['sep'], height=1).pack(
            fill=tk.X, padx=14, pady=(4, 6))

        # Keyboard shortcuts
        tk.Label(sbinner, text="Keyboard Shortcuts",
                 bg=tc['bg'], font=(SANS, 9, 'bold'),
                 fg=tc['fg']).pack(anchor='w', padx=14, pady=(0, 4))
        for key, desc in [
            ('← / →', 'Cycle chord/scale root'),
            ('F',      'Fullscreen analysis panel'),
        ]:
            row = tk.Frame(sbinner, bg=tc['bg'])
            row.pack(fill=tk.X, padx=14, pady=1)
            tk.Label(row, text=key, bg=tc['card'], fg=tc['fg'],
                     font=(MONO, 9), width=7,
                     anchor='center', relief=tk.FLAT, padx=3).pack(
                     side=tk.LEFT)
            tk.Label(row, text=desc, bg=tc['bg'], fg=tc['fg_dim'],
                     font=(SANS, 9)).pack(side=tk.LEFT, padx=(6, 0))

        self._cv_populate_type_dropdown()
        self._cv_refresh_ui()
        self._cv_set_detail([("Select a chord or scale,", 'normal'),
                             ("then press Render.", 'normal')])

    # ── Chord/Scale view (logic unchanged, UI updated) ────────────────────

    def _cv_populate_type_dropdown(self):
        if self._cv_mode_var.get() == 'Chord':
            values = list(CHORD_DEFINITIONS.keys())
        else:
            values = list(HEPTATONIC_MODES.keys())
        self._cv_type_dd.configure(values=values)
        if not self._cv_type_var.get() or self._cv_type_var.get() not in values:
            self._cv_type_var.set(values[0])

    def _cv_on_mode_change(self):
        self._cv_mode = self._cv_mode_var.get().lower()
        self._cv_populate_type_dropdown()
        self._cv_root_idx = 0
        self._cv_type = self._cv_type_var.get()
        if self._cv_active:
            self._cv_apply_overlay()
        self._cv_refresh_ui()

    def _cv_on_type_change(self):
        self._cv_type = self._cv_type_var.get()
        self._cv_root_idx = 0
        if self._cv_active:
            self._cv_apply_overlay()
        self._cv_refresh_ui()

    def _cv_activate(self):
        if self.tuning is None:
            self.status_text.set("Render a tuning system first.")
            return
        self._cv_active = True
        self._cv_mode   = self._cv_mode_var.get().lower()
        self._cv_type   = self._cv_type_var.get()
        self._cv_apply_overlay()
        self._cv_refresh_ui()

    def _cv_clear(self):
        self._cv_active = False
        self.renderer.clear_chord_overlay()
        self.renderer.canvas.draw()
        self._cv_refresh_ui()

    def _cv_cycle(self, direction):
        if self.tuning is None or not self._cv_active:
            return
        n = self.tuning.n
        self._cv_root_idx = (self._cv_root_idx + direction) % n
        self._cv_apply_overlay()
        self._cv_refresh_ui()

    def _cv_resolve_tone_data(self):
        if self.tuning is None:
            return None, None

        mode     = self._cv_mode_var.get().lower()
        typ      = self._cv_type_var.get()
        pcs      = self.tuning.pitch_classes
        n        = self.tuning.n
        root_idx = self._cv_root_idx % n
        root_pc  = pcs[root_idx]

        if mode == 'chord':
            intervals = CHORD_DEFINITIONS.get(typ, [])
            tone_data = []
            for (just_cents, label) in intervals:
                needed   = (root_pc + just_cents) % 1200
                best_idx = min(range(n),
                    key=lambda k, nd=needed: min(
                        abs(pcs[k] - nd),
                        abs(pcs[k] - nd + 1200),
                        abs(pcs[k] - nd - 1200)))
                tone_data.append((best_idx, just_cents, label))
            return tone_data, root_idx
        else:
            if n != 12:
                return None, None
            steps = HEPTATONIC_MODES.get(typ, [])
            tone_indices = [root_idx]
            acc = 0.0
            for st in steps[:-1]:
                acc += st
                needed   = (root_pc + acc) % 1200
                best_idx = min(range(n),
                    key=lambda k, nd=needed: min(
                        abs(pcs[k] - nd),
                        abs(pcs[k] - nd + 1200),
                        abs(pcs[k] - nd - 1200)))
                tone_indices.append(best_idx)

            tone_indices_sorted = sorted(
                tone_indices, key=lambda k: (pcs[k] - root_pc) % 1200)

            tone_data = []
            for i in range(len(steps) - 1):
                ia    = tone_indices_sorted[i]
                ib    = tone_indices_sorted[i + 1]
                label = f"→{self.tuning.note_names[ib]}"
                tone_data.append((ia, ib, steps[i], label))
            # closing step: 7th degree → root (the final step that completes the octave)
            ia_last = tone_indices_sorted[-1]
            ib_last = tone_indices_sorted[0]
            tone_data.append((ia_last, ib_last, steps[-1],
                              f"→{self.tuning.note_names[ib_last]}"))
            return tone_data, root_idx

    def _cv_apply_overlay(self):
        if self.tuning is None or not self._cv_active:
            return
        self._cv_mode = self._cv_mode_var.get().lower()
        self._cv_type = self._cv_type_var.get()

        if self._cv_mode == 'scale' and self.tuning.n != 12:
            self.renderer.clear_chord_overlay()
            self.renderer.canvas.draw()
            self._cv_set_detail([("Scale view requires a 12-tone system.", 'header')])
            return

        tone_data, root_idx = self._cv_resolve_tone_data()
        if tone_data is None:
            return

        self.renderer.draw_chord_overlay(
            self.tuning, tone_data, root_idx, mode=self._cv_mode)
        self._cv_update_detail(tone_data, root_idx)

    def _cv_update_detail(self, tone_data, root_idx):
        if self.tuning is None:
            return

        mode       = self._cv_mode_var.get().lower()
        pcs        = self.tuning.pitch_classes
        note_names = self.tuning.note_names
        lines      = []
        root_name  = note_names[root_idx]

        lines.append((f"── {root_name} ──", 'header'))

        if mode == 'chord':
            all_idxs = [root_idx] + [t[0] for t in tone_data]
            seen = set()
            for a in range(len(all_idxs)):
                for b in range(a + 1, len(all_idxs)):
                    ia, ib = all_idxs[a], all_idxs[b]
                    pair = (min(ia, ib), max(ia, ib))
                    if pair in seen:
                        continue
                    seen.add(pair)
                    ic = min(
                        (pcs[ib] - pcs[ia]) % 1200,
                        (pcs[ia] - pcs[ib]) % 1200)
                    nearest = nearest_just_interval(ic)
                    just_c  = JUST_INTERVALS[nearest]
                    dev     = ic - just_c
                    dist    = abs(dev)
                    dist    = min(dist,
                                  abs(ic - (just_c + 1200)),
                                  abs(ic - (just_c - 1200)))
                    sign    = '+' if dev >= 0 else ''
                    tag     = ('rough' if dist >= 12 else
                               'pure'  if dist <  5  else 'normal')
                    lines.append(
                        (f"  {note_names[ia]}<>{note_names[ib]}"
                         f"  {ic:6.1f}c  ~{nearest}"
                         f"  {sign}{dev:.1f}c", tag))
        else:
            for (ia, ib, _just_step, _label) in tone_data:
                actual  = (pcs[ib] - pcs[ia]) % 1200
                nearest = nearest_just_interval(actual)
                just_c  = JUST_INTERVALS[nearest]
                dev     = actual - just_c
                dist    = abs(dev)
                dist    = min(dist,
                             abs(actual - (just_c + 1200)),
                             abs(actual - (just_c - 1200)))
                sign    = '+' if dev >= 0 else ''
                tag     = ('rough' if dist >= 12 else
                           'pure'  if dist <  5  else 'normal')
                lines.append(
                    (f"  {note_names[ia]}->{note_names[ib]}"
                     f"  {actual:6.1f}c  ~{nearest}"
                     f"  {sign}{dev:.1f}c", tag))

        self._cv_set_detail(lines)

    def _cv_set_detail(self, lines):
        self._cv_detail_text.config(state=tk.NORMAL)
        self._cv_detail_text.delete('1.0', tk.END)
        for txt, tag in lines:
            self._cv_detail_text.insert(tk.END, txt + '\n', tag)
        self._cv_detail_text.config(state=tk.DISABLED)

    def _cv_refresh_ui(self):
        tc = self._tc()
        nav_state = 'normal' if self._cv_active else 'disabled'
        self._cv_prev_btn.configure(state=nav_state)
        self._cv_next_btn.configure(state=nav_state)

        if self.tuning is not None and self._cv_active:
            idx = self._cv_root_idx % self.tuning.n
            self._cv_root_label.config(
                text=self.tuning.note_names[idx], fg=tc['fg'])
        else:
            self._cv_root_label.config(text="—", fg=tc['fg_dim'])

        mode = self._cv_mode_var.get().lower()
        if not self._cv_active:
            self._cv_status_lbl.config(text="No overlay active.", fg=tc['fg_dim'])
        elif mode == 'scale' and self.tuning is not None and self.tuning.n != 12:
            self._cv_status_lbl.config(
                text="⚠ Scale view requires n=12", fg='#ffaa44')
        else:
            root_name = (self.tuning.note_names[self._cv_root_idx % self.tuning.n]
                         if self.tuning else "")
            self._cv_status_lbl.config(
                text=f"Active · {self._cv_type_var.get()}  root: {root_name}",
                fg=tc['accent'])

        show_state = 'normal' if self.tuning is not None else 'disabled'
        self._cv_show_btn.configure(state=show_state)
        clear_state = 'normal' if self._cv_active else 'disabled'
        self._cv_clear_btn.configure(state=clear_state)

    # ── Tuning Stats ──────────────────────────────────────────────────────

    def _open_tuning_stats(self):
        if self.tuning is None:
            return
        TuningStatsWindow(self.root, self.tuning)

    # ── Analysis panel ────────────────────────────────────────────────────

    def _update_analysis_panel(self):
        if self.tuning is None:
            return
        if self.hover_note is not None:
            return

        active_step_nums = [s for s, _ in self._render_state['active_steps']]
        if len(active_step_nums) == 1:
            lines = self.tuning.step_analysis_lines(active_step_nums[0])
            self._set_analysis(None, lines)
        elif len(active_step_nums) == 0:
            self._set_analysis(
                "Hover over a note, or toggle one interval class.")
        else:
            self._set_analysis(
                f"{len(active_step_nums)} interval classes shown.\n"
                f"Toggle just one to see deviation analysis,\n"
                f"or hover a note for its intervals.")

    def _on_hover(self, event):
        if self.tuning is None or self._render_state is None:
            return
        if event.inaxes != self.renderer.ax:
            return
        mx, my = event.xdata, event.ydata
        if mx is None:
            return

        node_positions = self.renderer.node_positions
        if not node_positions:
            return

        dists   = [np.sqrt((mx-x)**2 + (my-y)**2) for x, y in node_positions]
        closest = int(np.argmin(dists))

        if dists[closest] < 0.13:
            if self.hover_note != closest:
                self.hover_note = closest
                hover_only = (self._render_state['n_active'] == 0)
                self._render_state = {**self._render_state,
                                      'hover_only': hover_only}
                self._set_analysis(None, self.tuning.tooltip_lines(closest))
                self.renderer.draw_dynamic(
                    self.tuning,
                    hover_note   = self.hover_note,
                    active_steps = self._render_state['active_steps'],
                    n_active     = self._render_state['n_active'],
                    lbl_fs       = self._render_state['lbl_fs'],
                    hover_only   = hover_only,
                )
        else:
            if self.hover_note is not None:
                self.hover_note = None
                self._render_state = {**self._render_state, 'hover_only': False}
                self.renderer.draw_dynamic(
                    self.tuning,
                    hover_note   = None,
                    active_steps = self._render_state['active_steps'],
                    n_active     = self._render_state['n_active'],
                    lbl_fs       = self._render_state['lbl_fs'],
                    hover_only   = False,
                )
                self._update_analysis_panel()

    def _set_analysis(self, text, lines=None):
        self.analysis_text.config(state=tk.NORMAL)
        self.analysis_text.delete('1.0', tk.END)
        if lines:
            for txt, tag in lines:
                self.analysis_text.insert(tk.END, txt + '\n', tag)
        else:
            self.analysis_text.insert(tk.END, text, 'normal')
        self.analysis_text.config(state=tk.DISABLED)

    # ── Presets ───────────────────────────────────────────────────────────

    def _refresh_preset_dropdown(self):
        names = self.presets.list_presets()
        self.preset_dropdown.configure(values=names)
        if self.preset_var.get() not in names:
            self.preset_var.set(names[0] if names else "")

    def _save_preset(self):
        sizes = self._parse_all_fifths()
        if sizes is None:
            return
        import tkinter.simpledialog as sd
        name = sd.askstring("Save Preset", "Enter a name for this preset:",
                            parent=self.root)
        if not name or not name.strip():
            return
        name    = name.strip()
        entries = [var.get() for var in self.fifth_entries]
        self.presets.save(name, len(self.fifth_entries), entries)
        self._refresh_preset_dropdown()
        self.preset_var.set(name)
        self.status_text.set(f"Preset '{name}' saved.")

    def _load_preset(self):
        name = self.preset_var.get().strip()
        if not name:
            return
        try:
            p = self.presets.load(name)
        except KeyError as e:
            self.status_text.set(str(e))
            return
        self.n_notes.set(p['n'])
        self._rebuild_fifth_inputs()
        for i, val in enumerate(p['entries']):
            if i < len(self.fifth_entries):
                self.fifth_entries[i].set(val)
        self._current_system_name = name
        self.status_text.set(f"Loaded preset '{name}'.")
        self._draw()

    # ── SCL import ────────────────────────────────────────────────────────

    def _import_scl(self):
        filepath = filedialog.askopenfilename(
            filetypes=[("Scala files","*.scl"), ("All files","*.*")])
        if not filepath:
            return
        try:
            desc, n, fifth_sizes, warning = load_scl_file(filepath)
            self.n_notes.set(n)
            self._rebuild_fifth_inputs()
            for var, size in zip(self.fifth_entries, fifth_sizes):
                var.set(f"{size:.4f}")
            if len(fifth_sizes) < len(self.fifth_entries):
                warning = (warning or "") + (
                    f" Warning: SCL declared {n} pitches but only "
                    f"{len(fifth_sizes)} could be resolved.")
            self.scl_label.config(text=os.path.basename(filepath))
            self._current_system_name = desc
            if warning:
                self.status_text.set(warning)
            else:
                wolf = max(fifth_sizes)
                self.status_text.set(
                    f"Loaded: {desc} | {n} notes | wolf fifth ≈ {wolf:.2f}c")
            self._draw()
        except Exception as e:
            self.status_text.set(f"Import error: {e}")

    # ── Toggle helpers ────────────────────────────────────────────────────

    def _show_all(self):
        for v in self.active_intervals.values():
            v.set(True)
        self._draw()

    def _clear_all(self):
        for v in self.active_intervals.values():
            v.set(False)
        self._draw()

    # ── Fullscreen overlay ────────────────────────────────────────────────

    def _toggle_panel_fullscreen(self, event=None):
        tc = self._tc()
        if getattr(self, '_overlay', None) and self._overlay.winfo_exists():
            self._overlay.destroy()
            self._overlay = None
            return

        overlay = tk.Toplevel(self.root)
        self._overlay = overlay
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        overlay.geometry(f"{sw}x{sh}+0+0")
        overlay.overrideredirect(True)
        overlay.configure(bg=tc['bg'])

        outer = tk.Frame(overlay, bg=tc['bg'])
        outer.place(relx=0.5, rely=0.5, anchor='center',
                    width=min(900, sw - 120), height=sh - 120)

        txt = tk.Text(outer, bg=tc['bg'], fg=tc['fg'],
                      font=('Courier New', 18), wrap=tk.WORD,
                      relief=tk.FLAT, cursor='arrow')
        txt.tag_configure('rough',  foreground=tc['rough'])
        txt.tag_configure('header', foreground=tc['fg'],
                          font=('Helvetica', 20, 'bold'))
        txt.tag_configure('normal', foreground=tc['fg_dim'])

        content = self.analysis_text.get('1.0', tk.END)
        txt.insert('1.0', content)
        for tag in ('rough', 'header', 'normal'):
            ranges = self.analysis_text.tag_ranges(tag)
            for i in range(0, len(ranges), 2):
                txt.tag_add(tag, str(ranges[i]), str(ranges[i+1]))
        txt.config(state=tk.DISABLED)
        txt.pack(fill=tk.BOTH, expand=True)

        hint = tk.Label(overlay, text="Press F or Esc to close",
                        bg=tc['bg'], fg=tc['fg_dim'],
                        font=('Helvetica', 12))
        hint.place(relx=1.0, rely=1.0, anchor='se', x=-20, y=-16)

        def close(e=None):
            self._overlay = None
            overlay.destroy()
            self.root.focus_force()
            self.root.unbind('<f>')
            self.root.unbind('<F>')
            self.root.after(200, lambda: (
                self.root.bind('<f>', self._toggle_panel_fullscreen),
                self.root.bind('<F>', self._toggle_panel_fullscreen)
            ))

        overlay.bind('<f>', close)
        overlay.bind('<F>', close)
        overlay.bind('<Escape>', close)
        overlay.focus_force()


if __name__ == '__main__':
    root = ctk.CTk()
    root.geometry('1400x900')
    root.minsize(900, 600)
    root.title("Circle of Fifths — Tuning Analyser")
    app = CircleOfFifthsApp(root)
    root.mainloop()
