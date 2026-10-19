export const colors = {
  bg: '#14102B',
  bgDeep: '#0C0920',
  card: '#221B45',
  cardHi: '#2D2459',
  border: '#3A3070',
  text: '#F4F1FF',
  textDim: '#A9A1D6',
  textMute: '#7067A6',
  primary: '#8B5CF6',
  primaryHi: '#A78BFA',
  pink: '#F472B6',
  orange: '#FB923C',
  yellow: '#FACC15',
  green: '#34D399',
  red: '#F87171',
  blue: '#60A5FA',
};

export const gradients = {
  app: ['#1B1440', '#14102B', '#0C0920'] as const,
  primary: ['#8B5CF6', '#EC4899'] as const,
  game: ['#F59E0B', '#EC4899', '#8B5CF6'] as const,
  record: ['#EF4444', '#EC4899'] as const,
  calm: ['#3B82F6', '#8B5CF6'] as const,
};

export const MOODS = ['😞', '😕', '😐', '🙂', '🤩'];
export const MOOD_LABELS = ['קשה', 'לא משהו', 'רגיל', 'טוב', 'מדהים'];

/** Text style shared by every Hebrew text — the layout is pinned LTR, so align explicitly. */
export const rtl = { textAlign: 'right' as const, writingDirection: 'rtl' as const };
