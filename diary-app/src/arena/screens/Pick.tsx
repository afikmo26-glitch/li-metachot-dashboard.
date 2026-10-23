import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { play } from '../../lib/sound';
import { FONTS } from '../../lib/theme';
import { ELEMENTS, MOVES, SPECIES, SpeciesId, STARTERS, beats } from '../data';
import Sprite from '../Sprite';
import { useArena } from '../state';
import { Bar, Float, GButton, GL, GT, ItemIcon, MOVE_ICON, Rays } from '../ui';

/** First visit: choose your fighter from the six starters, each with its own element and power. */
export default function Pick({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { choose } = useArena();
  const [sel, setSel] = useState<SpeciesId>('YellowDragon');
  const [name, setName] = useState('');
  const sp = SPECIES[sel];
  const el = ELEMENTS[sp.element];
  const stats = [
    ['התקפה', sp.base.atk / 18, '#F43F5E'],
    ['הגנה', sp.base.def / 16, '#38BDF8'],
    ['מהירות', sp.base.spd / 16, '#FACC15'],
    ['חיים', sp.base.hp / 130, '#34D399'],
  ] as const;
  const sig = MOVES[sp.signature];

  return (
    <LinearGradient colors={[el.color, '#2A1052', '#12082A']} locations={[0, 0.45, 1]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 20, paddingHorizontal: 16 }}>
        <GT size={26}>בחר את הלוחם שלך</GT>
        <GL style={{ marginTop: 4 }}>לכל חיה כוח מיוחד. אפשר לאסוף עוד חיות בהמשך</GL>

        <View style={{ height: 230, alignItems: 'center', justifyContent: 'center' }}>
          <Rays size={420} />
          <View style={{ position: 'absolute', bottom: 18, width: 170, height: 34, borderRadius: 85, backgroundColor: 'rgba(0,0,0,0.3)' }} />
          <Float>
            <Sprite key={sel} char={sel} anim="win" size={220} />
          </Float>
        </View>

        <View style={{ backgroundColor: 'rgba(10,5,25,0.72)', borderRadius: 20, borderWidth: 2, borderColor: el.color, padding: 14 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <GT size={24} style={{ textAlign: 'right' }}>
                {sp.name}
              </GT>
              <GL color={el.color} style={{ textAlign: 'right' }}>{`${el.icon} ${el.label} · חזק נגד ${ELEMENTS[beats(sp.element)].label}`}</GL>
            </View>
            <View style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 6, width: 96 }}>
              <ItemIcon icon={MOVE_ICON[sig.id]} size={38} />
              <GL size={11} color="#fff">
                {sig.name}
              </GL>
            </View>
          </View>
          <GL size={13} color="#DDD6FE" style={{ textAlign: 'right', marginTop: 6 }}>
            {sp.desc}
          </GL>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            {stats.map(([label, v, c]) => (
              <View key={label} style={{ width: '47%' }}>
                <GL size={11} style={{ textAlign: 'right' }}>
                  {label}
                </GL>
                <Bar value={v} color={c} height={9} style={{ marginTop: 3 }} />
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' }}>
          {STARTERS.map((id) => {
            const on = id === sel;
            const c = ELEMENTS[SPECIES[id].element].color;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  play('tap', 0.4);
                  setSel(id);
                }}
                accessibilityLabel={SPECIES[id].name}
                accessibilityState={{ selected: on }}
                style={({ pressed }) => ({ width: '31%', transform: [{ scale: pressed ? 0.95 : 1 }] })}
              >
                <LinearGradient colors={on ? [c, '#1E1033'] : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']} style={{ height: 104, borderRadius: 16, borderWidth: on ? 3 : 1.5, borderColor: on ? '#fff' : 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6, overflow: 'hidden' }}>
                  <View style={{ position: 'absolute', top: 0 }}>
                    <Sprite char={id} size={80} fps={10} />
                  </View>
                  <GT size={13}>{SPECIES[id].name}</GT>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={`שם ללוחם (למשל ${sp.name})`}
          placeholderTextColor="#A78BFA"
          maxLength={14}
          style={{ marginTop: 14, height: 48, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', color: '#fff', fontFamily: FONTS.bold, fontSize: 16, textAlign: 'right', paddingHorizontal: 14 }}
        />
        <GButton
          title={`בחר את ${name.trim() || sp.name}!`}
          size={20}
          style={{ marginTop: 14 }}
          onPress={() => {
            play('levelup', 0.6);
            choose(sel, name.trim());
            onDone();
          }}
        />
      </ScrollView>
    </LinearGradient>
  );
}
