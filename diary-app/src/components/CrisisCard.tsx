import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import { Row, T, tap } from './ui';

/** Israeli crisis lines, shown whenever a message suggests the person may be in danger. */
export default function CrisisCard() {
  const call = (n: string) => {
    tap('medium');
    Linking.openURL(`tel:${n}`).catch(() => {});
  };
  return (
    <View style={{ backgroundColor: '#3B0D1F', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: colors.pink }}>
      <T bold size={16}>
        💗 אתה לא לבד. יש מי שרוצה לעזור, עכשיו
      </T>
      <T size={14} style={{ marginTop: 6, lineHeight: 21 }}>
        אנשים מיומנים מחכים לשיחה שלך, בכל שעה, בלי לשפוט.
      </T>
      <Row style={{ gap: 8, marginTop: 12 }}>
        <Pressable onPress={() => call('1201')} style={{ flex: 1, backgroundColor: colors.pink, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>📞 ער"ן 1201</Text>
        </Pressable>
        <Pressable onPress={() => call('101')} style={{ flex: 1, borderColor: colors.pink, borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>🚑 חירום 101</Text>
        </Pressable>
      </Row>
      <Pressable onPress={() => Linking.openURL('https://sahar.org.il').catch(() => {})}>
        <T size={14} style={{ marginTop: 10, color: colors.primaryHi }}>
          💬 צ'אט תמיכה אנונימי: sahar.org.il
        </T>
      </Pressable>
      <T dim size={12} style={{ marginTop: 8, lineHeight: 18 }}>
        אני תוכנה ולא תחליף לאדם. אם אתה בסכנה עכשיו, התקשר או לך למישהו קרוב.
      </T>
    </View>
  );
}
