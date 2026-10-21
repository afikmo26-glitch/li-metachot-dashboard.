import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, FadeIn, GhostButton, GradientButton, Input, Row, T } from '../components/ui';
import { t } from '../i18n';
import { useStore } from '../lib/store';
import { colors, gradients, layout } from '../lib/theme';
import { Confetti, PopEmoji } from '../components/Wow';
import { Avatar } from './PeopleScreen';
import { CIRCLES, circleColor } from '../lib/circles';
import { notify } from '../components/ui';
import type { Circle, UserProfile } from '../lib/types';

/**
 * First-run "getting to know you": age, work, family, five close friends and what
 * matters to the user. People become entries in the People list (with who they are),
 * which feeds the memory game and gives Yomi context from day one.
 */

const JOB_CHIPS = ['סטודנט/ית', 'שכיר/ה', 'עצמאי/ת', 'חייל/ת', 'בפנסיה', 'מחפש/ת עבודה'];
const GOALS = ['לזכור אנשים ושיחות', 'להבין את עצמי', 'לפרוק ולהירגע', 'להיות אסיר/ת תודה', 'לעקוב אחרי מצב הרוח', 'לא לשכוח אירועים'];
const FAMILY: { key: string; label: string; role: string; multi?: boolean }[] = [
  { key: 'mom', label: 'איך קוראים לאמא שלך?', role: 'אמא' },
  { key: 'dad', label: 'ולאבא שלך?', role: 'אבא' },
  { key: 'partner', label: 'בן/בת זוג (אם יש)', role: 'בן/בת זוג' },
  { key: 'siblings', label: 'אחים ואחיות (מופרדים בפסיקים)', role: 'אח/אחות', multi: true },
  { key: 'kids', label: 'ילדים (מופרדים בפסיקים)', role: 'ילד/ה', multi: true },
];

type Friend = { name: string; how: string };

