import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Text, useWindowDimensions, View, type ViewInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Pet from '../components/pet/Pet';
import { Room } from '../components/pet/art';
import { Card, Chip, GhostButton, GradientButton, Input, notify, Row, T } from '../components/ui';
import { t } from '../i18n';
import { loadSession, myPetInfo, PetCard, publishPet, sendHeart, visitPet } from '../lib/cloud';
import { PetState, Stage, STAGE_LABELS } from '../lib/pet';
import { PACKS, packItems, useShop } from '../lib/shop';
import { useStore } from '../lib/store';
import { colors, gradients } from '../lib/theme';

/** The pet's social side: the outfit shop, friends' pets by code, and a card to share in a story. */

export function Shop() {
  const { owned, prices, busy, error, buy, restore } = useShop(true);
  return (
    <Card style={{ marginTop: 10 }}>
      <T dim size={13} style={{ marginBottom: 8, lineHeight: 19 }}>
        {t('חבילות בגדים מיוחדות לחבר. רק מראה — כל השאר באפליקציה נשאר חינמי.')}
      </T>
      {PACKS.map((p) => {
        const has = owned.includes(p.id);
        return (
          <View key={p.id} style={{ borderWidth: 1, borderColor: has ? colors.green : colors.border, borderRadius: 18, padding: 12, marginBottom: 10 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <T bold size={17}>
                {p.emoji} {t(p.title)}
              </T>
              <T bold style={{ color: has ? colors.green : colors.yellow }}>
                {has ? t('✓ שלך') : prices[p.id] ?? p.fallbackPrice}
              </T>
            </Row>
            <Row style={{ gap: 14, marginTop: 8 }}>
              {packItems(p.id).map((i) => (
                <View key={i.id} style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 30 }}>{i.emoji}</Text>
                  <T size={12}>{t(i.label)}</T>
                </View>
              ))}
            </Row>
            {!has && <GradientButton title={busy === p.id ? t('רגע…') : t('💎 לקנות')} colors={gradients.primary} onPress={() => buy(p.id)} disabled={!!busy} small style={{ marginTop: 10 }} />}
          </View>
        );
      })}
      {error && (
        <T size={13} style={{ color: colors.red, marginBottom: 6 }}>
          {error}
        </T>
      )}
      <GhostButton title={t('שחזור קניות')} onPress={restore} style={{ borderWidth: 0 }} />
    </Card>
  );
}

const cardOf = (pet: PetState, level: number, stage: Stage): PetCard => ({ name: pet.name || t('יומי'), species: pet.species, wear: pet.wear, level, stage });

