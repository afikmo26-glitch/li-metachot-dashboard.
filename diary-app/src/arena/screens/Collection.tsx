import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notify } from '../../components/ui';
import { itemDef, MAX_ITEM_LEVEL, MOVES, RANKS, rankOf, RARITIES, RARITY, Slot, SLOTS, SPECIES, SpeciesId, ELEMENTS, SKINS, normSpecies } from '../data';
import { itemBonus, OwnedItem, upgradeCost } from '../progress';
import { fetchTop, TopRow } from '../online';
import Sprite from '../Sprite';
import { fighterPrice, useArena } from '../state';
import { Bar, GButton, GL, GT, ItemIcon, ItemTile, MOVE_ICON, Pill } from '../ui';
import { Header } from './Rewards';

const STAT_LABEL = { hp: 'חיים', atk: 'התקפה', def: 'הגנה', spd: 'מהירות' } as const;

/** Inventory: what's equipped, everything you own, and a detail sheet to upgrade, equip or sell. */
export function BagScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { s, equip, unequip, upgrade, sell } = useArena();
  const [sel, setSel] = useState<string | null>(null);
  const equipped = Object.values(s.fighter?.equip ?? {}).filter(Boolean) as OwnedItem[];
  const all = [...equipped, ...s.inventory];
  const item = all.find((i) => i.uid === sel);
  const sorted = useMemo(() => [...s.inventory].sort((a, b) => RARITIES.indexOf(itemDef(b.id)!.rarity) - RARITIES.indexOf(itemDef(a.id)!.rarity) || b.level - a.level), [s.inventory]);

  return (
    <LinearGradient colors={['#1E3A8A', '#2A1052', '#12082A']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 220, paddingHorizontal: 14 }}>
        <Header title="התיק שלי" onBack={onBack} />
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6 }}>
          <Pill icon="Coin" value={s.coins} />
        </View>
        <GT size={15} style={{ textAlign: 'right', marginTop: 14 }}>
          מצויד עכשיו
        </GT>
        <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 8 }}>
          {(['weapon', 'head', 'armor', 'charm'] as Slot[]).map((slot) => {
            const o = s.fighter?.equip[slot];
            return (
              <View key={slot} style={{ flex: 1, alignItems: 'center' }}>
                {o ? (
                  <ItemTile item={o} size={70} onPress={() => setSel(o.uid)} selected={sel === o.uid} />
                ) : (
                  <View style={{ width: 70, height: 86, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                    <GL size={11}>{SLOTS[slot]}</GL>
                  </View>
                )}
              </View>
            );
          })}
        </View>
        <GT size={15} style={{ textAlign: 'right', marginTop: 16 }}>{`כל החפצים (${s.inventory.length})`}</GT>
        {sorted.length === 0 && <GL style={{ textAlign: 'right', marginTop: 6 }}>פותחים תיבות ומנצחים בוסים כדי למצוא חפצים.</GL>}
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {sorted.map((o) => (
            <ItemTile key={o.uid} item={o} size={72} onPress={() => setSel(o.uid)} selected={sel === o.uid} />
          ))}
        </View>
      </ScrollView>
      {item && (
        <ItemSheet
          item={item}
          equipped={equipped.some((e) => e.uid === item.uid)}
          coins={s.coins}
          onEquip={() => equip(item.uid)}
          onUnequip={() => unequip(itemDef(item.id)!.slot)}
          onUpgrade={() => (upgrade(item.uid) ? notify('success') : notify('error'))}
          onSell={() => {
            sell(item.uid);
            setSel(null);
          }}
          onClose={() => setSel(null)}
        />
      )}
    </LinearGradient>
  );
}

