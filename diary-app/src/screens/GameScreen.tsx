import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import { Card, GhostButton, GradientButton, notify, Row, T, tap } from '../components/ui';
import { achievements } from '../lib/achievements';
import { buildQuestions, demoData, levelInfo, Question, QUESTION_SECONDS, ROUND_SIZE } from '../lib/game';
import { useStore } from '../lib/store';
import { colors, gradients } from '../lib/theme';

type Phase = 'menu' | 'playing' | 'result';
type Result = { score: number; correct: number; total: number; bestCombo: number; xp: number; demo: boolean; newBest: boolean };

const MAX_LIVES = 3;

export default function GameScreen() {
  const { entries, people, game, updateGame } = useStore();
  const [phase, setPhase] = useState<Phase>('menu');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [demo, setDemo] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const available = useMemo(() => buildQuestions(entries, people).length, [entries, people]);
  const lvl = levelInfo(game.xp);

  const start = (useDemo: boolean) => {
    const src = useDemo ? demoData() : { entries, people };
    const qs = buildQuestions(src.entries, src.people);
    if (!qs.length) return;
    setDemo(useDemo);
    setQuestions(qs);
    setPhase('playing');
  };

  const finish = (r: Omit<Result, 'xp' | 'newBest' | 'demo'>) => {
    const xp = demo ? 0 : Math.round(r.score / 10);
    const newBest = !demo && r.score > game.bestScore;
    if (!demo) {
      updateGame({
        xp: game.xp + xp,
        bestScore: Math.max(game.bestScore, r.score),
        bestCombo: Math.max(game.bestCombo, r.bestCombo),
        gamesPlayed: game.gamesPlayed + 1,
        totalCorrect: game.totalCorrect + r.correct,
        totalAnswered: game.totalAnswered + r.total,
      });
    }
    setResult({ ...r, xp, demo, newBest });
    setPhase('result');
  };

  if (phase === 'playing') return <Round questions={questions} onDone={finish} onQuit={() => setPhase('menu')} />;

  if (phase === 'result' && result) {
    const acc = result.total ? result.correct / result.total : 0;
    const stars = acc >= 0.9 ? 3 : acc >= 0.6 ? 2 : acc > 0 ? 1 : 0;
    return (
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, alignItems: 'stretch' }}>
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <Text style={{ fontSize: 72 }}>{stars === 3 ? '🏆' : stars === 2 ? '🎉' : stars === 1 ? '👍' : '💪'}</Text>
          <T bold size={30} style={{ textAlign: 'center', marginTop: 8 }}>
            {stars === 3 ? 'זיכרון מושלם!' : stars === 2 ? 'כל הכבוד!' : stars === 1 ? 'לא רע!' : 'פעם הבאה!'}
          </T>
          <Text style={{ fontSize: 44, marginTop: 10, letterSpacing: 6, color: colors.yellow }}>
            {'⭐'.repeat(stars)}
            {'☆'.repeat(3 - stars)}
          </Text>
          {result.newBest && (
            <LinearGradient colors={gradients.game} style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6, marginTop: 12 }}>
              <T bold style={{ color: '#fff', textAlign: 'center' }}>🔥 שיא חדש!</T>
            </LinearGradient>
          )}
        </View>
        <Row style={{ gap: 10, marginTop: 24 }}>
          <BigStat label="ניקוד" value={result.score} />
          <BigStat label="נכונות" value={`${result.correct}/${result.total}`} />
          <BigStat label="קומבו" value={`x${result.bestCombo}`} />
        </Row>
        {result.demo ? (
          <T dim style={{ textAlign: 'center', marginTop: 16 }}>
            זה היה משחק דמו 🙂 תקליט כמה ימים עם שמות והמשחק יהיה על החיים שלך!
          </T>
        ) : (
          <T bold size={18} style={{ textAlign: 'center', marginTop: 16, color: colors.yellow }}>
            +{result.xp} XP
          </T>
        )}
        <GradientButton title="שחק שוב" icon="🔄" colors={gradients.game} onPress={() => start(result.demo)} style={{ marginTop: 24 }} />
        <GhostButton title="חזרה לתפריט" onPress={() => setPhase('menu')} style={{ marginTop: 10 }} />
      </ScrollView>
    );
  }

  const accuracy = game.totalAnswered ? Math.round((game.totalCorrect / game.totalAnswered) * 100) : 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
      <LinearGradient colors={gradients.game} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ borderRadius: 28, padding: 22 }}>
        <Text style={{ fontSize: 54, textAlign: 'center' }}>🧠🎮</Text>
        <T bold size={30} style={{ color: '#fff', textAlign: 'center', marginTop: 6 }}>
          משחק הזיכרון
        </T>
        <T size={15} style={{ color: '#fff', textAlign: 'center', opacity: 0.9, marginTop: 4 }}>
          כמה טוב אתה זוכר את האנשים בחיים שלך ומה הם אמרו לך?
        </T>
        <View style={{ marginTop: 18, backgroundColor: '#0003', borderRadius: 18, padding: 14 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <T bold style={{ color: '#fff' }}>
              רמה {lvl.level} · {lvl.title}
            </T>
            <T size={13} style={{ color: '#fff' }}>
              {game.xp} XP
            </T>
          </Row>
          <View style={{ height: 10, backgroundColor: '#0004', borderRadius: 5, marginTop: 8, overflow: 'hidden', transform: [{ scaleX: -1 }] }}>
            <View style={{ width: `${lvl.progress * 100}%`, height: '100%', backgroundColor: colors.yellow, borderRadius: 5 }} />
          </View>
          <T size={12} style={{ color: '#fff', opacity: 0.85, marginTop: 6 }}>
            עוד {lvl.toNext} XP לרמה הבאה
          </T>
        </View>
      </LinearGradient>

      <Row style={{ gap: 10, marginTop: 14 }}>
        <BigStat label="שיא" value={game.bestScore} />
        <BigStat label="קומבו שיא" value={`x${game.bestCombo}`} />
        <BigStat label="דיוק" value={`${accuracy}%`} />
      </Row>

      {available >= 3 ? (
        <GradientButton
          title={`שחק! (${Math.min(available, ROUND_SIZE)} שאלות)`}
          icon="▶️"
          colors={gradients.primary}
          onPress={() => start(false)}
          style={{ marginTop: 18 }}
        />
      ) : (
        <Card style={{ marginTop: 18 }}>
          <T bold>🔒 המשחק נפתח אחרי שיהיו לך כמה רשומות עם שמות</T>
          <T dim size={14} style={{ marginTop: 6, lineHeight: 20 }}>
            ספר על היום שלך והזכר אנשים ("דנה אמרה לי ש…"). כל שם ומשפט הופכים לשאלה במשחק.
          </T>
        </Card>
      )}
      <GhostButton title="🎲 נסה משחק דמו" onPress={() => start(true)} style={{ marginTop: 10 }} />

      <Badges />

      <Card style={{ marginTop: 18 }}>
        <T bold style={{ marginBottom: 8 }}>
          איך משחקים?
        </T>
        <T dim size={14} style={{ lineHeight: 22 }}>
          💬 מי אמר את המשפט?{'\n'}🧩 השלם את השם החסר מהיומן{'\n'}📅 את מי פגשת באותו יום?{'\n'}⏳ מתי הזכרת מישהו לאחרונה?{'\n\n'}
          ❤️ יש לך 3 חיים · ⚡ ענה מהר לבונוס · 🔥 תשובות ברצף מכפילות ניקוד
        </T>
      </Card>
    </ScrollView>
  );
}