/** Keeps the public pet card up to date (name, look, level only) while signed in. */
export function usePublishPet(level: number, stage: Stage) {
  const { pet } = useStore();
  useEffect(() => {
    if (!pet.hatched) return;
    const timer = setTimeout(async () => {
      if (await loadSession()) publishPet(cardOf(pet, level, stage)).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [pet.hatched, pet.name, pet.species, pet.wear, level, stage, pet]);
}

export function Friends({ level, stage }: { level: number; stage: Stage }) {
  const { pet, updatePet } = useStore();
  const [me, setMe] = useState<{ code?: string; hearts: number } | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [code, setCode] = useState('');
  const [visit, setVisit] = useState<{ code: string; card: PetCard; hearts: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await loadSession();
      setSignedIn(!!s);
      if (!s) return;
      const c = await publishPet(cardOf(pet, level, stage)).catch(() => null);
      const info = await myPetInfo().catch(() => null);
      setMe(info ? { ...info, code: info.code ?? c ?? undefined } : c ? { code: c, hearts: 0 } : null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = async (c: string) => {
    setError(null);
    try {
      const r = await visitPet(c);
      const clean = c.trim().toUpperCase();
      setVisit({ code: clean, ...r });
      if (!(pet.friends ?? []).some((f) => f.code === clean) && clean !== me?.code) {
        updatePet({ friends: [...(pet.friends ?? []), { code: clean, name: r.card.name }].slice(-30) });
      }
      setCode('');
    } catch (e) {
      setError((e as { status?: number }).status === 404 ? t('לא מצאתי חבר עם הקוד הזה') : (e as Error).message);
    }
  };

  return (
    <Card style={{ marginTop: 10 }}>
      {signedIn ? (
        <>
          <T bold>{t('הקוד של {name}', { name: pet.name || t('יומי') })}</T>
          <Text selectable style={{ fontSize: 34, fontWeight: '800', letterSpacing: 6, color: colors.primaryHi, textAlign: 'center', marginVertical: 6 }}>
            {me?.code ?? '······'}
          </Text>
          <T dim size={13} style={{ textAlign: 'center' }}>
            {t('שלח את הקוד לחברים — הם יוכלו לבקר את {name} ולשלוח לב 💗', { name: pet.name || t('יומי') })}
          </T>
          <T bold style={{ textAlign: 'center', marginTop: 6 }}>
            {t('💗 {n} לבבות קיבלת', { n: me?.hearts ?? 0 })}
          </T>
        </>
      ) : (
        <T size={14} style={{ lineHeight: 20 }}>
          {t('כדי לקבל קוד ולבקר חברים, התחבר לענן בהגדרות (☁️ גיבוי בענן). רואים רק את החבר — אף פעם לא את היומן.')}
        </T>
      )}

      <T bold style={{ marginTop: 14, marginBottom: 6 }}>
        {t('👫 לבקר חבר')}
      </T>
      <Row style={{ gap: 8 }}>
        <Input
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase().slice(0, 6))}
          placeholder={t('קוד של חבר')}
          autoCapitalize="characters"
          style={{ flex: 1, textAlign: 'center', letterSpacing: 4 }}
        />
        <GradientButton title={t('בקר')} colors={gradients.primary} onPress={() => open(code)} disabled={code.length < 6} small />
      </Row>
      {error && (
        <T size={13} style={{ color: colors.red, marginTop: 6 }}>
          {error}
        </T>
      )}
      {(pet.friends ?? []).length > 0 && (
        <Row style={{ flexWrap: 'wrap', marginTop: 8 }}>
          {(pet.friends ?? []).map((f) => (
            <Chip key={f.code} label={`🐾 ${f.name}`} onPress={() => open(f.code)} />
          ))}
        </Row>
      )}
      <VisitModal visit={visit} onClose={() => setVisit(null)} onHeart={(h) => visit && setVisit({ ...visit, hearts: h })} />
    </Card>
  );
}

function VisitModal({ visit, onClose, onHeart }: { visit: { code: string; card: PetCard; hearts: number } | null; onClose: () => void; onHeart: (h: number) => void }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width, 480) - 40;
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setMsg(null), [visit?.code]);
  if (!visit) return null;
  const c = visit.card;
  const pet = { species: c.species as PetState['species'], wear: c.wear, hatched: true, eggTaps: 0 };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000b', justifyContent: 'center', padding: 20 }}>
        <Card style={{ alignItems: 'center', padding: 12 }}>
          <T bold size={22}>
            {t('ביקור אצל {name}', { name: c.name })}
          </T>
          <T dim size={13}>
            {t(STAGE_LABELS[(c.stage as Stage) ?? 'baby'] ?? '')} · {t('רמה {n}', { n: c.level })} · 💗 {visit.hearts}
          </T>
          <View style={{ width: w, height: 280, borderRadius: 22, overflow: 'hidden', marginTop: 10 }}>
            <Room id={c.wear.bg} width={w} height={280} />
            <View style={{ position: 'absolute', bottom: 12, alignSelf: 'center' }}>
              <Pet pet={pet} stage={(c.stage as Stage) || 'kid'} size={210} />
            </View>
          </View>
          {msg && <T style={{ marginTop: 8 }}>{msg}</T>}
          <GradientButton
            title={t('💗 שלח לב')}
            colors={gradients.primary}
            onPress={async () => {
              try {
                const r = await sendHeart(visit.code);
                onHeart(r.hearts);
                notify('success');
                setMsg(r.already ? t('כבר שלחת לב היום 💗 אפשר שוב מחר') : t('הלב נשלח! 💗'));
              } catch (e) {
                setMsg((e as Error).message);
              }
            }}
            style={{ alignSelf: 'stretch', marginTop: 10 }}
          />
          <GhostButton title={t('סגור')} onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 8, borderWidth: 0 }} />
        </Card>
      </View>
    </Modal>
  );
}

/** A pretty card of the pet for a story: room, pet, name and level. */
export function ShareCardModal({ visible, onClose, level, levelTitle, stage }: { visible: boolean; onClose: () => void; level: number; levelTitle: string; stage: Stage }) {
  const { pet } = useStore();
  const ref = useRef<ViewInstance>(null);
  const [busy, setBusy] = useState(false);
  const W = 300;
  const share = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(t('שיתוף זמין באפליקציה בטלפון'));
      return;
    }
    setBusy(true);
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('שתף את {name}', { name: pet.name }) });
    } catch {
      Alert.alert(t('לא הצלחתי ליצור את התמונה'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000b', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View ref={ref} collapsable={false} style={{ width: W, height: W * 1.5, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.bg }}>
          <Room id={pet.wear.bg} width={W} height={W * 1.5} />
          <View style={{ position: 'absolute', top: 26, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 32, fontWeight: '900', textShadowColor: '#0008', textShadowRadius: 8 }}>{pet.name}</Text>
            <View style={{ backgroundColor: '#0007', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, marginTop: 6 }}>
              <Text style={{ color: '#FFE45C', fontWeight: '800' }}>
                {t('רמה {n} · {title}', { n: level, title: levelTitle })}
              </Text>
            </View>
          </View>
          <View style={{ position: 'absolute', bottom: 54, alignSelf: 'center' }}>
            <Pet pet={pet} stage={stage} size={250} interactive={false} />
          </View>
          <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700', opacity: 0.9 }}>{t('📔 היומן שלי')}</Text>
          </View>
        </View>
        <Row style={{ gap: 10, marginTop: 16, width: W }}>
          <GradientButton title={busy ? t('רגע…') : t('📤 שתף')} colors={gradients.primary} onPress={share} style={{ flex: 1 }} />
          <GhostButton title={t('סגור')} onPress={onClose} style={{ flex: 1 }} />
        </Row>
      </View>
    </Modal>
  );
}

