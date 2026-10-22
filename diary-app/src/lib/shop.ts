import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { t } from '../i18n';
import { ITEMS } from './pet';
import { useStore } from './store';

/**
 * The pet shop: outfit packs bought once through Google Play / the App Store (looks only).
 * The product ids below must be created in the Play Console (In-app products) with the same ids.
 */

export const PACKS = [
  { id: 'pack_summer', title: 'חבילת קיץ', emoji: '☀️', fallbackPrice: '₪9.90' },
  { id: 'pack_magic', title: 'חבילת קסם', emoji: '✨', fallbackPrice: '₪9.90' },
] as const;

export const packItems = (pack: string) => ITEMS.filter((i) => i.pack === pack);
export const shopAvailable = () => Platform.OS === 'android' || Platform.OS === 'ios';

type Iap = typeof import('expo-iap');

/** Connects to the store while the shop is on screen: prices, buying, and restoring past purchases. */
export function useShop(active: boolean) {
  const { pet, updatePet } = useStore();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iap = useRef<Iap | null>(null);

  const own = (ids: string[]) =>
    updatePet((p) => ({ ...p, packs: [...new Set([...(p.packs ?? []), ...ids.filter((id) => PACKS.some((x) => x.id === id))])] }));

  useEffect(() => {
    if (!active || !shopAvailable()) return;
    let subs: { remove: () => void }[] = [];
    let alive = true;
    (async () => {
      try {
        const m = await import('expo-iap');
        iap.current = m;
        await m.initConnection();
        subs = [
          m.purchaseUpdatedListener(async (purchase) => {
            own([purchase.productId]);
            await m.finishTransaction({ purchase, isConsumable: false }).catch(() => {});
            setBusy(null);
          }),
          m.purchaseErrorListener((e) => {
            setBusy(null);
            if (!m.isUserCancelledError(e)) setError(e.message || t('הקנייה לא הושלמה'));
          }),
        ];
        const products = (await m.fetchProducts({ skus: PACKS.map((p) => p.id), type: 'in-app' })) ?? [];
        if (alive) setPrices(Object.fromEntries(products.map((p) => [p.id, p.displayPrice])));
      } catch {
        // store not reachable (emulator without Play, or products not created yet)
      }
    })();
    return () => {
      alive = false;
      subs.forEach((s) => s.remove());
      iap.current?.endConnection().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const buy = async (pack: string) => {
    setError(null);
    if (!iap.current) {
      setError(shopAvailable() ? t('החנות לא זמינה כרגע. נסה שוב מאוחר יותר') : t('הקנייה זמינה באפליקציה בטלפון'));
      return;
    }
    setBusy(pack);
    try {
      await iap.current.requestPurchase({ request: { google: { skus: [pack] }, apple: { sku: pack } }, type: 'in-app' });
    } catch (e) {
      setBusy(null);
      if (!iap.current.isUserCancelledError(e as never)) setError((e as Error).message || t('הקנייה לא הושלמה'));
    }
  };

  const restore = async () => {
    setError(null);
    if (!iap.current) return setError(t('הקנייה זמינה באפליקציה בטלפון'));
    try {
      const list = (await iap.current.getAvailablePurchases()) ?? [];
      own(list.map((p) => p.productId));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return { owned: pet.packs ?? [], prices, busy, error, buy, restore };
}
