import { FluidGlass } from './vendor/fluid-glass/material.mjs';

const STORAGE_KEY = 'augurwell.sheet-transparency';
const DEFAULT_TRANSPARENCY = 32; // Retain the previous .68 fog until changed.
const normalize = value => {
  const number = value === null || value === undefined || value === '' ? NaN : Number(value);
  return Number.isFinite(number) ? Math.round(Math.min(100, Math.max(0, number))) : DEFAULT_TRANSPARENCY;
};

/** Only the material preference is persisted; reading data/network stay outside. */
export function createSheetMaterial(document, { storage } = {}) {
  let transparency = DEFAULT_TRANSPARENCY;
  try { transparency = normalize(storage?.getItem(STORAGE_KEY)); } catch { /* Session-only controls still work. */ }
  const slider = document.getElementById('glass-transparency');
  const output = document.getElementById('glass-transparency-value');
  const reset = document.getElementById('glass-transparency-reset');
  const panels = [...document.querySelectorAll('.glass-sheet')];
  for (const panel of panels) {
    panel.classList.add('fg-glass', 'fg-glass--thick');
    panel.dataset.fgPress = 'off';
    panel.dataset.fgTier = 'thick';
    panel.querySelector('.sheet-close')?.classList.add('fg-pearl', 'fg-pearl-btn');
  }
  FluidGlass.init({ fog: 1 - transparency / 100 });
  let transparencyFrame = 0;
  const reflectPreference = () => {
    slider.value = String(transparency);
    slider.setAttribute('aria-valuetext', `${transparency}%`);
    slider.style.setProperty('--glass-progress', `${transparency}%`);
    output.textContent = `${transparency}%`;
    reset.disabled = transparency === DEFAULT_TRANSPARENCY;
  };
  const adjust = () => {
    transparency = normalize(slider.value);
    reflectPreference();
    // Coalesce pointer input without rebuilding optical maps or touching the scene.
    cancelAnimationFrame(transparencyFrame);
    transparencyFrame = requestAnimationFrame(() => FluidGlass.setFog(1 - transparency / 100));
  };
  const remember = () => {
    try { storage?.setItem(STORAGE_KEY, String(transparency)); } catch { /* A full/blocked store must not block the control. */ }
  };
  const restore = () => { slider.value = String(DEFAULT_TRANSPARENCY); adjust(); remember(); };
  reflectPreference();
  slider.addEventListener('input', adjust);
  slider.addEventListener('change', remember);
  reset.addEventListener('click', restore);
  let frame = 0;
  const refreshVisible = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      for (const panel of panels) if (panel.closest('details')?.open) FluidGlass.update(panel);
    });
  };
  const observer = new ResizeObserver(refreshVisible);
  panels.forEach(panel => observer.observe(panel));
  return {
    prepare(panel) { FluidGlass.update(panel); },
    dispose() {
      observer.disconnect(); cancelAnimationFrame(frame); cancelAnimationFrame(transparencyFrame);
      slider.removeEventListener('input', adjust);
      slider.removeEventListener('change', remember);
      reset.removeEventListener('click', restore);
    },
  };
}
