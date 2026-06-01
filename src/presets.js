const STORAGE_KEY = 'cof_presets';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function listPresets() {
  return Object.keys(readAll());
}

export function loadPreset(name) {
  const presets = readAll();
  if (!(name in presets)) throw new Error(`Preset '${name}' not found.`);
  return presets[name];
}

export function savePreset(name, n, entries) {
  const presets = readAll();
  presets[name] = { n, entries };
  writeAll(presets);
}