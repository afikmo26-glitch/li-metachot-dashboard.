import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { Species } from '../../lib/pet';

/**
 * The pet's drawings, one full-size layer each (viewBox 200×200), so the animated parts — eyes, mouth,
 * tongue, arms — can move on their own while the clothes stay put on the body.
 * Landmarks: body blob 30–170 × 58–178, eyes at (76,108) and (124,108), mouth at (100,128), neck at y≈150.
 */

export type Palette = { body: string; belly: string; shade: string; fill: string };

const SOLID: Record<string, [string, string, string]> = {
  grape: ['#B79CFF', '#E8DEFF', '#8B6CF0'],
  bubblegum: ['#FFA8D2', '#FFE3F1', '#F06AA8'],
  mint: ['#7EE8C0', '#D6FBEC', '#36BF92'],
  sky: ['#8FD3FF', '#E0F3FF', '#4AA8E8'],
  sun: ['#FFD966', '#FFF5CC', '#E8A91C'],
  peach: ['#FFB98A', '#FFE8D6', '#EE8448'],
  night: ['#565A7E', '#9195BC', '#363856'],
  galaxy: ['#7C3AED', '#C4B5FD', '#4C1D95'],
  rainbow: ['#FF9AD5', '#FFFFFF', '#A78BFA'],
  gold: ['#F7C948', '#FFF1C2', '#C98A0B'],
  holo: ['#B9F3FF', '#FFFFFF', '#B79CFF'],
};

/** Colors for a skin; gradient skins fill the body with `url(#…)`. */
export function palette(color: string | undefined, uid: string): Palette {
  const [body, belly, shade] = SOLID[color ?? 'grape'] ?? SOLID.grape;
  const gradient = color === 'galaxy' || color === 'rainbow' || color === 'gold' || color === 'holo';
  return { body, belly, shade, fill: gradient ? `url(#skin${uid})` : body };
}

