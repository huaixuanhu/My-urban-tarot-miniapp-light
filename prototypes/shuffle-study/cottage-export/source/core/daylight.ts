export type DaylightMode = 'fixed' | 'live';

export interface DaylightPalette {
  phaseLabel: '常驻午后' | '清晨' | '白天' | '傍晚' | '夜晚';
  background: string;
  ambientColor: string;
  ambientIntensity: number;
  skyColor: string;
  groundColor: string;
  hemisphereIntensity: number;
  keyColor: string;
  keyIntensity: number;
  fillColor: string;
  fillIntensity: number;
  cityTint: string;
  windowTint: string;
  nightMix: number;
}

// The accepted permanent afternoon is kept verbatim, including the original city texture.
export const FIXED_DAYLIGHT: Readonly<DaylightPalette> = Object.freeze({
  phaseLabel: '常驻午后', background: '#e8dac5', ambientColor: '#fff3df', ambientIntensity: .22,
  skyColor: '#f0f6ff', groundColor: '#ac8765', hemisphereIntensity: .65,
  keyColor: '#ffe0a5', keyIntensity: 2.6,
  fillColor: '#e3ecff', fillIntensity: .5,
  cityTint: '#ffffff', windowTint: '#d8e7e6', nightMix: 0,
});

const night: DaylightPalette = {
  phaseLabel: '夜晚', background: '#586475', ambientColor: '#ffe5c8', ambientIntensity: .3,
  skyColor: '#9aaed6', groundColor: '#95745d', hemisphereIntensity: .54,
  keyColor: '#a5bde8', keyIntensity: .38,
  fillColor: '#ffe1b3', fillIntensity: .95,
  cityTint: '#c1cadd', windowTint: '#9fbbd7', nightMix: 1,
};
const dawn: DaylightPalette = {
  phaseLabel: '清晨', background: '#c5b7b8', ambientColor: '#ffe7d2', ambientIntensity: .25,
  skyColor: '#cfdaed', groundColor: '#a88776', hemisphereIntensity: .6,
  keyColor: '#ffc9a4', keyIntensity: 1.2,
  fillColor: '#e4e7ff', fillIntensity: .62,
  cityTint: '#f2cbd1', windowTint: '#cfdae7', nightMix: .38,
};
const day: DaylightPalette = {
  ...FIXED_DAYLIGHT,
  phaseLabel: '白天', background: '#e4e3da', skyColor: '#e8f3ff', keyColor: '#fff0d5',
  keyIntensity: 2.7, hemisphereIntensity: .7, cityTint: '#f0f7ff',
};
const dusk: DaylightPalette = {
  phaseLabel: '傍晚', background: '#c5a6a0', ambientColor: '#ffe4cf', ambientIntensity: .27,
  skyColor: '#dfc8d9', groundColor: '#a47765', hemisphereIntensity: .6,
  keyColor: '#ffc48e', keyIntensity: 1.25,
  fillColor: '#ffe2c1', fillIntensity: .68,
  cityTint: '#f6c2ab', windowTint: '#d8cbd2', nightMix: .3,
};

// A local-clock mood cycle, deliberately independent of location, weather and sunrise APIs.
// The equal endpoints make both sides of midnight continuous, including a date rollover.
const stops: readonly {hour: number; palette: Readonly<DaylightPalette>}[] = [
  {hour: 0, palette: night}, {hour: 5, palette: night},
  {hour: 6.5, palette: dawn}, {hour: 9, palette: day},
  {hour: 14, palette: day}, {hour: 16.5, palette: FIXED_DAYLIGHT},
  {hour: 18.5, palette: dusk}, {hour: 20.5, palette: night},
  {hour: 24, palette: night},
];

function mixColor(a: string, b: string, amount: number): string {
  const channels = [1, 3, 5].map(offset => {
    const start = parseInt(a.slice(offset, offset + 2), 16);
    const end = parseInt(b.slice(offset, offset + 2), 16);
    return Math.round(start + (end - start) * amount).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

export function resolveDaylight(mode: DaylightMode, date: Date): DaylightPalette {
  if (mode === 'fixed' || !Number.isFinite(date.getTime())) return {...FIXED_DAYLIGHT};
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const next = stops.findIndex(stop => stop.hour > hour);
  const a = stops[next - 1], b = stops[next];
  const p = (hour - a.hour) / (b.hour - a.hour);
  const blend = p * p * (3 - 2 * p);
  const output = {} as Record<keyof DaylightPalette, string | number>;
  for (const key of Object.keys(a.palette) as (keyof DaylightPalette)[]) {
    if (key === 'phaseLabel') continue;
    const start = a.palette[key], end = b.palette[key];
    output[key] = typeof start === 'number' && typeof end === 'number'
      ? start + (end - start) * blend
      : mixColor(start as string, end as string, blend);
  }
  output.phaseLabel = hour < 5 || hour >= 20.5 ? '夜晚' : hour < 9 ? '清晨' : hour < 17 ? '白天' : '傍晚';
  return output as unknown as DaylightPalette;
}
