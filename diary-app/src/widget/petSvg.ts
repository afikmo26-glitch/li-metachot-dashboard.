import type { Species } from '../lib/pet';

/**
 * The pet as an SVG string for the home-screen widget (widgets can't run the animated components).
 * Same drawing coordinates as components/pet/art.tsx: body, ears, eyes, cheeks, mouth — clothes left out.
 */

const COLORS: Record<string, [string, string, string]> = {
  grape: ['#B79CFF', '#E8DEFF', '#8B6CF0'],
  bubblegum: ['#FFA8D2', '#FFE3F1', '#F06AA8'],
  mint: ['#7EE8C0', '#D6FBEC', '#36BF92'],
  sky: ['#8FD3FF', '#E0F3FF', '#4AA8E8'],
  sun: ['#FFD966', '#FFF5CC', '#E8A91C'],
  peach: ['#FFB98A', '#FFE8D6', '#EE8448'],
  night: ['#565A7E', '#9195BC', '#363856'],
  galaxy: ['#8B5CF6', '#C4B5FD', '#4C1D95'],
  rainbow: ['#FF9AD5', '#FFFFFF', '#A78BFA'],
  gold: ['#F7C948', '#FFF1C2', '#C98A0B'],
  holo: ['#B9F3FF', '#FFFFFF', '#B79CFF'],
};

const BODY = 'M100 58 C150 58 170 96 170 130 C170 166 140 178 100 178 C60 178 30 166 30 130 C30 96 50 58 100 58 Z';
const INK = '#2B2140';

function ears(species: Species, body: string, belly: string, shade: string): string {
  switch (species) {
    case 'cat':
      return `<path d="M46 92 L54 38 L90 66 Z" fill="${body}"/><path d="M154 92 L146 38 L110 66 Z" fill="${body}"/><path d="M54 80 L58 50 L78 66 Z" fill="#FF9FC3"/><path d="M146 80 L142 50 L122 66 Z" fill="#FF9FC3"/>`;
    case 'bunny':
      return `<ellipse cx="76" cy="36" rx="14" ry="36" fill="${body}" transform="rotate(-12 76 36)"/><ellipse cx="124" cy="36" rx="14" ry="36" fill="${body}" transform="rotate(12 124 36)"/><ellipse cx="76" cy="38" rx="7" ry="26" fill="#FFB3CF" transform="rotate(-12 76 38)"/><ellipse cx="124" cy="38" rx="7" ry="26" fill="#FFB3CF" transform="rotate(12 124 38)"/>`;
    case 'bear':
      return `<circle cx="56" cy="68" r="21" fill="${body}"/><circle cx="144" cy="68" r="21" fill="${body}"/><circle cx="56" cy="68" r="11" fill="${belly}"/><circle cx="144" cy="68" r="11" fill="${belly}"/>`;
    case 'dragon':
      return `<path d="M40 118 C10 96 8 70 18 58 C24 76 34 84 48 92 C40 72 44 60 52 54 C54 74 60 86 62 100 Z" fill="${shade}"/><path d="M160 118 C190 96 192 70 182 58 C176 76 166 84 152 92 C160 72 156 60 148 54 C146 74 140 86 138 100 Z" fill="${shade}"/>`;
    case 'unicorn':
      return `<path d="M50 90 L58 50 L84 70 Z" fill="${body}"/><path d="M150 90 L142 50 L116 70 Z" fill="${body}"/>`;
    default:
      return '';
  }
}

function front(species: Species): string {
  if (species === 'unicorn') return '<path d="M90 62 L100 16 L110 62 Z" fill="#FFD66B"/>';
  if (species === 'dragon')
    return '<path d="M70 66 C66 48 70 38 76 32 C78 46 82 54 86 62 Z" fill="#FFE7A3"/><path d="M130 66 C134 48 130 38 124 32 C122 46 118 54 114 62 Z" fill="#FFE7A3"/>';
  return '';
}

export function petSvgString(species: Species, color: string | undefined, mood: 'awake' | 'asleep' | 'happy'): string {
  const [body, belly, shade] = COLORS[color ?? 'grape'] ?? COLORS.grape;
  const eye = (cx: number) =>
    mood === 'asleep'
      ? `<path d="M${cx - 9} 108 Q${cx} 116 ${cx + 9} 108" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : mood === 'happy'
        ? `<path d="M${cx - 9} 112 Q${cx} 100 ${cx + 9} 112" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`
        : `<ellipse cx="${cx}" cy="108" rx="10" ry="12" fill="${INK}"/><circle cx="${cx + 3.5}" cy="102.5" r="3.6" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${ears(species, body, belly, shade)}<ellipse cx="72" cy="178" rx="17" ry="9" fill="${shade}"/><ellipse cx="128" cy="178" rx="17" ry="9" fill="${shade}"/><path d="${BODY}" fill="${body}"/><ellipse cx="100" cy="148" rx="42" ry="27" fill="${belly}" opacity="0.75"/><ellipse cx="58" cy="124" rx="11" ry="6.5" fill="#FF7FA8" opacity="0.6"/><ellipse cx="142" cy="124" rx="11" ry="6.5" fill="#FF7FA8" opacity="0.6"/>${eye(76)}${eye(124)}<path d="M89 127 Q94.5 134 100 127 Q105.5 134 111 127" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"/>${front(species)}</svg>`;
}
