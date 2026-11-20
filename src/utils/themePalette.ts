/** Keep in sync with the ten source colors in styles/theme.css (checked by check:palette). */
export const THEME_COLORS = {
  white: '#ffffff',
  surface: '#f5f7ef',
  border: '#cbd3bd',
  content: '#2f392b',
  primary: '#e7ecda',
  sky: '#3f706b',
  gold: '#d5b66f',
  accent: '#526b45',
  danger: '#a64138',
  special: '#756184',
} as const;

const values = Object.values(THEME_COLORS);
const channels = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));

/** Restrict colors supplied by stored content or component props to the shared palette. */
export function normalizeThemeColor(value: string): string {
  const fallback = THEME_COLORS.content;
  let color = value.trim().toLowerCase();
  if (values.some(candidate => candidate === color)) return color;
  const token = /^var\(--color-([a-z]+)\)$/.exec(color)?.[1];
  if (token && Object.hasOwn(THEME_COLORS, token)) return THEME_COLORS[token as keyof typeof THEME_COLORS];
  if (/^#[\da-f]{3,4}$/i.test(color)) color = '#' + [...color.slice(1)].map(channel => channel + channel).join('');

  // Browsers normalize named colors and other valid CSS color syntax for legacy content.
  if ((!/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(color) && !/^rgba?\(/.test(color) || color.includes('%')) && typeof document !== 'undefined') {
    if (!CSS.supports('color', color) || /var\(|currentcolor|inherit|initial|unset/.test(color)) return fallback;
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return fallback;
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const data = context.getImageData(0, 0, 1, 1).data;
    color = `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
  }
  const source = /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(color)
    ? channels(color)
    : /^rgba?\(/.test(color) ? color.match(/[\d.]+/g)?.slice(0, 3).map(Number) : undefined;
  if (!source || source.length !== 3 || source.some(channel => !Number.isFinite(channel))) return fallback;
  return values.reduce((closest, candidate) => {
    const distance = (hex: string) => channels(hex).reduce((sum, channel, index) => sum + (channel - source[index]!) ** 2, 0);
    return distance(candidate) < distance(closest) ? candidate : closest;
  });
}
