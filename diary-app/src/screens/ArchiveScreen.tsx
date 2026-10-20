import React, { useMemo, useState } from 'react';
import { ScrollView, SectionList, View } from 'react-native';
import { Chip, Empty, Input, Row, ScreenTitle, T } from '../components/ui';
import { dayKey, formatLongDate } from '../lib/dates';
import { personName, useStore } from '../lib/store';
import { colors, layout, MOODS } from '../lib/theme';
import { MiniEntry } from './TodayScreen';
import { t } from '../i18n';

export default function ArchiveScreen({ onOpenEntry }: { onOpenEntry: (id: string) => void }) {
  const { entries, people } = useStore();
  const [query, setQuery] = useState('');
  const [personFilter, setPersonFilter] = useState<string | null>(null);

  const mentioned = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((e) => e.people.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [entries]);

  const sections = useMemo(() => {
    const q = query.trim();
    const filtered = entries.filter((e) => {
      if (personFilter && !e.people.includes(personFilter)) return false;
      if (!q) return true;
      return (
        e.text.includes(q) ||
        e.people.some((p) => personName(people, p).includes(q)) ||
        e.quotes.some((x) => x.text.includes(q))
      );
    });
    const groups = new Map<string, typeof filtered>();
    filtered.forEach((e) => {
      const k = dayKey(e.createdAt);
      groups.set(k, [...(groups.get(k) ?? []), e]);
    });
    return [...groups.entries()].map(([key, data]) => ({ key, title: formatLongDate(data[0].createdAt), data }));
  }, [entries, people, query, personFilter]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 18, paddingBottom: 6 }}>
        <ScreenTitle title={t('📚 הארכיון שלי')} subtitle={t('{n} רשומות · כל יום עם תאריך ושעה מדויקים', { n: entries.length })} />
        <Input value={query} onChangeText={setQuery} placeholder={t('🔍 חפש מילה, שם או משפט…')} />
        {mentioned.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, transform: [{ scaleX: layout.flip }] }}>
            <View style={{ flexDirection: 'row', transform: [{ scaleX: layout.flip }] }}>
              <Chip label={t('כולם')} active={!personFilter} onPress={() => setPersonFilter(null)} />
              {mentioned.map((id) => (
                <Chip key={id} label={personName(people, id)} active={personFilter === id} onPress={() => setPersonFilter(personFilter === id ? null : id)} />
              ))}
            </View>
          </ScrollView>
        )}
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 8 }}>
            <T bold size={16} style={{ color: colors.primaryHi }}>
              📅 {section.title}
            </T>
            <T size={18}>{section.data.map((e) => MOODS[e.mood - 1]).join('')}</T>
          </Row>
        )}
        renderItem={({ item }) => <MiniEntry entry={item} onPress={() => onOpenEntry(item.id)} />}
        ListEmptyComponent={
          entries.length === 0 ? (
            <Empty emoji="📭" title={t('הארכיון עוד ריק')} text={t('הקלט את היום הראשון שלך במסך \'היום\' — כל רשומה נשמרת כאן עם התאריך והשעה המדויקים.')} />
          ) : (
            <Empty emoji="🔎" title={t('לא נמצא כלום')} text={t('נסה מילה אחרת')} />
          )
        }
      />
    </View>
  );
}
