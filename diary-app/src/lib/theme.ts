/**
 * Theme tokens. `colors`, `gradients`, `rtl` and `layout` are mutable singletons:
 * applyTheme / applyDirection rewrite them in place and the app remounts, so every
 * screen reads the new values on its next render. Read them during render only.
 */

type Palette = {
  bg: string;
  bgDeep: string;
  card: string;
  cardHi: string;
  border: string;
  text: string;
  textDim: string;
  textMute: string;
  primary: string;
  primaryHi: string;
  pink: string;
  orange: string;
  yellow: string;
  green: string;
  red: string;
  blue: string;
  /** Text drawn on top of `primary` and on bubbles */
  onPrimary: string;
  /** Background gradient of the whole app */
  app: readonly [string, string, string];
  /** Main buttons */
  accent: readonly [string, string];
  statusBar: 'light' | 'dark';
};

const SHARED = { pink: '#F472B6', orange: '#FB923C', yellow: '#FACC15', green: '#34D399', red: '#F87171', blue: '#60A5FA', onPrimary: '#FFFFFF' };

export type ThemeName = 'night' | 'ocean' | 'sunset' | 'forest' | 'rose' | 'light';

export const THEMES: Record<ThemeName, { label: string; swatch: string; palette: Palette }> = {
  night: {
    label: 'לילה סגול',
    swatch: '#8B5CF6',
    palette: {
      ...SHARED,
      bg: '#14102B', bgDeep: '#0C0920', card: '#221B45', cardHi: '#2D2459', border: '#3A3070',
      text: '#F4F1FF', textDim: '#A9A1D6', textMute: '#7067A6', primary: '#8B5CF6', primaryHi: '#A78BFA',
      app: ['#1B1440', '#14102B', '#0C0920'], accent: ['#8B5CF6', '#EC4899'], statusBar: 'light',
    },
  },
  ocean: {
    label: 'אוקיינוס',
    swatch: '#0EA5E9',
    palette: {
      ...SHARED,
      bg: '#0B1A2B', bgDeep: '#06111D', card: '#12273D', cardHi: '#18344F', border: '#24496B',
      text: '#EEF7FF', textDim: '#9DBAD6', textMute: '#6487A8', primary: '#0EA5E9', primaryHi: '#38BDF8',
      app: ['#0F2740', '#0B1A2B', '#06111D'], accent: ['#0EA5E9', '#14B8A6'], statusBar: 'light',
    },
  },
  sunset: {
    label: 'שקיעה',
    swatch: '#F97316',
    palette: {
      ...SHARED,
      bg: '#24130F', bgDeep: '#170B08', card: '#352019', cardHi: '#452A20', border: '#5E3A2B',
      text: '#FFF4EE', textDim: '#D9AF9C', textMute: '#A27866', primary: '#F97316', primaryHi: '#FB923C',
      app: ['#3A1A12', '#24130F', '#170B08'], accent: ['#F97316', '#EC4899'], statusBar: 'light',
    },
  },
  forest: {
    label: 'יער',
    swatch: '#22C55E',
    palette: {
      ...SHARED,
      bg: '#0D1C14', bgDeep: '#07120C', card: '#15291E', cardHi: '#1C3627', border: '#2A4D38',
      text: '#EFFBF3', textDim: '#A3C9B0', textMute: '#6C957A', primary: '#22C55E', primaryHi: '#4ADE80',
      app: ['#123021', '#0D1C14', '#07120C'], accent: ['#22C55E', '#0EA5E9'], statusBar: 'light',
    },
  },
  rose: {
    label: 'ורוד',
    swatch: '#EC4899',
    palette: {
      ...SHARED,
      bg: '#240E1C', bgDeep: '#170812', card: '#36172A', cardHi: '#461E37', border: '#62294C',
      text: '#FFF0F8', textDim: '#D9A3C2', textMute: '#A26C8B', primary: '#EC4899', primaryHi: '#F472B6',
      app: ['#3A1230', '#240E1C', '#170812'], accent: ['#EC4899', '#8B5CF6'], statusBar: 'light',
    },
  },
  light: {
    label: 'בהיר',
    swatch: '#F5F3FF',
    palette: {
      ...SHARED,
      red: '#DC2626', green: '#059669', orange: '#EA580C', yellow: '#CA8A04', blue: '#2563EB', pink: '#DB2777',
      bg: '#F6F4FB', bgDeep: '#ECE8F6', card: '#FFFFFF', cardHi: '#EFEAFB', border: '#DDD6F0',
      text: '#1E1640', textDim: '#5B5385', textMute: '#8C85B0', primary: '#7C3AED', primaryHi: '#6D28D9',
      app: ['#FBFAFF', '#F6F4FB', '#EFEBF8'], accent: ['#7C3AED', '#DB2777'], statusBar: 'dark',
    },
  },
};

export const colors = { ...THEMES.night.palette };

export const gradients = {
  app: THEMES.night.palette.app as readonly [string, string, ...string[]],
  primary: THEMES.night.palette.accent as readonly [string, string, ...string[]],
  game: ['#F59E0B', '#EC4899', '#8B5CF6'] as const,
  record: ['#EF4444', '#EC4899'] as const,
  calm: ['#3B82F6', '#8B5CF6'] as readonly [string, string, ...string[]],
};

export function applyTheme(name: ThemeName) {
  const p = (THEMES[name] ?? THEMES.night).palette;
  Object.assign(colors, p);
  gradients.app = p.app;
  gradients.primary = p.accent;
  gradients.calm = [p.blue, p.primary];
}

export const MOODS = ['😞', '😕', '😐', '🙂', '🤩'];
export const MOOD_LABELS = ['קשה', 'לא משהו', 'רגיל', 'טוב', 'מדהים'];

/**
 * Direction. The native layout is pinned LTR; screens lay themselves out through these,
 * so Hebrew/Arabic read right-to-left and English left-to-right.
 */
export const rtl: { textAlign: 'right' | 'left'; writingDirection: 'rtl' | 'ltr' } = { textAlign: 'right', writingDirection: 'rtl' };
export const layout = {
  isRTL: true,
  row: 'row-reverse' as 'row' | 'row-reverse',
  /** Mirror factor for things drawn left-to-right (progress bars, icons) */
  flip: -1,
};

export function applyDirection(isRTL: boolean) {
  rtl.textAlign = isRTL ? 'right' : 'left';
  rtl.writingDirection = isRTL ? 'rtl' : 'ltr';
  layout.isRTL = isRTL;
  layout.row = isRTL ? 'row-reverse' : 'row';
  layout.flip = isRTL ? -1 : 1;
}