function ItemSheet({ item, equipped, coins, onEquip, onUnequip, onUpgrade, onSell, onClose }: { item: OwnedItem; equipped: boolean; coins: number; onEquip: () => void; onUnequip: () => void; onUpgrade: () => void; onSell: () => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const d = itemDef(item.id)!;
  const r = RARITY[d.rarity];
  const bonus = itemBonus(item);
  const cost = upgradeCost(item);
  const maxed = item.level >= MAX_ITEM_LEVEL;
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <LinearGradient colors={[r.glow, '#160B33']} locations={[0, 0.5]} style={{ borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 2, borderColor: r.color, padding: 16, paddingBottom: insets.bottom + 16 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
          <ItemIcon icon={d.icon} size={92} />
          <View style={{ flex: 1 }}>
            <GT size={22} style={{ textAlign: 'right' }}>
              {d.name}
            </GT>
            <GL color={r.color} style={{ textAlign: 'right' }}>{`${r.label} · ${SLOTS[d.slot]} · רמה ${item.level}/${MAX_ITEM_LEVEL}`}</GL>
            <Bar value={item.level / MAX_ITEM_LEVEL} color={r.color} height={8} style={{ marginTop: 6 }} />
          </View>
          <Pressable onPress={onClose} accessibilityLabel="סגור" hitSlop={8} style={{ alignSelf: 'flex-start' }}>
            <GT size={22}>✕</GT>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {(Object.keys(bonus) as (keyof typeof bonus)[]).map((k) => (
            <View key={k} style={{ backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
              <GL size={12} color="#fff">{`+${bonus[k]}% ${STAT_LABEL[k]}`}</GL>
            </View>
          ))}
        </View>
        {d.move && (
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 8 }}>
            <ItemIcon icon={MOVE_ICON[d.move]} size={36} />
            <View style={{ flex: 1 }}>
              <GT size={13} style={{ textAlign: 'right' }}>{`קלף מיוחד: ${MOVES[d.move].name}`}</GT>
              <GL size={11} style={{ textAlign: 'right' }}>
                {MOVES[d.move].desc}
              </GL>
            </View>
          </View>
        )}
        <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 12 }}>
          <GButton title={maxed ? 'רמה מקסימלית' : `שדרג · ${cost}`} tone="green" size={15} height={48} style={{ flex: 1.4 }} disabled={maxed || coins < cost} onPress={onUpgrade}>
            {!maxed && <ItemIcon icon="Coin" size={22} />}
          </GButton>
          {equipped ? <GButton title="הסר" tone="gray" size={15} height={48} style={{ flex: 1 }} onPress={onUnequip} /> : <GButton title="לצייד" tone="purple" size={15} height={48} style={{ flex: 1 }} onPress={onEquip} />}
        </View>
        {!equipped && <GButton title={`מכור ב-${Math.round(cost * 0.4)}`} tone="red" size={13} height={38} style={{ marginTop: 8 }} onPress={onSell} />}
      </LinearGradient>
    </View>
  );
}

