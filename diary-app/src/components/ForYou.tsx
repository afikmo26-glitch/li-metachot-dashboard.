import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { t } from '../i18n';
import { circleEmoji } from '../lib/circles';
import { formatShortDate } from '../lib/dates';
import { dueFollowUps, followUpQuestion } from '../lib/followups';
import { onThisDay, reachOut, upcomingBirthdays, weekKey, wellbeingInsights } from '../lib/insights';
import { personName, useStore } from '../lib/store';
import { colors, layout, MOODS } from '../lib/theme';
import { Card, Chip, Row, SectionTitle, T, notify } from './ui';

/**
 * "For you today": the things a good friend would remember. Follow-ups on what people told you,
 * birthdays, people you haven't talked about in a while, this day in the past, goals to check on.
 */
export default function ForYou({ onOpenEntry, onOpenGoals, onOpenPhotos }: { onOpenEntry: (id: string) => void; onOpenGoals: () => void; onOpenPhotos: () => void }) {
  const { entries, people, followUps, saveFollowUp, goals, saveGoal } = useStore();
  const due = useMemo(() => dueFollowUps(followUps).slice(0, 3), [followUps]);
  const birthdays = useMemo(() => upcomingBirthdays(people, 10), [people]);
  const quiet = useMemo(() => reachOut(people, entries), [people, entries]);
  const past = useMemo(() => onThisDay(entries), [entries]);
  const insights = useMemo(() => wellbeingInsights(entries), [entries]);
  const photos = entries.filter((e) => e.photoUri).length;
  const wk = weekKey();
  const goalToCheck = goals.find((g) => !g.done && !g.checkins.some((c) => weekKey(new Date(c.at)) === wk));

  const rows: React.ReactNode[] = [];

  for (const f of due) {
    const name = personName(people, f.personId);
    rows.push(
      <Item key={f.id} emoji="💬" title={followUpQuestion(f, name)} sub={t('{name} סיפר/ה: "{text}"', { name, text: f.text.slice(0, 60) })}>
        <Chip label={t('✓ שאלתי')} onPress={() => saveFollowUp({ ...f, done: true })} />
        <Chip label={t('אחר כך')} onPress={() => saveFollowUp({ ...f, due: new Date(Date.now() + 2 * 86400000).toISOString() })} />
      </Item>,
    );
  }
  for (const b of birthdays) {
    const gifts = b.person.gifts?.length ? t('רעיונות למתנה: {list}', { list: b.person.gifts.join(', ') }) : b.person.likes ? t('אוהב/ת: {likes}', { likes: b.person.likes }) : '';
    rows.push(
      <Item
        key={`b-${b.person.id}`}
        emoji="🎂"
        title={b.days === 0 ? t('היום יום ההולדת של {name}! 🎉', { name: b.person.name }) : t('ל{name} יום הולדת בעוד {n} ימים', { name: b.person.name, n: b.days })}
        sub={gifts}
      />,
    );
  }
  for (const q of quiet) {
    rows.push(
      <Item
        key={`q-${q.person.id}`}
        emoji={circleEmoji(q.person)}
        title={t('לא סיפרת על {name} כבר {n} ימים', { name: q.person.name, n: q.days })}
        sub={t('אולי שווה להתקשר או לשלוח הודעה 💌')}
      />,
    );
  }
  if (goalToCheck) {
    rows.push(
      <Item key={`g-${goalToCheck.id}`} emoji="🎯" title={t('איך מתקדם "{goal}"?', { goal: goalToCheck.title })} sub={t('בדיקה שבועית')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Chip
            key={n}
            label={['😣', '😕', '😐', '🙂', '🚀'][n - 1]}
            onPress={() => {
              saveGoal({ ...goalToCheck, checkins: [...goalToCheck.checkins, { at: new Date().toISOString(), progress: n }] });
              notify('success');
            }}
          />
        ))}
      </Item>,
    );
  }

  return (
    <>
      {rows.length > 0 && (
        <>
          <SectionTitle>{t('💡 בשבילך היום')}</SectionTitle>
          <Card style={{ paddingVertical: 6 }}>{rows}</Card>
        </>
      )}

      {past && (
        <Pressable onPress={() => onOpenEntry(past.entry.id)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <SectionTitle>🕰️ {past.label}</SectionTitle>
          <Card style={{ borderColor: colors.primary }}>
            <T dim size={13}>
              {formatShortDate(past.entry.createdAt)} · {MOODS[past.entry.mood - 1]}
            </T>
            <T style={{ marginTop: 6, lineHeight: 22 }} numberOfLines={4}>
              {past.entry.text || t('🎙️ הקלטה קולית')}
            </T>
            {past.entry.people.length > 0 && (
              <T dim size={13} style={{ marginTop: 6 }}>
                {past.entry.people.map((p) => `${circleEmoji(people.find((x) => x.id === p))} ${personName(people, p)}`).join('  ')}
              </T>
            )}
          </Card>
        </Pressable>
      )}

      {insights.length > 0 && (
        <Card style={{ marginTop: 14 }}>
          <T bold style={{ marginBottom: 6 }}>
            {t('🧠 מה גיליתי עליך')}
          </T>
          {insights.map((s) => (
            <T key={s} dim size={14} style={{ marginBottom: 4, lineHeight: 20 }}>
              {s}
            </T>
          ))}
        </Card>
      )}

      <Row style={{ gap: 10, marginTop: 14 }}>
        <Shortcut emoji="🎯" label={goals.filter((g) => !g.done).length ? t('המטרות שלי ({n})', { n: goals.filter((g) => !g.done).length }) : t('הוסף מטרה')} onPress={onOpenGoals} />
        <Shortcut emoji="📸" label={photos ? t('התמונות שלי ({n})', { n: photos }) : t('התמונות שלי')} onPress={onOpenPhotos} />
      </Row>
    </>
  );
}

function Item({ emoji, title, sub, children }: { emoji: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <T bold size={15}>
            {title}
          </T>
          {sub ? (
            <T dim size={13} style={{ marginTop: 2 }} numberOfLines={2}>
              {sub}
            </T>
          ) : null}
          {children ? <Row style={{ flexWrap: 'wrap', marginTop: 8 }}>{children}</Row> : null}
        </View>
      </Row>
    </View>
  );
}

function Shortcut({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ alignItems: 'center', paddingVertical: 14 }}>
        <Text style={{ fontSize: 26 }}>{emoji}</Text>
        <T bold size={13} style={{ textAlign: 'center', marginTop: 4 }}>
          {label}
        </T>
        <T dim size={12}>{layout.isRTL ? '‹' : '›'}</T>
      </Card>
    </Pressable>
  );
}