function Badges() {
  const { entries, people, game } = useStore();
  const list = achievements(entries, people, game);
  const earned = list.filter((a) => a.done).length;
  return (
    <Card style={{ marginTop: 18 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <T bold>🏆 הישגים</T>
        <T dim size={13}>
          {earned}/{list.length}
        </T>
      </Row>
      <Row style={{ flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
        {list.map((a) => (
          <View key={a.id} style={{ width: '23%', alignItems: 'center', opacity: a.done ? 1 : 0.45 }}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: a.done ? colors.cardHi : colors.bgDeep,
                borderWidth: 2,
                borderColor: a.done ? colors.yellow : colors.border,
              }}
            >
              <Text style={{ fontSize: 24 }}>{a.done ? a.emoji : '🔒'}</Text>
            </View>
            <T bold size={11} style={{ textAlign: 'center', marginTop: 4 }} numberOfLines={2}>
              {a.title}
            </T>
            {!a.done && (
              <T dim size={10} style={{ textAlign: 'center' }} numberOfLines={2}>
                {a.hint}
              </T>
            )}
          </View>
        ))}
      </Row>
    </Card>
  );
}

function BigStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}>
      <T bold size={22} style={{ textAlign: 'center' }}>
        {value}
      </T>
      <T dim size={12} style={{ textAlign: 'center' }}>
        {label}
      </T>
    </Card>
  );
}

