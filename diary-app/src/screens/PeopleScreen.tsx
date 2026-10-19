import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Empty, GhostButton, GradientButton, Input, Row, ScreenTitle, SectionTitle, T } from '../components/ui';
import { formatShortDate, relativeDay } from '../lib/dates';
import { useStore } from '../lib/store';
import { colors, gradients, MOODS } from '../lib/theme';
import type { Entry, Person } from '../lib/types';
import { MiniEntry } from './TodayScreen';

const AVATAR_COLORS = [colors.primary, colors.pink, colors.orange, colors.green, colors.blue, colors.yellow];
export const avatarColor = (name: string) => AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

export function Avatar({ name, size = 46 }: { name: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(name),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{name.slice(0, 1)}</Text>
    </View>
  );
}

type PersonStats = { person: Person; entries: Entry[]; quotes: string[]; avgMood: number };

export default function PeopleScreen({ onOpenEntry }: { onOpenEntry: (id: string) => void }) {
  const { people, entries, addPerson } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const stats = useMemo<PersonStats[]>(
    () =>
      people
        .map((person) => {
          const es = entries.filter((e) => e.people.includes(person.id));
          return {
            person,
            entries: es,
            quotes: es.flatMap((e) => e.quotes.filter((q) => q.personId === person.id).map((q) => q.text)),
            avgMood: es.length ? es.reduce((a, e) => a + e.mood, 0) / es.length : 0,
          };
        })
        .sort((a, b) => b.entries.length - a.entries.length || a.person.name.localeCompare(b.person.name)),
    [people, entries],
  );

  const insights = useMemo(() => {
    if (entries.length < 2) return null;
    const avg = entries.reduce((a, e) => a + e.mood, 0) / entries.length;
    const happiest = stats.filter((s) => s.entries.length >= 2).sort((a, b) => b.avgMood - a.avgMood)[0];
    const top = stats[0]?.entries.length ? stats[0] : null;
    const totalQuotes = stats.reduce((a, s) => a + s.quotes.length, 0);
    const hours = entries.map((e) => new Date(e.createdAt).getHours());
    const avgHour = Math.round(hours.reduce((a, h) => a + h, 0) / hours.length);
    return { avg, happiest, top, totalQuotes, avgHour };
  }, [entries, stats]);

  const open = stats.find((s) => s.person.id === openId);

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <ScreenTitle title="👥 האנשים שלי" subtitle="כל מי שהזכרת — ומה הם אמרו לך" />

      {insights && (
        <Card style={{ borderColor: colors.primary }}>
          <T bold size={17} style={{ marginBottom: 8 }}>
            🧠 מה אני כבר יודע עליך
          </T>
          {insights.top && <Insight text={`הכי הרבה אתה מזכיר את ${insights.top.person.name} (${insights.top.entries.length} פעמים)`} />}
          {insights.happiest && <Insight text={`בימים עם ${insights.happiest.person.name} מצב הרוח שלך הכי טוב ${MOODS[Math.round(insights.happiest.avgMood) - 1]}`} />}
          <Insight text={`מצב הרוח הממוצע שלך: ${MOODS[Math.round(insights.avg) - 1]}`} />
          <Insight text={`בדרך כלל אתה מתעד בסביבות ${String(insights.avgHour).padStart(2, '0')}:00`} />
          {insights.totalQuotes > 0 && <Insight text={`שמרתי ${insights.totalQuotes} משפטים שאנשים אמרו לך`} />}
        </Card>
      )}

      <Row style={{ gap: 8, alignItems: 'center', marginTop: 14 }}>
        <Input value={newName} onChangeText={setNewName} placeholder="הוסף אדם חדש…" style={{ flex: 1, minWidth: 0 }} />
        <GradientButton
          small
          title="הוסף"
          colors={gradients.calm}
          onPress={() => {
            if (newName.trim()) addPerson(newName);
            setNewName('');
          }}
        />
      </Row>

      {stats.length === 0 ? (
        <Empty emoji="🫂" title="עוד אין אנשים" text="כשתספר על היום שלך ותזכיר שמות — הם יופיעו כאן עם כל ההיסטוריה שלהם." />
      ) : (
        <>
          <SectionTitle>{stats.length} אנשים</SectionTitle>
          {stats.map((s) => (
            <Pressable key={s.person.id} onPress={() => setOpenId(s.person.id)} style={{ marginBottom: 10 }}>
              <Card style={{ padding: 12 }}>
                <Row style={{ alignItems: 'center', gap: 12 }}>
                  <Avatar name={s.person.name} />
                  <View style={{ flex: 1 }}>
                    <T bold size={17}>
                      {s.person.name}
                    </T>
                    <T dim size={13}>
                      {s.entries.length ? `${s.entries.length} אזכורים · לאחרונה ${relativeDay(s.entries[0].createdAt)}` : 'עוד לא הוזכר ביומן'}
                    </T>
                    {s.quotes[0] && (
                      <T size={13} numberOfLines={1} style={{ color: colors.pink, marginTop: 2 }}>
                        💬 "{s.quotes[0]}"
                      </T>
                    )}
                  </View>
                  <T dim size={20}>
                    ‹
                  </T>
                </Row>
              </Card>
            </Pressable>
          ))}
        </>
      )}

      {open && <PersonModal stats={open} onClose={() => setOpenId(null)} onOpenEntry={onOpenEntry} />}
    </ScrollView>
  );
}

