import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Pet, { PetHandle } from '../components/pet/Pet';
import { Room } from '../components/pet/art';
import { Card, Chip, GradientButton, Input, notify, Row, T, tap } from '../components/ui';
import { Confetti } from '../components/Wow';
import { t } from '../i18n';
import { dayKey } from '../lib/dates';
import {
  care,
  currentLove,
  EGG_TAPS,
  isNight,
  itemsFor,
  levelTitle,
  MAX_LEVEL,
  petLine,
  SLOTS,
  Slot,
  SPECIES,
  Species,
  STAGE_LABELS,
  stageOf,
  treatsLeft,
  unlockedAt,
  XP_PER_LEVEL,
} from '../lib/pet';
import { play } from '../lib/sound';
import { useStore } from '../lib/store';
import { colors, gradients } from '../lib/theme';
import { useLevel } from '../lib/useLevel';
import GameScreen from './GameScreen';

/** "My pet": hatch it, name it, pet it, hug it, feed it, dress it up, and watch it grow with your levels. */
export default function PetScreen() {
  const { pet, updatePet, entries, settings } = useStore();
  const lvl = useLevel();
  const { width } = useWindowDimensions();
  const stageW = Math.min(width, 520) - 36;
  const ref = useRef<PetHandle>(null);
  const stage = stageOf(pet, lvl.level);
  const love = currentLove(pet);
  const wroteToday = entries.some((e) => dayKey(e.createdAt) === dayKey(new Date()));
  const treats = treatsLeft(pet, entries);
  const [line, setLine] = useState('');
  const [tabSel, setTabSel] = useState<'closet' | 'levels'>('closet');
  const [naming, setNaming] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [boom, setBoom] = useState(0);
  const lastCare = useRef(0);
  const sleeping = isNight();

  // Say hello when the screen opens, then something new every so often
  useEffect(() => {
    if (!pet.hatched) return;
    setLine((cur) => cur || petLine(pet, settings.userName, wroteToday, love));
    const hi = setTimeout(() => ref.current?.wave(), 500);
    const timer = setInterval(() => setLine(petLine(pet, settings.userName, wroteToday, currentLove(pet))), 20000);
    return () => {
      clearTimeout(hi);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet.hatched]);

  const say = (s: string) => setLine(s);

  /** Care actions update love/XP at most every 700ms, so a long petting session doesn't write on every stroke. */
  const careFor = (loveGain: number, xp: number, kind?: 'pets' | 'hugs' | 'treatsEaten', force = false) => {
    const now = Date.now();
    if (!force && now - lastCare.current < 700) return;
    lastCare.current = now;
    updatePet((p) => care(p, loveGain, xp, kind));
  };

  const eggTap = () => {
    const taps = pet.eggTaps + 1;
    if (taps >= EGG_TAPS) {
      play('levelup', 0.6);
      notify('success');
      setBoom((b) => b + 1);
      updatePet({ eggTaps: taps });
      setTimeout(() => setNaming(true), 700);
    } else {
      tap('medium');
      updatePet({ eggTaps: taps });
    }
  };

  const feed = () => {
    if (!treats) {
      say(t('אין לי פינוקים… 🥺 כל יום שתכתוב ביומן תקבל 🍪 בשבילי'));
      return;
    }
    ref.current?.feed();
    play('pop', 0.5);
    careFor(10, 2, 'treatsEaten', true);
    setTimeout(() => say(t('ממממ! טעים! 😋 תודה!')), 700);
  };

  // A level the pet hasn't celebrated yet: party, and show what it unlocked
  const newLevel = pet.hatched && lvl.level > pet.seenLevel ? lvl.level : null;
  useEffect(() => {
    if (newLevel) {
      play('levelup', 0.6);
      setBoom((b) => b + 1);
      setTimeout(() => ref.current?.celebrate(), 300);
    }
  }, [newLevel]);

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T bold size={28}>
            {pet.hatched ? pet.name || t('יומי') : t('🥚 הביצה שלך')}
          </T>
          <T dim size={13}>
            {pet.hatched ? `${t(STAGE_LABELS[stage])} · ${t('רמה {n} · {title}', { n: lvl.level, title: lvl.title })}` : t('תקיש עליה כדי לעזור לה לבקוע')}
          </T>
        </View>
        {pet.hatched && <Chip label={t('✏️ שם')} onPress={() => setNaming(true)} />}
      </Row>

      {/* Stage */}
      <View style={{ marginTop: 12, borderRadius: 28, overflow: 'hidden', width: stageW, height: 340, alignSelf: 'center', borderWidth: 1, borderColor: colors.border }}>
        <Room id={pet.wear.bg} width={stageW} height={340} />
        {pet.hatched && !!line && (
          <View style={{ position: 'absolute', top: 14, alignSelf: 'center', maxWidth: stageW - 40, backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#2B2140', fontSize: 15, fontWeight: '600', textAlign: 'center' }}>{line}</Text>
          </View>
        )}
        <View style={{ position: 'absolute', bottom: 18, alignSelf: 'center' }}>
          <Pet
            ref={ref}
            pet={pet}
            stage={stage}
            size={250}
            sleeping={sleeping}
            onEggTap={eggTap}
            onTap={() => say(sleeping ? t('מה? אה… היי 😴') : [t('היי! 😆'), t('זה מדגדג! 🤭'), t('בוא נשחק!'), t('אני פה! 👋')][Math.floor(Math.random() * 4)])}
            onStroke={() => {
              careFor(2, 1, 'pets');
              say([t('פררר… 😌'), t('עוד! עוד! 🥰'), t('איזה כיף…'), t('אני אוהב ליטופים 💜')][Math.floor(Math.random() * 4)]);
            }}
            onHug={() => {
              careFor(5, 2, 'hugs', true);
              say(t('גם אני אוהב אותך! 🤗💜'));
            }}
          />
        </View>
        {!pet.hatched && (
          <View style={{ position: 'absolute', bottom: 12, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ backgroundColor: '#0006', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{'🥚'.repeat(Math.max(0, EGG_TAPS - pet.eggTaps)) || '✨'}</Text>
            </View>
          </View>
        )}
      </View>

      {pet.hatched && (
        <>
          {/* Love */}
          <Row style={{ alignItems: 'center', gap: 10, marginTop: 14 }}>
            <Text style={{ fontSize: 22 }}>{love > 70 ? '💖' : love > 40 ? '💗' : '🤍'}</Text>
            <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: colors.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              <View style={{ width: `${love}%`, height: '100%', backgroundColor: colors.pink, borderRadius: 6 }} />
            </View>
            <T dim size={13}>
              {t('אהבה {n}%', { n: love })}
            </T>
          </Row>

          {/* Actions */}
          <Row style={{ gap: 8, marginTop: 12 }}>
            <Action emoji="🤗" label={t('חיבוק')} onPress={() => { ref.current?.hug(); careFor(5, 2, 'hugs', true); say(t('גם אני אוהב אותך! 🤗💜')); }} />
            <Action emoji="🍪" label={t('פינוק ({n})', { n: treats })} onPress={feed} />
            <Action emoji="👅" label={t('פרצוף')} onPress={() => { ref.current?.tongue(); say(t('בלה! 😜')); }} />
            <Action emoji="🎮" label={t('לשחק')} onPress={() => setGameOpen(true)} />
          </Row>
          <T dim size={12} style={{ textAlign: 'center', marginTop: 8 }}>
            {t('💡 החלק עליו כדי ללטף · לחיצה ארוכה = חיבוק · הקשה = קפיצה')}
          </T>

          {/* Closet / levels */}
          <Row style={{ gap: 8, marginTop: 18 }}>
            <Chip label={t('👕 הארון')} active={tabSel === 'closet'} onPress={() => setTabSel('closet')} />
            <Chip label={t('🏆 שלבים')} active={tabSel === 'levels'} onPress={() => setTabSel('levels')} />
          </Row>
          {tabSel === 'closet' ? <Closet level={lvl.level} /> : <Levels xp={lvl.xp} level={lvl.level} />}
        </>
      )}

      <NameModal
        visible={naming}
        level={lvl.level}
        first={!pet.hatched}
        onDone={(name, species) => {
          setNaming(false);
          const first = !pet.hatched;
          updatePet({ name, species, hatched: true, ...(first ? { bornAt: new Date().toISOString(), loveAt: new Date().toISOString(), love: 80, seenLevel: lvl.level } : {}) });
          if (first) setTimeout(() => ref.current?.celebrate(), 400);
          setLine(first ? t('שלום! אני {name}! 💜 תלטף אותי?', { name }) : t('אני {name} עכשיו! 😍', { name }));
        }}
      />
      <LevelUpModal level={newLevel} onClose={() => newLevel && updatePet({ seenLevel: newLevel })} />
      <Modal visible={gameOpen} animationType="slide" onRequestClose={() => setGameOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <Row style={{ justifyContent: 'flex-end', padding: 12 }}>
            <Pressable onPress={() => setGameOpen(false)} hitSlop={12}>
              <T bold style={{ color: colors.primaryHi }}>
                {t('סגור ✕')}
              </T>
            </Pressable>
          </Row>
          <GameScreen />
        </SafeAreaView>
      </Modal>
      <Confetti fire={boom} pieces={50} />
    </ScrollView>
  );
}

function Action({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, transform: [{ scale: pressed ? 0.96 : 1 }] })}
    >
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
      <T size={12} bold style={{ marginTop: 2 }}>
        {label}
      </T>
    </Pressable>
  );
}

const NO_REMOVE: Slot[] = ['color', 'bg'];

function Closet({ level }: { level: number }) {
  const { pet, updatePet } = useStore();
  const [slot, setSlot] = useState<Slot | 'species'>('color');
  const items = slot === 'species' ? SPECIES.map((s) => ({ ...s, slot: 'species' as const })) : itemsFor(slot);
  const worn = (id: string) => (slot === 'species' ? pet.species === id : pet.wear[slot] === id);
  const pick = (id: string, need: number) => {
    if (need > level) {
      notify('error');
      return;
    }
    tap();
    if (slot === 'species') updatePet({ species: id as Species });
    else updatePet({ wear: { ...pet.wear, [slot]: worn(id) && !NO_REMOVE.includes(slot) ? undefined : id } });
  };
  return (
    <Card style={{ marginTop: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {[...SLOTS, { slot: 'species' as const, label: 'דמות', emoji: '🐾' }].map((s) => (
          <Chip key={s.slot} label={`${s.emoji} ${t(s.label)}`} active={slot === s.slot} onPress={() => setSlot(s.slot)} />
        ))}
      </ScrollView>
      <Row style={{ flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {items.map((it) => {
          const locked = it.level > level;
          const on = worn(it.id);
          return (
            <Pressable
              key={it.id}
              onPress={() => pick(it.id, it.level)}
              style={({ pressed }) => ({
                width: '31%',
                alignItems: 'center',
                paddingVertical: 10,
                borderRadius: 16,
                backgroundColor: on ? colors.cardHi : colors.bgDeep,
                borderWidth: on ? 2 : 1,
                borderColor: on ? colors.primaryHi : colors.border,
                opacity: locked ? 0.5 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Text style={{ fontSize: 28 }}>{locked ? '🔒' : it.emoji}</Text>
              <T size={12} bold style={{ textAlign: 'center', marginTop: 2 }}>
                {t(it.label)}
              </T>
              {locked && (
                <T dim size={11}>
                  {t('רמה {n}', { n: it.level })}
                </T>
              )}
            </Pressable>
          );
        })}
      </Row>
    </Card>
  );
}

function Levels({ xp, level }: { xp: number; level: number }) {
  return (
    <Card style={{ marginTop: 10 }}>
      <T bold size={17}>
        {t('⭐ {xp} XP', { xp })}
      </T>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.bgDeep, marginTop: 8, overflow: 'hidden' }}>
        <View style={{ width: `${level >= MAX_LEVEL ? 100 : ((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100}%`, height: '100%', backgroundColor: colors.yellow }} />
      </View>
      <T dim size={12} style={{ marginTop: 6 }}>
        {level >= MAX_LEVEL ? t('👑 הגעת לרמה הכי גבוהה!') : t('עוד {n} XP לרמה הבאה', { n: XP_PER_LEVEL - (xp % XP_PER_LEVEL) })}
      </T>

      <T bold style={{ marginTop: 14, marginBottom: 6 }}>
        {t('איך צוברים XP?')}
      </T>
      {[
        t('📖 יום שכתבת ביומן · 20'),
        t('🎙️ יום עם הקלטה · 10'),
        t('🔥 כל שבוע ברצף · 50'),
        t('🧠 משחק הזיכרון ואתגרים שבועיים'),
        t('👥 כל אדם חדש · 5'),
        t('🐷 יום עם הפקדה לחיסכון · 5'),
        t('🤗 ליטופים, חיבוקים ופינוקים · עד 10 ביום'),
      ].map((s) => (
        <T key={s} dim size={13} style={{ marginBottom: 2 }}>
          {s}
        </T>
      ))}

      <T bold style={{ marginTop: 14, marginBottom: 6 }}>
        {t('מה כל שלב פותח')}
      </T>
      {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => {
        const got = unlockedAt(n);
        const stage = n >= MAX_LEVEL ? 'legend' : n >= 6 ? 'teen' : n >= 3 ? 'kid' : 'baby';
        const grows = n === 3 || n === 6 || n === MAX_LEVEL;
        return (
          <Row
            key={n}
            style={{ alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: n < MAX_LEVEL ? 1 : 0, borderBottomColor: colors.border, opacity: n > level ? 0.6 : 1 }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: n <= level ? colors.primary : colors.bgDeep }}>
              <T bold style={{ color: n <= level ? '#fff' : colors.textDim }}>
                {n <= level ? n : '🔒'}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T bold size={14}>
                {levelTitle(n)}
                {grows ? `  ${t(STAGE_LABELS[stage])}` : ''}
              </T>
              <T dim size={13}>
                {got.map((g) => g.emoji).join(' ')}
              </T>
            </View>
          </Row>
        );
      })}
    </Card>
  );
}

function NameModal({ visible, level, first, onDone }: { visible: boolean; level: number; first: boolean; onDone: (name: string, species: Species) => void }) {
  const { pet } = useStore();
  const [name, setName] = useState(pet.name);
  const [species, setSpecies] = useState<Species>(pet.species);
  useEffect(() => {
    if (visible) {
      setName(pet.name);
      setSpecies(pet.species);
    }
  }, [visible, pet.name, pet.species]);
  const preview = useMemo(() => ({ ...pet, species, hatched: true }), [pet, species]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {
      if (!first) onDone(pet.name, pet.species);
    }}>
      <View style={{ flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 22 }}>
        <Card style={{ alignItems: 'center' }}>
          <T bold size={24} style={{ textAlign: 'center' }}>
            {first ? t('🎉 נולד לך חבר!') : t('✏️ שם וסוג')}
          </T>
          <T dim style={{ textAlign: 'center', marginTop: 4 }}>
            {t('איך תקרא לו?')}
          </T>
          <Pet pet={preview} stage="baby" size={150} interactive={false} />
          <Input value={name} onChangeText={setName} placeholder={t('שם (למשל: מוצ׳י, לולו, בובי)')} maxLength={16} style={{ alignSelf: 'stretch', textAlign: 'center' }} />
          <Row style={{ flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
            {SPECIES.map((s) => (
              <Chip key={s.id} label={`${s.level > level ? '🔒' : s.emoji} ${t(s.label)}`} active={species === s.id} onPress={() => s.level <= level && setSpecies(s.id)} />
            ))}
          </Row>
          <GradientButton
            title={first ? t('יאללה! 🐣') : t('שמור')}
            colors={gradients.primary}
            disabled={!name.trim()}
            onPress={() => onDone(name.trim(), species)}
            style={{ alignSelf: 'stretch', marginTop: 14 }}
          />
        </Card>
      </View>
    </Modal>
  );
}

function LevelUpModal({ level, onClose }: { level: number | null; onClose: () => void }) {
  const got = level ? unlockedAt(level) : [];
  return (
    <Modal visible={!!level} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 22 }}>
        <Card style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 56 }}>🏆</Text>
          <T bold size={26} style={{ textAlign: 'center' }}>
            {t('עלית לרמה {n}!', { n: level ?? 0 })}
          </T>
          <T dim style={{ textAlign: 'center', marginTop: 4 }}>
            {level ? levelTitle(level) : ''}
          </T>
          {level === 3 || level === 6 || level === MAX_LEVEL ? (
            <T bold style={{ marginTop: 10, color: colors.primaryHi, textAlign: 'center' }}>
              {t('החבר שלך גדל! 🌱')}
            </T>
          ) : null}
          {got.length > 0 && (
            <>
              <T bold style={{ marginTop: 12 }}>
                {t('קיבלת:')}
              </T>
              <Row style={{ flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 }}>
                {got.map((g) => (
                  <View key={g.id} style={{ alignItems: 'center', width: 76 }}>
                    <Text style={{ fontSize: 30 }}>{g.emoji}</Text>
                    <T size={12} style={{ textAlign: 'center' }}>
                      {t(g.label)}
                    </T>
                  </View>
                ))}
              </Row>
            </>
          )}
          <GradientButton title={t('יש! 🎉')} colors={gradients.primary} onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 16 }} />
        </Card>
      </View>
    </Modal>
  );
}