function Round({
  questions,
  onDone,
  onQuit,
}: {
  questions: Question[];
  onDone: (r: { score: number; correct: number; total: number; bestCombo: number }) => void;
  onQuit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [floater, setFloater] = useState<string | null>(null);

  const timer = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const startedAt = useRef(Date.now());
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const q = questions[index];

  useEffect(() => {
    startedAt.current = Date.now();
    timer.setValue(1);
    Animated.timing(timer, { toValue: 0, duration: QUESTION_SECONDS * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    timeout.current = setTimeout(() => answer(null), QUESTION_SECONDS * 1000);
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
      timer.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const answer = (option: string | null) => {
    if (picked !== null) return;
    if (timeout.current) clearTimeout(timeout.current);
    timer.stopAnimation();
    const ok = option === q.answer;
    setPicked(option ?? '__timeout__');

    let nextLives = lives;
    let nextScore = score;
    let nextCorrect = correct;
    let nextBest = bestCombo;
    if (ok) {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const speedBonus = Math.max(0, Math.round((QUESTION_SECONDS - elapsed) * 10));
      const newCombo = combo + 1;
      const multiplier = Math.min(4, 1 + Math.floor(newCombo / 3));
      const points = (100 + speedBonus) * multiplier;
      nextScore += points;
      nextCorrect += 1;
      nextBest = Math.max(bestCombo, newCombo);
      setCombo(newCombo);
      setFloater(`+${points}${multiplier > 1 ? ` (x${multiplier})` : ''}`);
      notify('success');
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    } else {
      nextLives -= 1;
      setCombo(0);
      setFloater(option === null ? '⏰ נגמר הזמן' : '💥');
      notify('error');
      pop.setValue(1);
      Animated.sequence(
        [10, -10, 8, -8, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: true })),
      ).start();
    }
    setScore(nextScore);
    setLives(nextLives);
    setCorrect(nextCorrect);
    setBestCombo(nextBest);

    setTimeout(() => {
      const answered = index + 1;
      if (nextLives <= 0 || answered >= questions.length) {
        onDone({ score: nextScore, correct: nextCorrect, total: answered, bestCombo: nextBest });
        return;
      }
      setPicked(null);
      setFloater(null);
      setIndex(answered);
    }, 1300);
  };

  const timerColor = timer.interpolate({ inputRange: [0, 0.3, 1], outputRange: [colors.red, colors.orange, colors.green] });
  const timerWidth = timer.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={onQuit} hitSlop={12}>
          <T dim>✕ יציאה</T>
        </Pressable>
        <Text style={{ fontSize: 22 }}>
          {'❤️'.repeat(lives)}
          {'🖤'.repeat(MAX_LIVES - lives)}
        </Text>
      </Row>

      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <T bold size={16}>
          שאלה {index + 1}/{questions.length}
        </T>
        <T bold size={22} style={{ color: colors.yellow }}>
          ⭐ {score}
        </T>
      </Row>
      {combo >= 2 && (
        <T bold size={15} style={{ color: colors.orange, marginTop: 4 }}>
          🔥 קומבו x{combo}
        </T>
      )}

      <View style={{ height: 10, backgroundColor: colors.bgDeep, borderRadius: 5, marginTop: 10, overflow: 'hidden', transform: [{ scaleX: -1 }] }}>
        <Animated.View style={{ width: timerWidth, height: '100%', backgroundColor: timerColor, borderRadius: 5 }} />
      </View>

      <Animated.View style={{ transform: [{ translateX: shake }] }}>
        <Card style={{ marginTop: 18, paddingVertical: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 46 }}>{q.emoji}</Text>
          <T bold size={21} style={{ textAlign: 'center', marginTop: 8 }}>
            {q.prompt}
          </T>
          {q.context ? (
            <T size={16} style={{ textAlign: 'center', marginTop: 12, lineHeight: 25, color: colors.textDim }}>
              {q.context}
            </T>
          ) : null}
        </Card>
      </Animated.View>

      <View style={{ marginTop: 16, gap: 10 }}>
        {q.options.map((opt) => {
          const isAnswer = opt === q.answer;
          const isPicked = opt === picked;
          const revealed = picked !== null;
          const bg = revealed ? (isAnswer ? colors.green : isPicked ? colors.red : colors.card) : colors.cardHi;
          return (
            <Pressable
              key={opt}
              disabled={revealed}
              onPress={() => {
                tap('medium');
                answer(opt);
              }}
              style={({ pressed }) => ({
                backgroundColor: bg,
                borderRadius: 18,
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderWidth: 1.5,
                borderColor: revealed && isAnswer ? colors.green : colors.border,
                opacity: revealed && !isAnswer && !isPicked ? 0.5 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <T bold size={18} style={{ textAlign: 'center' }}>
                {revealed && isAnswer ? '✅ ' : revealed && isPicked ? '❌ ' : ''}
                {opt}
              </T>
            </Pressable>
          );
        })}
      </View>

      {floater && (
        <Animated.View
          pointerEvents="none"
          style={{
            alignItems: 'center',
            marginTop: 18,
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
          }}
        >
          <T bold size={26} style={{ textAlign: 'center', color: picked === q.answer ? colors.yellow : colors.red }}>
            {picked === q.answer ? '🎉 ' : ''}
            {floater}
          </T>
        </Animated.View>
      )}
    </ScrollView>
  );
}
