export type RGB = [number, number, number]

/** AQI values at which each theme colour is "pure"; colours blend smoothly in between. */
export const HEAT_STOPS: { aqi: number; cssVar: string }[] = [
  { aqi: 25, cssVar: '--aqi-good' },
  { aqi: 75, cssVar: '--aqi-moderate' },
  { aqi: 150, cssVar: '--aqi-poor' },
  { aqi: 250, cssVar: '--aqi-very-poor' },
  { aqi: 400, cssVar: '--aqi-severe' },
]

function hslToRgb(h: number, s: number, l: number): RGB {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

/** Reads the current theme's AQI colours (they differ between light and dark). */
export function readHeatColors(): RGB[] {
  const style = getComputedStyle(document.documentElement)
  return HEAT_STOPS.map(({ cssVar }) => {
    const [h, s, l] = style.getPropertyValue(cssVar).trim().split(/\s+/).map((v) => parseFloat(v))
    return hslToRgb(h, s, l)
  })
}

export function aqiToRgb(aqi: number, colors: RGB[]): RGB {
  const first = HEAT_STOPS[0].aqi
  const last = HEAT_STOPS[HEAT_STOPS.length - 1].aqi
  if (aqi <= first) return colors[0]
  if (aqi >= last) return colors[colors.length - 1]
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    if (aqi <= HEAT_STOPS[i].aqi) {
      const a = HEAT_STOPS[i - 1].aqi
      const t = (aqi - a) / (HEAT_STOPS[i].aqi - a)
      const c0 = colors[i - 1]
      const c1 = colors[i]
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t]
    }
  }
  return colors[colors.length - 1]
}

/** CSS gradient for the legend bar, spanning AQI 0 to 400. */
export function legendGradient(colors: RGB[]) {
  const stops = HEAT_STOPS.map(({ aqi }, i) => `rgb(${colors[i].map(Math.round).join(',')}) ${(aqi / 400) * 100}%`)
  return `linear-gradient(to right, rgb(${colors[0].map(Math.round).join(',')}) 0%, ${stops.join(', ')})`
}

export const rgbString = (rgb: RGB) => `rgb(${rgb.map(Math.round).join(',')})`

/** Black or white text, whichever is easier to read on the given colour. */
export const readableOn = (rgb: RGB) => ((0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 > 0.6 ? '#111' : '#fff')