function Insight({ text }: { text: string }) {
  return (
    <T dim size={14} style={{ marginBottom: 4, lineHeight: 20 }}>
      • {text}
    </T>
  );
}

function PersonModal({ stats, onClose, onOpenEntry }: { stats: PersonStats; onClose: () => void; onOpenEntry: (id: string) => void }) {
  const { updatePerson, deletePerson } = useStore();
  const { person, entries, quotes } = stats;
  const [name, setName] = useState(person.name);
  const [note, setNote] = useState(person.note ?? '');

  const save = () => {
    if (name.trim()) updatePerson({ ...person, name: name.trim(), note: note.trim() || undefined });
    onClose();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={save}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={save} hitSlop={12}>
            <T bold style={{ color: colors.primaryHi }}>סגור ✕</T>
          </Pressable>
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <Avatar name={person.name} size={84} />
            <T bold size={26} style={{ textAlign: 'center', marginTop: 10 }}>
              {person.name}
            </T>
            <T dim style={{ textAlign: 'center' }}>
              מכיר מאז {formatShortDate(person.firstSeen)} · {entries.length} אזכורים
            </T>
          </View>

          <SectionTitle>📝 פרטים</SectionTitle>
          <Input value={name} onChangeText={setName} placeholder="שם" />
          <Input value={note} onChangeText={setNote} placeholder="מי זה? (חבר מהעבודה, בן דוד…)" style={{ marginTop: 8 }} multiline />

          {quotes.length > 0 && (
            <>
              <SectionTitle>💬 מה {person.name} אמר/ה לך</SectionTitle>
              {quotes.map((q, i) => (
                <Card key={i} style={{ marginBottom: 8, padding: 12 }}>
                  <T>"{q}"</T>
                </Card>
              ))}
            </>
          )}

          {entries.length > 0 && (
            <>
              <SectionTitle>📅 ציר זמן</SectionTitle>
              {entries.map((e) => (
                <View key={e.id}>
                  <T dim size={13} style={{ marginBottom: 4 }}>
                    {formatShortDate(e.createdAt)}
                  </T>
                  <MiniEntry
                    entry={e}
                    onPress={() => {
                      onClose();
                      onOpenEntry(e.id);
                    }}
                  />
                </View>
              ))}
            </>
          )}

          <GhostButton
            title="🗑️ מחק את האדם"
            color={colors.red}
            style={{ marginTop: 20, borderColor: colors.red }}
            onPress={() =>
              Alert.alert(`למחוק את ${person.name}?`, 'השם יוסר מכל הרשומות.', [
                { text: 'ביטול', style: 'cancel' },
                {
                  text: 'מחק',
                  style: 'destructive',
                  onPress: () => {
                    deletePerson(person.id);
                    onClose();
                  },
                },
              ])
            }
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