export default function IntroScreen({ onDone }: { onDone: () => void }) {
  const { profile, updateProfile, people, addPerson, updatePerson, settings } = useStore();
  const [step, setStep] = useState(0);
  const [met, setMet] = useState<{ name: string; circle: Circle }[] | null>(null);
  const [p, setP] = useState<UserProfile>(profile);
  const [family, setFamily] = useState<Record<string, string>>({});
  const [friends, setFriends] = useState<Friend[]>(Array.from({ length: 5 }, () => ({ name: '', how: '' })));

  const steps = 5;

  const finish = () => {
    const added: { name: string; circle: Circle }[] = [];
    // Save people with who they are; existing people keep their note unless they had none
    const add = (name: string, note: string, circle: Circle) => {
      const n = name.trim();
      if (!n) return;
      added.push({ name: n, circle });
      const existing = people.find((x) => x.name === n);
      const person = existing ?? addPerson(n);
      updatePerson({ ...person, note: person.note || note, circle: person.circle ?? circle });
    };
    for (const f of FAMILY) {
      const raw = family[f.key] ?? '';
      const names = f.multi ? raw.split(/[,،]/) : [raw];
      names.forEach((n) => add(n, t(f.role), 'family'));
    }
    friends.forEach((f) => add(f.name, f.how.trim() ? `${t('חבר/ה קרוב/ה')} · ${f.how.trim()}` : t('חבר/ה קרוב/ה'), 'friends'));
    updateProfile({ ...p, done: true });
    notify('success');
    setMet(added);
  };

  if (met) return <Celebration name={settings.userName} met={met} onDone={onDone} />;

  const next = () => (step < steps - 1 ? setStep(step + 1) : finish());
  const toggleGoal = (g: string) => setP((x) => ({ ...x, goals: x.goals.includes(g) ? x.goals.filter((y) => y !== g) : [...x.goals, g] }));

  return (
    <LinearGradient colors={gradients.app} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <T dim size={13}>
                {t('שלב {i} מתוך {n}', { i: step + 1, n: steps })}
              </T>
              <Pressable onPress={finish} hitSlop={12}>
                <T dim size={14}>
                  {t('דלג')}
                </T>
              </Pressable>
            </Row>
            <View style={{ height: 6, backgroundColor: colors.bgDeep, borderRadius: 3, marginTop: 8, overflow: 'hidden', transform: [{ scaleX: layout.flip }] }}>
              <View style={{ width: `${((step + 1) / steps) * 100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 3 }} />
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* Remount per step so each one fades in */}
            <FadeIn key={step}>
              {step === 0 && (
                <Step emoji="👋" title={t('נעים להכיר!')} subtitle={t('כמה שאלות קצרות כדי שיומי יכיר אותך ויוכל ללוות אותך באמת')}>
                  <Label text={t('בן/בת כמה את/ה?')} />
                  <Input value={p.age ?? ''} onChangeText={(age) => setP({ ...p, age })} placeholder={t('למשל 28')} keyboardType="number-pad" />
                  <Label text={t('איפה את/ה גר/ה?')} />
                  <Input value={p.city ?? ''} onChangeText={(city) => setP({ ...p, city })} placeholder={t('עיר')} />
                </Step>
              )}

              {step === 1 && (
                <Step emoji="💼" title={t('מה את/ה עושה בחיים?')} subtitle={t('ככה אדע לשאול אותך על העבודה או הלימודים')}>
                  <Row style={{ flexWrap: 'wrap', marginBottom: 6 }}>
                    {JOB_CHIPS.map((c) => (
                      <Chip key={c} label={t(c)} active={p.job === t(c)} onPress={() => setP({ ...p, job: t(c) })} />
                    ))}
                  </Row>
                  <Input value={p.job ?? ''} onChangeText={(job) => setP({ ...p, job })} placeholder={t('תפקיד או תחום (למשל מורה, מתכנת)')} />
                  <Label text={t('איפה? (מקום עבודה / לימודים)')} />
                  <Input value={p.workplace ?? ''} onChangeText={(workplace) => setP({ ...p, workplace })} placeholder={t('לא חובה')} />
                </Step>
              )}

              {step === 2 && (
                <Step emoji="👨‍👩‍👧" title={t('המשפחה שלך')} subtitle={t('השמות ייכנסו לרשימת האנשים שלך, ואזהה אותם כשתספר על היום')}>
                  <Label text={t('שם המשפחה שלך')} />
                  <Input value={p.familyName ?? ''} onChangeText={(familyName) => setP({ ...p, familyName })} placeholder={t('שם משפחה')} />
                  {FAMILY.map((f) => (
                    <View key={f.key}>
                      <Label text={t(f.label)} />
                      <Input value={family[f.key] ?? ''} onChangeText={(v) => setFamily({ ...family, [f.key]: v })} placeholder={t('שם')} />
                    </View>
                  ))}
                </Step>
              )}

              {step === 3 && (
                <Step emoji="🫶" title={t('5 החברים הכי קרובים שלך')} subtitle={t('הם יופיעו במשחק הזיכרון ויומי ישאל עליהם')}>
                  {friends.map((f, i) => (
                    <Row key={i} style={{ gap: 8, marginTop: 10 }}>
                      <Input
                        value={f.name}
                        onChangeText={(name) => setFriends(friends.map((x, j) => (j === i ? { ...x, name } : x)))}
                        placeholder={t('חבר/ה {n}', { n: i + 1 })}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <Input
                        value={f.how}
                        onChangeText={(how) => setFriends(friends.map((x, j) => (j === i ? { ...x, how } : x)))}
                        placeholder={t('מאיפה?')}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                    </Row>
                  ))}
                </Step>
              )}

              {step === 4 && (
                <Step emoji="✨" title={t('מה חשוב לך?')} subtitle={t('בחר/י כמה שרוצים, כדי שאדע במה לעזור')}>
                  <Row style={{ flexWrap: 'wrap' }}>
                    {GOALS.map((g) => (
                      <Chip key={g} label={t(g)} active={p.goals.includes(g)} onPress={() => toggleGoal(g)} />
                    ))}
                  </Row>
                  <Label text={t('מה משמח אותך? תחביבים, דברים שאת/ה אוהב/ת')} />
                  <Input value={p.hobbies ?? ''} onChangeText={(hobbies) => setP({ ...p, hobbies })} placeholder={t('למשל כדורגל, בישול, מוזיקה')} multiline />
                </Step>
              )}
            </FadeIn>

            <GradientButton
              title={step < steps - 1 ? t('הבא') : t('סיימנו! 🎉')}
              colors={gradients.primary}
              onPress={next}
              style={{ marginTop: 26 }}
            />
            {step > 0 && <GhostButton title={t('הקודם')} onPress={() => setStep(step - 1)} style={{ marginTop: 10, borderWidth: 0 }} />}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Step({ emoji, title, subtitle, children }: { emoji: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ fontSize: 54, textAlign: 'center' }}>{emoji}</Text>
      <T bold size={26} style={{ textAlign: 'center', marginTop: 10 }}>
        {title}
      </T>
      <T dim size={15} style={{ textAlign: 'center', marginTop: 6, marginBottom: 14, lineHeight: 22 }}>
        {subtitle}
      </T>
      {children}
    </View>
  );
}

function Label({ text }: { text: string }) {
  return (
    <T bold size={14} style={{ marginTop: 14, marginBottom: 6 }}>
      {text}
    </T>
  );
}

/** The payoff after the questions: confetti, and the people the app now knows, grouped by circle. */
function Celebration({ name, met, onDone }: { name: string; met: { name: string; circle: Circle }[]; onDone: () => void }) {
  const groups = CIRCLES.map((c) => ({ ...c, names: met.filter((m) => m.circle === c.key).map((m) => m.name) })).filter((g) => g.names.length);
  return (
    <LinearGradient colors={gradients.app} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 22, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center' }}>
            <PopEmoji emoji="🎉" id="party" size={84} />
            <FadeIn delay={200}>
              <T bold size={30} style={{ textAlign: 'center', marginTop: 10 }}>
                {name ? t('וואו, {name}!', { name }) : t('וואו!')}
              </T>
              <T size={18} style={{ textAlign: 'center', marginTop: 8, lineHeight: 27, color: colors.primaryHi }}>
                {met.length ? t('עכשיו אני באמת מכיר אותך — ואת {n} האנשים הכי חשובים לך', { n: met.length }) : t('עכשיו אני מכיר אותך קצת יותר. את האנשים שלך נכיר בדרך')}
              </T>
            </FadeIn>
          </View>

          {groups.map((g, gi) => (
            <FadeIn key={g.key} delay={500 + gi * 300}>
              <View style={{ marginTop: 18, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: circleColor(g.key) + '66', padding: 14 }}>
                <T bold size={16} style={{ color: circleColor(g.key), marginBottom: 10 }}>
                  {g.emoji} {t(g.label)} · {g.names.length}
                </T>
                <Row style={{ flexWrap: 'wrap', gap: 12 }}>
                  {g.names.map((n) => (
                    <View key={n} style={{ alignItems: 'center', width: 64 }}>
                      <Avatar name={n} size={48} />
                      <T size={12} numberOfLines={1} style={{ marginTop: 4, textAlign: 'center' }}>
                        {n}
                      </T>
                    </View>
                  ))}
                </Row>
              </View>
            </FadeIn>
          ))}

          <FadeIn delay={600 + groups.length * 300}>
            <View style={{ marginTop: 18, gap: 6 }}>
              <T dim size={15} style={{ textAlign: 'center' }}>
                {t('🎮 משחק הזיכרון כבר מוכן עם שאלות עליהם')}
              </T>
              <T dim size={15} style={{ textAlign: 'center' }}>
                {t('💬 ויומי ישאל עליהם כשתספר על היום')}
              </T>
            </View>
            <GradientButton title={t('יאללה, ממשיכים 🚀')} colors={gradients.primary} onPress={onDone} style={{ marginTop: 24 }} />
          </FadeIn>
        </ScrollView>
      </SafeAreaView>
      <Confetti />
    </LinearGradient>
  );
}