/** The rank ladder and the leaderboards (all of Israel / friends), from the server when online. */
export function RanksScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { s } = useArena();
  const rank = rankOf(s.trophies);
  const [rows, setRows] = useState<TopRow[] | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    fetchTop()
      .then((r) => setRows(r))
      .catch(() => setOffline(true));
  }, []);
  return (
    <LinearGradient colors={['#1E40AF', '#172554', '#0B1030']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24, paddingHorizontal: 14 }}>
        <Header title="דרגות וטבלה ארצית" onBack={onBack} />
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <ItemIcon icon={rank.icon} size={110} />
          <GT size={26} color={rank.color}>
            {rank.label}
          </GT>
          <GL>{`${s.trophies.toLocaleString()} גביעים · שיא ${s.best.toLocaleString()}`}</GL>
        </View>
        <View style={{ marginTop: 14, gap: 6 }}>
          {[...RANKS].reverse().map((r) => {
            const on = r.id === rank.id;
            return (
              <View key={r.id} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: on ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 8, borderWidth: on ? 2 : 0, borderColor: r.color, opacity: s.trophies >= r.min || on ? 1 : 0.55 }}>
                <ItemIcon icon={r.icon} size={40} />
                <GT size={15} color={r.color} style={{ flex: 1, textAlign: 'right' }}>
                  {r.name}
                </GT>
                <GL>{`${r.min.toLocaleString()}+`}</GL>
              </View>
            );
          })}
        </View>
        <GT size={17} style={{ textAlign: 'right', marginTop: 18 }}>
          הטובים בישראל
        </GT>
        {!rows && !offline && <ActivityIndicator color="#fff" style={{ marginTop: 14 }} />}
        {offline && <GL style={{ textAlign: 'right', marginTop: 6 }}>אין חיבור לשרת כרגע — הטבלה תופיע כשיהיה אינטרנט.</GL>}
        {rows?.length === 0 && <GL style={{ textAlign: 'right', marginTop: 6 }}>עוד אין שחקנים בטבלה. תהיה הראשון!</GL>}
        <View style={{ marginTop: 8, gap: 6 }}>
          {rows?.map((r, i) => (
            <View key={r.id} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: r.me ? 'rgba(124,58,237,0.5)' : 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 8, borderWidth: r.me ? 2 : 0, borderColor: '#C4B5FD' }}>
              <GT size={15} style={{ width: 28 }}>
                {i + 1}
              </GT>
              <Sprite char={normSpecies(r.species)} size={40} fps={8} />
              <View style={{ flex: 1 }}>
                <GT size={14} style={{ textAlign: 'right' }} numberOfLines={1}>
                  {r.name}
                </GT>
                <GL size={11} style={{ textAlign: 'right' }}>{`${rankOf(r.trophies).label} · רמה ${r.level}`}</GL>
              </View>
              <GT size={14} color="#FDE68A">
                {r.trophies.toLocaleString()}
              </GT>
            </View>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

/** Creatures that joined you. The first three stand guard and make you stronger in every battle. */
export function GuardsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { s, toggleGuard } = useArena();
  const all = Object.keys(SPECIES) as SpeciesId[];
  return (
    <LinearGradient colors={['#4C1D95', '#2A1052', '#12082A']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24, paddingHorizontal: 14 }}>
        <Header title="השומרים שלי" onBack={onBack} />
        <GL style={{ textAlign: 'right', marginTop: 6 }}>{`ניצחון על בוס מצרף אליך יצור. 3 הראשונים שומרים עליך בקרב: כל שומר +4% חיים והתקפה. אספת ${s.guards.length} מתוך ${all.length}.`}</GL>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {all.map((sp) => {
            const idx = s.guards.indexOf(sp);
            const have = idx >= 0;
            const active = have && idx < 3;
            return (
              <Pressable key={sp} disabled={!have} onPress={() => toggleGuard(sp)} accessibilityLabel={`${SPECIES[sp].name}${active ? ', שומר פעיל' : have ? '' : ', עוד לא נאסף'}`} style={{ width: '31%' }}>
                <View style={{ height: 128, borderRadius: 16, backgroundColor: active ? 'rgba(250,204,21,0.18)' : 'rgba(0,0,0,0.35)', borderWidth: 2, borderColor: active ? '#FACC15' : have ? ELEMENTS[SPECIES[sp].element].color : 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6, overflow: 'hidden' }}>
                  <View style={{ position: 'absolute', top: 0, opacity: have ? 1 : 0.15 }}>
                    <Sprite char={sp} size={92} fps={have ? 10 : 1} />
                  </View>
                  <GT size={12}>{have ? SPECIES[sp].name : '???'}</GT>
                  {active && <GL size={10} color="#FDE68A">שומר פעיל</GL>}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

/** Skins: new looks for your fighter, bought with gems. Your own fighter's skins come first. */
export function SkinsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { s, buySkin, wearSkin } = useArena();
  const f = s.fighter!;
  const list = [...SKINS].sort((a, b) => Number(b.species === f.species) - Number(a.species === f.species));
  return (
    <LinearGradient colors={['#831843', '#2A1052', '#12082A']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24, paddingHorizontal: 14 }}>
        <Header title="סקינים" onBack={onBack} />
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6 }}>
          <Pill icon="Crystal1" value={s.gems} color="#67E8F9" />
        </View>
        <GL style={{ textAlign: 'right', marginTop: 8 }}>מראה חדש ללוחם שלך. אותו כוח, הרבה יותר סטייל.</GL>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          {[{ id: undefined as string | undefined, species: f.species, name: `${SPECIES[f.species].name} המקורי`, price: 0, rarity: 'epic' as const }, ...list].map((k) => {
            const mine = k.species === f.species;
            const owned = !k.id || s.skins.includes(k.id);
            const wearing = mine && f.skin === k.id;
            const color = k.rarity === 'legendary' ? '#F59E0B' : '#A855F7';
            return (
              <View key={k.id ?? 'base'} style={{ width: '47.5%', borderRadius: 18, borderWidth: 2.5, borderColor: wearing ? '#FFFFFF' : color, overflow: 'hidden', opacity: mine ? 1 : 0.55 }}>
                <LinearGradient colors={[k.rarity === 'legendary' ? 'rgba(245,158,11,0.35)' : 'rgba(168,85,247,0.35)', 'rgba(15,8,35,0.9)']} style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 10, paddingHorizontal: 8 }}>
                  <Sprite char={k.species} skin={k.id} anim={wearing ? 'win' : 'idle'} size={150} />
                  <GT size={13} style={{ textAlign: 'center' }} numberOfLines={1}>{k.name}</GT>
                  <GL size={10} color={color}>{k.id ? (k.rarity === 'legendary' ? 'אגדי' : 'אפי') : 'רגיל'}</GL>
                  {!mine ? (
                    <GL size={11} style={{ marginTop: 6 }}>{`ל${SPECIES[k.species].name} בלבד`}</GL>
                  ) : wearing ? (
                    <GL size={12} color="#86EFAC" style={{ marginTop: 6 }}>✓ בשימוש</GL>
                  ) : owned ? (
                    <GButton title="ללבוש" size={14} height={36} tone="blue" style={{ marginTop: 6, alignSelf: 'stretch' }} onPress={() => wearSkin(k.id)} />
                  ) : (
                    <GButton
                      title={`${k.price}`}
                      size={14}
                      height={36}
                      tone="gold"
                      style={{ marginTop: 6, alignSelf: 'stretch' }}
                      onPress={() => {
                        if (buySkin(k.id!)) notify('success');
                        else notify('error');
                      }}
                    >
                      <ItemIcon icon="Crystal1" size={22} />
                    </GButton>
                  )}
                </LinearGradient>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

/** Fighters: every fighter you can play, its special power, buy with coins and switch who fights. */
export function FightersScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { s, buyFighter, switchFighter } = useArena();
  const f = s.fighter!;
  const roster = s.roster ?? [f.species];
  const all = (Object.keys(SPECIES) as SpeciesId[]).filter((sp) => fighterPrice(sp) > 0 || roster.includes(sp));
  const [sel, setSel] = useState<SpeciesId>(f.species);
  const sp = SPECIES[sel];
  const mv = MOVES[sp.signature];
  const owned = roster.includes(sel);
  const price = fighterPrice(sel);
  return (
    <LinearGradient colors={['#7C2D12', '#2A1052', '#12082A']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24, paddingHorizontal: 14 }}>
        <Header title="לוחמים" onBack={onBack} />
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6 }}>
          <Pill icon="Coin" value={s.coins} />
        </View>
        <View style={{ marginTop: 10, borderRadius: 20, borderWidth: 3, borderColor: ELEMENTS[sp.element].color, backgroundColor: 'rgba(10,5,25,0.6)', padding: 12, flexDirection: 'row-reverse', alignItems: 'center' }}>
          <Sprite key={sel} char={sel} anim="win" size={150} live />
          <View style={{ flex: 1, gap: 4 }}>
            <GT size={22} style={{ textAlign: 'right' }}>{sp.name}</GT>
            <GL style={{ textAlign: 'right' }} color={ELEMENTS[sp.element].color}>{`${ELEMENTS[sp.element].icon} ${ELEMENTS[sp.element].label}`}</GL>
            <GL style={{ textAlign: 'right' }}>{sp.desc}</GL>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <ItemIcon icon={`mv_${mv.id}`} size={40} />
              <View style={{ flex: 1 }}>
                <GT size={14} color="#FDE68A" style={{ textAlign: 'right' }}>{`כוח מיוחד: ${mv.name}`}</GT>
                <GL size={11} style={{ textAlign: 'right' }}>{mv.desc}</GL>
              </View>
            </View>
          </View>
        </View>
        {f.species === sel ? (
          <GL size={14} color="#86EFAC" style={{ marginTop: 10 }}>✓ זה הלוחם שלך עכשיו</GL>
        ) : owned ? (
          <GButton title={`להילחם עם ${sp.name}`} tone="blue" style={{ marginTop: 10 }} onPress={() => switchFighter(sel)} />
        ) : (
          <GButton title={`לקנות ב-${price.toLocaleString()}`} tone="gold" style={{ marginTop: 10 }} disabled={s.coins < price} onPress={() => (buyFighter(sel) ? notify('success') : notify('error'))}>
            <ItemIcon icon="Coin" size={26} />
          </GButton>
        )}
        <GL size={11} style={{ marginTop: 6 }}>הרמה והציוד שלך עוברים איתך לכל לוחם</GL>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {all.map((id) => {
            const have = roster.includes(id);
            const on = id === sel;
            return (
              <Pressable key={id} onPress={() => setSel(id)} accessibilityLabel={`${SPECIES[id].name}${have ? '' : ', לקנייה'}`} style={{ width: '31%' }}>
                <View style={{ height: 124, borderRadius: 16, borderWidth: on ? 3 : 2, borderColor: on ? '#FFFFFF' : ELEMENTS[SPECIES[id].element].color, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6, overflow: 'hidden' }}>
                  <View style={{ position: 'absolute', top: 0, opacity: have ? 1 : 0.55 }}>
                    <Sprite char={id} size={88} />
                  </View>
                  <GT size={12}>{SPECIES[id].name}</GT>
                  {!have && (
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 2 }}>
                      <ItemIcon icon="Coin" size={14} />
                      <GL size={10} color="#FDE68A">{fighterPrice(id).toLocaleString()}</GL>
                    </View>
                  )}
                  {id === f.species && <GL size={10} color="#86EFAC">בשימוש</GL>}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
