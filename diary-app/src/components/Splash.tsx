import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { t } from '../i18n';
import { DEFAULT_PET, PetState } from '../lib/pet';
import { play } from '../lib/sound';
import { gradients } from '../lib/theme';
import { Aurora, GlowRing, NeonText, RiseIn } from './neon';
import Pet from './pet/Pet';
import { T } from './ui';

const MIN_MS = 2300;

/**
 * The opening: the pet in a glowing ring, the name rising in and shimmering, a short chime.
 * It covers the app while it loads (at least MIN_MS), then fades away and calls onDone.
 */
export default function Splash({ ready, pet, onDone }: { ready: boolean; pet?: PetState; onDone: () => void }) {
  const reduced = useReducedMotion();
  const [minPassed, setMinPassed] = useState(false);
  const fade = useSharedValue(1);
  const bar = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    play('intro', 0.55);
    const id = setTimeout(() => setMinPassed(true), reduced ? 600 : MIN_MS);
    bar.value = withTiming(1, { duration: reduced ? 500 : MIN_MS - 200, easing: Easing.bezier(0.6, 0, 0.2, 1) });
    if (!reduced) bob.value = withRepeat(withSequence(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.sin) })), -1);
    return () => clearTimeout(id);
  }, [reduced, bar, bob]);

  useEffect(() => {
    if (ready && minPassed) fade.value = withDelay(100, withTiming(0, { duration: 450 }, (done) => done && runOnJS(onDone)()));
  }, [ready, minPassed, fade, onDone]);

  const root = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ scale: 1 + (1 - fade.value) * 0.08 }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * 8 }] }));
  const shown = pet?.hatched ? pet : { ...DEFAULT_PET, hatched: true, species: 'cat' as const };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#06051A', alignItems: 'center', zIndex: 50 }, root]}>
      <Aurora />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
        <RiseIn delay={0}>
          <GlowRing size={180}>
            <Animated.View style={bobStyle}>
              <Pet pet={shown} stage="kid" size={150} interactive={false} />
            </Animated.View>
          </GlowRing>
        </RiseIn>
        <View style={{ flexDirection: 'row-reverse', gap: 12, marginTop: 44 }}>
          <RiseIn delay={250}>
            <NeonText size={46}>{t('היומן')}</NeonText>
          </RiseIn>
          <RiseIn delay={480}>
            <NeonText size={46}>{t('שלי')}</NeonText>
          </RiseIn>
        </View>
        <RiseIn delay={900}>
          <T size={17} style={{ color: '#C4B5FD', marginTop: 10, textAlign: 'center' }}>
            {pet?.hatched && pet.name ? `${pet.name} ${t('פה בשבילך')} 💜` : t('יומי שלי, פה בשבילך')}
          </T>
        </RiseIn>
      </View>
      <View style={{ position: 'absolute', bottom: 90, width: 160, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
        <Animated.View style={[{ height: 4, borderRadius: 2, overflow: 'hidden' }, barStyle]}>
          <LinearGradient colors={gradients.neon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}