function SkinGradient({ color, uid }: { color?: string; uid: string }) {
  if (color === 'galaxy')
    return (
      <LinearGradient id={`skin${uid}`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#6D28D9" />
        <Stop offset="0.6" stopColor="#9333EA" />
        <Stop offset="1" stopColor="#DB2777" />
      </LinearGradient>
    );
  if (color === 'rainbow')
    return (
      <LinearGradient id={`skin${uid}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FF8FB1" />
        <Stop offset="0.25" stopColor="#FFC56E" />
        <Stop offset="0.5" stopColor="#FFF07A" />
        <Stop offset="0.72" stopColor="#7EE8C0" />
        <Stop offset="1" stopColor="#8FB8FF" />
      </LinearGradient>
    );
  if (color === 'gold')
    return (
      <LinearGradient id={`skin${uid}`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FFE58A" />
        <Stop offset="0.45" stopColor="#F7C948" />
        <Stop offset="1" stopColor="#D69410" />
      </LinearGradient>
    );
  if (color === 'holo')
    return (
      <LinearGradient id={`skin${uid}`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#A5F3FC" />
        <Stop offset="0.5" stopColor="#D8B4FE" />
        <Stop offset="1" stopColor="#FBCFE8" />
      </LinearGradient>
    );
  return null;
}

const BODY = 'M100 58 C150 58 170 96 170 130 C170 166 140 178 100 178 C60 178 30 166 30 130 C30 96 50 58 100 58 Z';
const INK = '#2B2140';

export function Layer({ children, size }: { children: React.ReactNode; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      {children}
    </Svg>
  );
}

/** Ears, tail, wings: everything that sits behind the body. */
export function SpeciesBack({ species, p, size }: { species: Species; p: Palette; size: number }) {
  return (
    <Layer size={size}>
      {species === 'cat' && (
        <G>
          <Path d="M168 150 C196 140 196 104 180 96 C188 112 182 132 164 138 Z" fill={p.shade} />
          <Path d="M46 92 L54 38 L90 66 Z" fill={p.fill} />
          <Path d="M154 92 L146 38 L110 66 Z" fill={p.fill} />
          <Path d="M54 80 L58 50 L78 66 Z" fill="#FF9FC3" />
          <Path d="M146 80 L142 50 L122 66 Z" fill="#FF9FC3" />
        </G>
      )}
      {species === 'bunny' && (
        <G>
          <Ellipse cx="76" cy="36" rx="14" ry="36" fill={p.fill} transform="rotate(-12 76 36)" />
          <Ellipse cx="124" cy="36" rx="14" ry="36" fill={p.fill} transform="rotate(12 124 36)" />
          <Ellipse cx="76" cy="38" rx="7" ry="26" fill="#FFB3CF" transform="rotate(-12 76 38)" />
          <Ellipse cx="124" cy="38" rx="7" ry="26" fill="#FFB3CF" transform="rotate(12 124 38)" />
          <Circle cx="166" cy="160" r="12" fill="#FFFFFF" />
        </G>
      )}
      {species === 'bear' && (
        <G>
          <Circle cx="56" cy="68" r="21" fill={p.fill} />
          <Circle cx="144" cy="68" r="21" fill={p.fill} />
          <Circle cx="56" cy="68" r="11" fill={p.belly} />
          <Circle cx="144" cy="68" r="11" fill={p.belly} />
        </G>
      )}
      {species === 'dragon' && (
        <G>
          <Path d="M40 118 C10 96 8 70 18 58 C24 76 34 84 48 92 C40 72 44 60 52 54 C54 74 60 86 62 100 Z" fill={p.shade} opacity={0.9} />
          <Path d="M160 118 C190 96 192 70 182 58 C176 76 166 84 152 92 C160 72 156 60 148 54 C146 74 140 86 138 100 Z" fill={p.shade} opacity={0.9} />
          <Path d="M166 160 C190 166 196 150 190 140 L198 132 L184 132 C184 146 176 150 164 148 Z" fill={p.shade} />
        </G>
      )}
      {species === 'unicorn' && (
        <G>
          <Path d="M50 90 L58 50 L84 70 Z" fill={p.fill} />
          <Path d="M150 90 L142 50 L116 70 Z" fill={p.fill} />
          <Path d="M58 82 L61 60 L76 70 Z" fill="#FFB3CF" />
          <Path d="M142 82 L139 60 L124 70 Z" fill="#FFB3CF" />
        </G>
      )}
    </Layer>
  );
}

/** Body, belly and feet. */
export function Body({ p, color, uid, size }: { p: Palette; color?: string; uid: string; size: number }) {
  return (
    <Layer size={size}>
      <Defs>
        <SkinGradient color={color} uid={uid} />
        <RadialGradient id={`shine${uid}`} cx="0.35" cy="0.25" r="0.6">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="72" cy="178" rx="17" ry="9" fill={p.shade} />
      <Ellipse cx="128" cy="178" rx="17" ry="9" fill={p.shade} />
      <Path d={BODY} fill={p.fill} />
      <Ellipse cx="100" cy="148" rx="42" ry="27" fill={p.belly} opacity={0.75} />
      <Path d={BODY} fill={`url(#shine${uid})`} />
      {color === 'galaxy' && (
        <G fill="#FFFFFF">
          <Circle cx="64" cy="96" r="1.6" />
          <Circle cx="140" cy="88" r="1.2" />
          <Circle cx="150" cy="140" r="1.8" />
          <Circle cx="52" cy="140" r="1.2" />
          <Circle cx="118" cy="70" r="1.4" />
        </G>
      )}
    </Layer>
  );
}

/** Things on top of the head and face that belong to the species: the unicorn's horn, cat whiskers, dragon horns. */
export function SpeciesFront({ species, size }: { species: Species; size: number }) {
  if (species === 'cat')
    return (
      <Layer size={size}>
        <G stroke={INK} strokeWidth={1.6} strokeLinecap="round" opacity={0.55}>
          <Line x1="48" y1="122" x2="26" y2="118" />
          <Line x1="48" y1="128" x2="26" y2="130" />
          <Line x1="152" y1="122" x2="174" y2="118" />
          <Line x1="152" y1="128" x2="174" y2="130" />
        </G>
      </Layer>
    );
  if (species === 'unicorn')
    return (
      <Layer size={size}>
        <Path d="M90 62 L100 16 L110 62 Z" fill="#FFD66B" />
        <G stroke="#E8A91C" strokeWidth={2}>
          <Line x1="93" y1="50" x2="107" y2="46" />
          <Line x1="95" y1="38" x2="105" y2="34" />
        </G>
      </Layer>
    );
  if (species === 'dragon')
    return (
      <Layer size={size}>
        <Path d="M70 66 C66 48 70 38 76 32 C78 46 82 54 86 62 Z" fill="#FFE7A3" />
        <Path d="M130 66 C134 48 130 38 124 32 C122 46 118 54 114 62 Z" fill="#FFE7A3" />
      </Layer>
    );
  return null;
}

// ---- Face parts (each drawn in its own small box, positioned by the animator) ----

export function Eye({ size, night }: { size: number; night?: boolean }) {
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 24 29">
      <Ellipse cx="12" cy="14.5" rx="10" ry="12" fill={night ? '#120E1F' : INK} />
      <Circle cx="15.5" cy="9" r="3.6" fill="#FFFFFF" />
      <Circle cx="8.5" cy="19" r="1.7" fill="#FFFFFF" opacity={0.85} />
    </Svg>
  );
}

/** Closed happy eyes: ^ ^ */
export function HappyEye({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 24 29">
      <Path d="M3 18 Q12 6 21 18" stroke={INK} strokeWidth={3.4} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** Sleeping eyes: ‿ */
export function SleepEye({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 24 29">
      <Path d="M3 14 Q12 22 21 14" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function Mouth({ size }: { size: number }) {
  return (
    <Layer size={size}>
      <Path d="M89 127 Q94.5 134 100 127 Q105.5 134 111 127" stroke={INK} strokeWidth={2.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Layer>
  );
}

/** A big open smile, shown while being petted or eating. */
export function OpenMouth({ size }: { size: number }) {
  return (
    <Layer size={size}>
      <Path d="M86 125 Q100 123 114 125 Q112 144 100 145 Q88 144 86 125 Z" fill="#6B2D4A" />
      <Path d="M91 138 Q100 132 109 138 Q106 145 100 145 Q94 145 91 138 Z" fill="#FF7FA8" />
    </Layer>
  );
}

export function Tongue({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 20 23">
      <Path d="M2 0 L18 0 L18 12 C18 18 14 22 10 22 C6 22 2 18 2 12 Z" fill="#FF6F9F" />
      <Line x1="10" y1="2" x2="10" y2="13" stroke="#E0457A" strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function Cheeks({ size }: { size: number }) {
  return (
    <Layer size={size}>
      <Ellipse cx="58" cy="124" rx="11" ry="6.5" fill="#FF7FA8" />
      <Ellipse cx="142" cy="124" rx="11" ry="6.5" fill="#FF7FA8" />
    </Layer>
  );
}

export function Arm({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size * 1.6} viewBox="0 0 20 32">
      <Ellipse cx="10" cy="16" rx="9" ry="15" fill={color} />
    </Svg>
  );
}

// ---- Wearables ----

export function HairBack({ id, size }: { id?: string; size: number }) {
  if (id === 'afro')
    return (
      <Layer size={size}>
        <G fill="#3B2A20">
          {[
            [56, 72, 26], [80, 54, 28], [100, 48, 28], [120, 54, 28], [144, 72, 26], [40, 98, 20], [160, 98, 20],
          ].map(([x, y, r]) => (
            <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
          ))}
        </G>
      </Layer>
    );
  if (id === 'long' || id === 'rainbowhair')
    return (
      <Layer size={size}>
        <Path d="M36 150 C24 100 52 50 100 50 C148 50 176 100 164 150 C150 160 140 150 150 112 L50 112 C60 150 50 160 36 150 Z" fill={id === 'long' ? '#E9579E' : '#A78BFA'} />
      </Layer>
    );
  return null;
}

export function Hair({ id, size, p }: { id?: string; size: number; p: Palette }) {
  if (!id) return null;
  return (
    <Layer size={size}>
      <Defs>
        <LinearGradient id="rainbowHair" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FF6B9A" />
          <Stop offset="0.25" stopColor="#FFB547" />
          <Stop offset="0.5" stopColor="#FFE45C" />
          <Stop offset="0.75" stopColor="#5EE0A0" />
          <Stop offset="1" stopColor="#6FA8FF" />
        </LinearGradient>
      </Defs>
      {id === 'tuft' && (
        <G fill={p.shade}>
          <Path d="M100 60 C95 46 101 34 114 28 C112 42 108 52 100 60 Z" />
          <Path d="M98 60 C92 52 84 48 76 50 C82 56 90 60 98 60 Z" />
        </G>
      )}
      {id === 'curls' && (
        <G fill="#6B4430">
          {[64, 78, 92, 108, 122, 136].map((x, i) => (
            <Circle key={x} cx={x} cy={i === 0 || i === 5 ? 72 : i === 1 || i === 4 ? 62 : 57} r={11} />
          ))}
        </G>
      )}
      {id === 'ponytail' && (
        <G>
          <Path d="M118 60 C150 40 166 70 150 98 C144 78 134 68 118 66 Z" fill="#3B2A20" />
          <Path d="M58 80 C64 56 84 50 100 50 C116 50 136 56 142 80 C126 66 114 64 100 64 C86 64 74 66 58 80 Z" fill="#3B2A20" />
          <Circle cx="120" cy="62" r="6" fill="#FF5C9A" />
        </G>
      )}
      {id === 'mohawk' && <Path d="M80 68 L86 32 L93 62 L100 22 L107 62 L114 32 L120 68 Z" fill="#FF4D8D" />}
      {id === 'bangs' && (
        <Path d="M50 96 C52 62 78 50 100 50 C122 50 148 62 150 96 C142 84 134 88 128 78 C122 90 112 84 106 76 C98 88 88 84 82 78 C74 90 62 84 50 96 Z" fill="#3B2A20" />
      )}
      {id === 'long' && <Path d="M48 104 C50 66 76 52 100 52 C124 52 150 66 152 104 C140 84 124 74 100 74 C76 74 60 84 48 104 Z" fill="#FF8BC2" />}
      {id === 'afro' && <Path d="M60 84 C68 64 84 58 100 58 C116 58 132 64 140 84 C124 74 112 72 100 72 C88 72 76 74 60 84 Z" fill="#3B2A20" />}
      {id === 'rainbowhair' && <Path d="M48 104 C50 66 76 52 100 52 C124 52 150 66 152 104 C140 84 124 74 100 74 C76 74 60 84 48 104 Z" fill="url(#rainbowHair)" />}
    </Layer>
  );
}

export function Hat({ id, size }: { id?: string; size: number }) {
  if (!id) return null;
  return (
    <Layer size={size}>
      <Defs>
        <LinearGradient id="goldHat" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE58A" />
          <Stop offset="1" stopColor="#E0A21A" />
        </LinearGradient>
      </Defs>
      {id === 'party' && (
        <G transform="rotate(-10 100 60)">
          <Path d="M82 64 L100 12 L118 64 Z" fill="#FF5C9A" />
          <Path d="M88 48 L112 48 L109 40 L91 40 Z M94 30 L106 30 L104 24 L96 24 Z" fill="#FFE45C" />
          <Circle cx="100" cy="12" r="7" fill="#FFE45C" />
        </G>
      )}
      {id === 'cap' && (
        <G>
          <Path d="M60 70 C60 38 140 38 140 70 Z" fill="#EF4444" />
          <Path d="M128 66 Q170 64 176 74 Q150 78 126 72 Z" fill="#B91C1C" />
          <Circle cx="100" cy="42" r="3.5" fill="#B91C1C" />
        </G>
      )}
      {id === 'beanie' && (
        <G>
          <Path d="M58 74 C58 34 142 34 142 74 Z" fill="#2DD4BF" />
          <Rect x="54" y="64" width="92" height="16" rx="8" fill="#0F9F8F" />
          <Circle cx="100" cy="34" r="10" fill="#F0FDFA" />
        </G>
      )}
      {id === 'headphones' && (
        <G>
          <Path d="M48 108 C48 34 152 34 152 108" stroke="#1F2937" strokeWidth={8} fill="none" />
          <Rect x="34" y="92" width="20" height="34" rx="9" fill="#F43F5E" />
          <Rect x="146" y="92" width="20" height="34" rx="9" fill="#F43F5E" />
        </G>
      )}
      {id === 'flowers' && (
        <G>
          {[
            [62, 76, '#FF8FB1'], [80, 62, '#FFFFFF'], [100, 56, '#FFE45C'], [120, 62, '#FFFFFF'], [138, 76, '#FF8FB1'],
          ].map(([x, y, c]) => (
            <G key={`${x}`}>
              {[0, 72, 144, 216, 288].map((a) => (
                <Circle key={a} cx={(x as number) + 6 * Math.cos((a * Math.PI) / 180)} cy={(y as number) + 6 * Math.sin((a * Math.PI) / 180)} r={5} fill={c as string} />
              ))}
              <Circle cx={x as number} cy={y as number} r={4} fill="#F59E0B" />
            </G>
          ))}
        </G>
      )}
      {id === 'wizard' && (
        <G>
          <Path d="M68 68 L112 0 L134 68 Z" fill="#4C1D95" />
          <Ellipse cx="100" cy="68" rx="52" ry="10" fill="#5B21B6" />
          <Polygon points="104,30 107,37 114,37 108,41 110,48 104,44 98,48 100,41 94,37 101,37" fill="#FFE45C" />
          <Circle cx="118" cy="52" r="2.5" fill="#FFE45C" />
        </G>
      )}
      {id === 'cowboy' && (
        <G>
          <Path d="M72 66 C70 34 130 34 128 66 Z" fill="#B7791F" />
          <Rect x="72" y="56" width="56" height="8" fill="#7B4A12" />
          <Path d="M36 64 Q100 86 164 64 Q154 78 100 80 Q46 78 36 64 Z" fill="#975A16" />
        </G>
      )}
      {id === 'strawhat' && (
        <G>
          <Ellipse cx="100" cy="66" rx="62" ry="13" fill="#E9C46A" />
          <Path d="M66 64 C66 36 134 36 134 64 Z" fill="#F4D58D" />
          <Rect x="66" y="54" width="68" height="9" fill="#E76F51" />
          <Path d="M48 66 Q100 76 152 66" stroke="#D4A84B" strokeWidth={2} fill="none" />
        </G>
      )}
      {id === 'halo' && (
        <G>
          <Ellipse cx="100" cy="36" rx="34" ry="9" stroke="#FFE45C" strokeWidth={6} fill="none" />
          <Ellipse cx="100" cy="36" rx="34" ry="9" stroke="#FFFFFF" strokeWidth={1.5} fill="none" opacity={0.7} />
        </G>
      )}
      {id === 'crown' && (
        <G>
          <Path d="M64 70 L64 36 L82 54 L100 26 L118 54 L136 36 L136 70 Z" fill="url(#goldHat)" />
          <Circle cx="100" cy="58" r="5" fill="#EF4444" />
          <Circle cx="78" cy="62" r="3.5" fill="#3B82F6" />
          <Circle cx="122" cy="62" r="3.5" fill="#22C55E" />
        </G>
      )}
    </Layer>
  );
}

const HEART = 'M0 -4 C-6 -14 -20 -8 -16 2 C-13 9 -4 14 0 18 C4 14 13 9 16 2 C20 -8 6 -14 0 -4 Z';
const STAR = '0,-16 4.7,-6.5 15.2,-4.9 7.6,2.5 9.4,12.9 0,8 -9.4,12.9 -7.6,2.5 -15.2,-4.9 -4.7,-6.5';

export function Glasses({ id, size }: { id?: string; size: number }) {
  if (!id) return null;
  return (
    <Layer size={size}>
      {id === 'round' && (
        <G stroke="#1F2937" strokeWidth={3.5} fill="#FFFFFF" fillOpacity={0.15}>
          <Circle cx="76" cy="108" r="16" />
          <Circle cx="124" cy="108" r="16" />
          <Line x1="92" y1="106" x2="108" y2="106" />
          <Line x1="60" y1="104" x2="38" y2="98" />
          <Line x1="140" y1="104" x2="162" y2="98" />
        </G>
      )}
      {id === 'shades' && (
        <G>
          <Rect x="56" y="96" width="40" height="24" rx="10" fill="#111827" />
          <Rect x="104" y="96" width="40" height="24" rx="10" fill="#111827" />
          <Line x1="96" y1="104" x2="104" y2="104" stroke="#111827" strokeWidth={4} />
          <Line x1="62" y1="102" x2="74" y2="102" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
          <Line x1="110" y1="102" x2="122" y2="102" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
        </G>
      )}
      {id === 'hearts' && (
        <G fill="#FF3B7F" opacity={0.9}>
          <Path d={HEART} transform="translate(76 104)" />
          <Path d={HEART} transform="translate(124 104)" />
          <Line x1="92" y1="104" x2="108" y2="104" stroke="#FF3B7F" strokeWidth={3} />
        </G>
      )}
      {id === 'stars' && (
        <G fill="#FACC15" opacity={0.92}>
          <Polygon points={STAR} transform="translate(76 108) scale(1.15)" />
          <Polygon points={STAR} transform="translate(124 108) scale(1.15)" />
          <Line x1="94" y1="104" x2="106" y2="104" stroke="#FACC15" strokeWidth={3} />
        </G>
      )}
      {id === '3d' && (
        <G>
          <Rect x="54" y="94" width="92" height="28" rx="4" fill="#FFFFFF" />
          <Rect x="60" y="99" width="34" height="18" rx="2" fill="#EF4444" opacity={0.75} />
          <Rect x="106" y="99" width="34" height="18" rx="2" fill="#22D3EE" opacity={0.75} />
        </G>
      )}
      {id === 'aviator' && (
        <G>
          <Path d="M56 100 Q76 94 94 100 Q94 122 76 124 Q58 122 56 100 Z" fill="#7C5A2E" opacity={0.85} stroke="#D4AF37" strokeWidth={2.5} />
          <Path d="M106 100 Q124 94 144 100 Q142 122 124 124 Q106 122 106 100 Z" fill="#7C5A2E" opacity={0.85} stroke="#D4AF37" strokeWidth={2.5} />
          <Path d="M94 101 Q100 97 106 101" stroke="#D4AF37" strokeWidth={2.5} fill="none" />
          <Line x1="62" y1="104" x2="72" y2="104" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" opacity={0.5} />
        </G>
      )}
      {id === 'pixel' && (
        <G fill="#000000">
          <Rect x="50" y="98" width="100" height="6" />
          <Rect x="56" y="104" width="38" height="8" />
          <Rect x="62" y="112" width="26" height="6" />
          <Rect x="106" y="104" width="38" height="8" />
          <Rect x="112" y="112" width="26" height="6" />
          <Rect x="62" y="104" width="6" height="4" fill="#FFFFFF" />
          <Rect x="112" y="104" width="6" height="4" fill="#FFFFFF" />
        </G>
      )}
    </Layer>
  );
}

export function Neck({ id, size }: { id?: string; size: number }) {
  if (!id) return null;
  return (
    <Layer size={size}>
      {id === 'bowtie' && (
        <G fill="#EF4444">
          <Path d="M100 154 L80 142 L80 166 Z" />
          <Path d="M100 154 L120 142 L120 166 Z" />
          <Circle cx="100" cy="154" r="6" fill="#B91C1C" />
        </G>
      )}
      {id === 'scarf' && (
        <G>
          <Path d="M40 144 Q100 170 160 144 L162 158 Q100 186 38 158 Z" fill="#F59E0B" />
          <Rect x="122" y="156" width="16" height="30" rx="4" fill="#F59E0B" transform="rotate(-10 130 160)" />
          <Path d="M60 152 L64 162 M84 158 L86 168 M112 158 L110 168 M138 152 L134 162" stroke="#B45309" strokeWidth={3} />
        </G>
      )}
      {id === 'tie' && (
        <G>
          <Path d="M93 148 L107 148 L104 157 L112 186 L100 196 L88 186 L96 157 Z" fill="#2563EB" />
          <Path d="M93 148 L107 148 L104 157 L96 157 Z" fill="#1D4ED8" />
        </G>
      )}
      {id === 'bandana' && (
        <G>
          <Path d="M56 144 Q100 160 144 144 L100 184 Z" fill="#DC2626" />
          <G fill="#FFFFFF">
            <Circle cx="86" cy="156" r="2.2" />
            <Circle cx="112" cy="156" r="2.2" />
            <Circle cx="100" cy="168" r="2.2" />
          </G>
        </G>
      )}
      {id === 'lei' && (
        <G>
          {[[50, 144], [62, 152], [75, 158], [88, 162], [100, 163], [112, 162], [125, 158], [138, 152], [150, 144]].map(([x, y], i) => (
            <G key={x}>
              {[0, 72, 144, 216, 288].map((a) => (
                <Circle key={a} cx={x + 4.5 * Math.cos((a * Math.PI) / 180)} cy={y + 4.5 * Math.sin((a * Math.PI) / 180)} r={4} fill={['#FF5C9A', '#FFB547', '#C084FC'][i % 3]} />
              ))}
              <Circle cx={x} cy={y} r={2.5} fill="#FFE45C" />
            </G>
          ))}
        </G>
      )}
      {id === 'cape' && (
        <G>
          <Path d="M44 140 Q100 162 156 140 L150 150 Q100 170 50 150 Z" fill="#B91C1C" />
          <Circle cx="100" cy="156" r="6" fill="#FFD66B" />
          <Path d="M97 153 L100 159 L103 153" stroke="#B45309" strokeWidth={1.5} fill="none" />
        </G>
      )}
      {id === 'chain' && (
        <G>
          <Path d="M54 142 Q100 178 146 142" stroke="#FACC15" strokeWidth={4.5} fill="none" strokeDasharray="5 3" />
          <Circle cx="100" cy="164" r="8" fill="#FACC15" />
          <Path d={HEART} transform="translate(100 162) scale(0.32)" fill="#EF4444" />
        </G>
      )}
    </Layer>
  );
}

export function Face({ id, size }: { id?: string; size: number }) {
  if (!id) return null;
  return (
    <Layer size={size}>
      {id === 'freckles' && (
        <G fill="#9A5B3B" opacity={0.7}>
          <Circle cx="54" cy="116" r="1.8" />
          <Circle cx="61" cy="113" r="1.6" />
          <Circle cx="60" cy="120" r="1.6" />
          <Circle cx="146" cy="116" r="1.8" />
          <Circle cx="139" cy="113" r="1.6" />
          <Circle cx="140" cy="120" r="1.6" />
        </G>
      )}
      {id === 'blushhearts' && (
        <G fill="#FF3B7F">
          <Path d={HEART} transform="translate(56 122) scale(0.45)" />
          <Path d={HEART} transform="translate(144 122) scale(0.45)" />
        </G>
      )}
      {id === 'bandaid' && (
        <G transform="rotate(-25 136 88)">
          <Rect x="122" y="83" width="28" height="11" rx="5" fill="#F8C9A0" />
          <Rect x="132" y="83" width="8" height="11" fill="#EBB083" />
        </G>
      )}
      {id === 'mustache' && (
        <Path d="M100 123 C92 114 76 116 72 128 C82 122 90 129 100 125 C110 129 118 122 128 128 C124 116 108 114 100 123 Z" fill="#3B2A20" />
      )}
      {id === 'starsticker' && <Polygon points={STAR} transform="translate(142 92) scale(0.55)" fill="#FACC15" />}
      {id === 'sparkle' && (
        <G fill="#FFFFFF">
          <Polygon points={STAR} transform="translate(150 84) scale(0.4)" />
          <Polygon points={STAR} transform="translate(48 90) scale(0.3)" />
          <Polygon points={STAR} transform="translate(160 116) scale(0.25)" fill="#FFE45C" />
          <Polygon points={STAR} transform="translate(40 120) scale(0.22)" fill="#FFE45C" />
        </G>
      )}
    </Layer>
  );
}

// ---- Rooms (behind the pet, full stage size) ----

const SKIES: Record<string, [string, string]> = {
  room: ['#3B2D6B', '#5B4A99'],
  clouds: ['#7DD3FC', '#E0F2FE'],
  beach: ['#7DD3FC', '#E0F2FE'],
  forest: ['#BBF7D0', '#ECFCCB'],
  space: ['#0B1026', '#2A1B5E'],
  disco: ['#1E0B3A', '#4A1470'],
};

export function Room({ id, width, height }: { id?: string; width: number; height: number }) {
  const w = width;
  const h = height;
  const floor = h * 0.72;
  const sky = SKIES[id ?? 'room'] ?? SKIES.room;
  return (
    <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id="roomSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={sky[0]} />
          <Stop offset="1" stopColor={sky[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#roomSky)" />
      {(id === 'room' || !id) && (
        <G>
          <Rect x={w * 0.08} y={h * 0.12} width={w * 0.24} height={h * 0.28} rx={10} fill="#1E1646" stroke="#8B7BD8" strokeWidth={4} />
          <Circle cx={w * 0.24} cy={h * 0.2} r={10} fill="#FFF3B0" />
          <Rect x={0} y={floor} width={w} height={h - floor} fill="#2A2050" />
          <Ellipse cx={w / 2} cy={floor + (h - floor) * 0.45} rx={w * 0.32} ry={(h - floor) * 0.32} fill="#7C5CC4" opacity={0.6} />
          <Rect x={w * 0.82} y={floor - 30} width={20} height={30} rx={4} fill="#C084FC" />
          <Path d={`M${w * 0.82 + 10} ${floor - 30} C${w * 0.82 - 4} ${floor - 56} ${w * 0.82 + 4} ${floor - 60} ${w * 0.82 + 10} ${floor - 40} C${w * 0.82 + 16} ${floor - 62} ${w * 0.82 + 28} ${floor - 54} ${w * 0.82 + 10} ${floor - 30} Z`} fill="#4ADE80" />
        </G>
      )}
      {id === 'clouds' && (
        <G fill="#FFFFFF">
          {[
            [0.15, 0.2, 1], [0.7, 0.14, 1.3], [0.45, 0.42, 0.8], [0.85, 0.55, 0.9], [0.1, 0.6, 1.1],
          ].map(([x, y, s]) => (
            <G key={`${x}`} transform={`translate(${w * x} ${h * y}) scale(${s})`}>
              <Circle cx={0} cy={0} r={14} />
              <Circle cx={16} cy={-6} r={18} />
              <Circle cx={34} cy={0} r={13} />
              <Rect x={0} y={0} width={34} height={13} />
            </G>
          ))}
        </G>
      )}
      {id === 'beach' && (
        <G>
          <Circle cx={w * 0.82} cy={h * 0.18} r={24} fill="#FDE047" />
          <Rect x={0} y={h * 0.5} width={w} height={h * 0.2} fill="#38BDF8" />
          <Path d={`M0 ${h * 0.52} Q${w * 0.25} ${h * 0.49} ${w * 0.5} ${h * 0.52} T${w} ${h * 0.52}`} stroke="#E0F2FE" strokeWidth={3} fill="none" />
          <Rect x={0} y={floor - 8} width={w} height={h - floor + 8} fill="#FCD9A0" />
          <Path d={`M${w * 0.1} ${floor} Q${w * 0.12} ${h * 0.4} ${w * 0.16} ${h * 0.3}`} stroke="#92400E" strokeWidth={7} fill="none" />
          <Path d={`M${w * 0.16} ${h * 0.3} q-30 0 -40 18 M${w * 0.16} ${h * 0.3} q30 -4 40 14 M${w * 0.16} ${h * 0.3} q-6 -24 -26 -30 M${w * 0.16} ${h * 0.3} q14 -22 36 -22`} stroke="#16A34A" strokeWidth={8} fill="none" strokeLinecap="round" />
        </G>
      )}
      {id === 'forest' && (
        <G>
          {[0.06, 0.2, 0.78, 0.92].map((x, i) => (
            <G key={x}>
              <Rect x={w * x - 4} y={floor - 30} width={8} height={30} fill="#7C4A1E" />
              <Polygon points={`${w * x},${floor - 110 + (i % 2) * 20} ${w * x - 30},${floor - 26} ${w * x + 30},${floor - 26}`} fill={i % 2 ? '#15803D' : '#16A34A'} />
            </G>
          ))}
          <Rect x={0} y={floor} width={w} height={h - floor} fill="#86C26A" />
          <Circle cx={w * 0.35} cy={floor + 18} r={4} fill="#F472B6" />
          <Circle cx={w * 0.62} cy={floor + 26} r={4} fill="#FDE047" />
        </G>
      )}
      {id === 'space' && (
        <G>
          {Array.from({ length: 36 }).map((_, i) => (
            <Circle key={i} cx={((i * 73) % 100) * w * 0.01} cy={((i * 37) % 100) * h * 0.0075} r={(i % 3) * 0.7 + 0.8} fill="#FFFFFF" opacity={0.8} />
          ))}
          <Circle cx={w * 0.8} cy={h * 0.22} r={22} fill="#F59E0B" />
          <Ellipse cx={w * 0.8} cy={h * 0.22} rx={36} ry={8} stroke="#FDE68A" strokeWidth={3} fill="none" />
          <Ellipse cx={w / 2} cy={floor + 20} rx={w * 0.6} ry={34} fill="#4C3B8F" />
        </G>
      )}
      {id === 'disco' && (
        <G>
          {['#F472B6', '#60A5FA', '#FDE047', '#4ADE80'].map((c, i) => (
            <Polygon key={c} points={`${w / 2},${h * 0.1} ${w * (0.05 + i * 0.3)},${floor} ${w * (0.15 + i * 0.3)},${floor}`} fill={c} opacity={0.18} />
          ))}
          <Line x1={w / 2} y1={0} x2={w / 2} y2={h * 0.06} stroke="#CBD5E1" strokeWidth={2} />
          <Circle cx={w / 2} cy={h * 0.1} r={16} fill="#CBD5E1" />
          <Path d={`M${w / 2 - 16} ${h * 0.1} H${w / 2 + 16} M${w / 2} ${h * 0.1 - 16} V${h * 0.1 + 16}`} stroke="#64748B" strokeWidth={1.5} />
          <Rect x={0} y={floor} width={w} height={h - floor} fill="#2E1065" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Rect key={i} x={(w / 6) * i} y={floor} width={w / 6} height={h - floor} fill={['#7C3AED', '#DB2777', '#2563EB'][i % 3]} opacity={0.35} />
          ))}
        </G>
      )}
    </Svg>
  );
}
