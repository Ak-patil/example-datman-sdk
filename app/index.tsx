import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert, FlatList,
  Pressable,
  SafeAreaView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import init from 'react-native-datman-checkout-sdk';

const WS5_BASE = 'https://ws5-payments.datmanpay.com';
const CREATE_SESSION_API_KEY = 'dat_h33h3jjnh424hj233h24h2j2hhn';
const MERCHANT_ID = 1234569;
const PROVIDER = 'FH';
const CURRENCY = 'GBP';

type Item = { id: string; name: string; price: number; emoji: string };
const MENU: Item[] = [
  { id: 'm1', name: 'Margherita Pizza', price: 8.99, emoji: '🍕' },
  { id: 'm2', name: 'Veggie Burger',    price: 7.49, emoji: '🍔' },
  { id: 'm3', name: 'Pasta Alfredo',    price: 9.5,  emoji: '🍝' },
  { id: 'm4', name: 'Chicken Wrap',     price: 6.75, emoji: '🌯' },
  { id: 'm5', name: 'Sushi Box',        price: 12.0, emoji: '🍱' },
  { id: 'm6', name: 'Salad Bowl',       price: 6.2,  emoji: '🥗' },
];

const DEMO = {
  id: '4891715',
  email: 'john@example.com',
  phone: '07123456789',
  name: "O'Keefe - Mosciski",
  firstName: 'Glennie',
  lastName: 'Labadie',
  house: '7',
  postcode: '53634636',
  flat: '70',
  address1: 'Dinoshire',
  address2: 'Garden Street',
};

const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: CURRENCY }).format(n);

export default function App() {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState('—');

  const cart = useMemo(() => MENU.filter(x => selected[x.id]), [selected]);
  const total = useMemo(() => cart.reduce((s, i) => s + i.price, 0), [cart]);

  const toggle = (id: string) => setSelected(prev => ({ ...prev, [id]: !prev[id] }));

  async function onCheckout() {
    try {
      if (cart.length === 0) return Alert.alert('Cart empty', 'Pick something tasty first 😋');
      setBusy(true);

      // 1) Create session
      const { sessionId } = await createSession(total);

      // 2) Configure SDK with this session
      await init.configure(sessionId);

      // 3) Open the native sheet which will use that session
      const res = await init.open();

      setLastResult(JSON.stringify(res, null, 2));
      if (res.status === 'success') {
        Alert.alert('Payment successful', 'Thanks for your order! 🎉');
        setSelected({});
      } else if (res.status === 'failed') {
        Alert.alert('Payment failed', res.message || 'Please try again');
      }else if (res.status === 'cancelled') {
        Alert.alert('Payment cancelled', res.message || 'Please try again');
      }
    } catch (e: any) {
      Alert.alert('Checkout error', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={S.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={S.header}>
        <Text style={S.brand}>Foodhub</Text>
        <Text style={S.sub}>Crave it. Tap it. Done.</Text>
      </View>

      <FlatList
        contentContainerStyle={S.grid}
        data={MENU}
        numColumns={2}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => {
          const on = !!selected[item.id];
          return (
            <Pressable onPress={() => toggle(item.id)} style={[S.card, on && S.cardOn]}>
              <Text style={S.emoji}>{item.emoji}</Text>
              <Text style={S.name}>{item.name}</Text>
              <Text style={S.price}>{formatMoney(item.price)}</Text>
              <View style={[S.tick, on ? S.tickOn : S.tickOff]}>
                <Text style={S.tickText}>{on ? '✓' : ''}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={S.checkout}>
        <View><Text style={S.totalL}>Total</Text><Text style={S.totalV}>{formatMoney(total)}</Text></View>
        <Pressable disabled={busy || total === 0} onPress={onCheckout} style={[S.cta, (busy||total===0)&&S.ctaDis]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={S.ctaText}>Checkout</Text>}
        </Pressable>
      </View>

      <View style={S.result}>
        <Text style={S.resultT}>Last result</Text>
        <Text style={S.resultV} selectable>{lastResult}</Text>
      </View>
    </SafeAreaView>
  );
}

async function createSession(totalMajor: number): Promise<{ sessionId: string; expiresAt?: number }> {
  const orderId = String(Date.now());
  const payload = {
    host: 'example.com',
    merchant_id: MERCHANT_ID,
    order_id: orderId,
    customer_id: DEMO.id,
    provider: PROVIDER,
    email: DEMO.email,
    phoneNumber: DEMO.phone,
    name: DEMO.name,
    Amount: totalMajor.toFixed(2), // "12.34"
    AvsHouseNumber: DEMO.house,
    AvsPostcode: DEMO.postcode,
    MerchantReference: `Ref-${orderId}`,
    RedirectUrl: 'https://www.google.com',
    CancelUrl: 'https://www.google.com?cancel=true',
    WebhookUrl: 'https://webhook.site/your-id',
    backurl: 'https://www.google.com?back=true',
    sending: 'to',
    firstname: DEMO.firstName,
    lastname: DEMO.lastName,
    flat: DEMO.flat,
    address1: DEMO.address1,
    address2: DEMO.address2,
    last4Digits: '0821',
  };

  const res = await fetch(`${WS5_BASE}/create-session`, {
    method: 'POST',
    headers: { 'api_key': CREATE_SESSION_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`create-session ${res.status}: ${text}`);

  let json: any = {};
  try { json = JSON.parse(text); } catch { /* server might return string */ }

  const sessionId: string =
    json?.sessionId || json?.session_id || json?.data?.session_id || (typeof json === 'string' ? json : '');

  const expiresAt: number | undefined = json?.expiresAt ?? json?.data?.expiresAt;
  if (!sessionId) throw new Error('No sessionId in response');

  return { sessionId, expiresAt };
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  brand: { fontSize: 28, fontWeight: '800', letterSpacing: 0.5, color: '#0A0A0A' },
  sub: { color: '#6B7280', marginTop: 2 },
  grid: { padding: 16, paddingBottom: 8 },
  card: { flex: 1, margin: 8, backgroundColor: '#fff', borderRadius: 18, padding: 16,
          shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
          elevation: 2, minHeight: 120 },
  cardOn: { borderWidth: 2, borderColor: '#0A84FF' },
  emoji: { fontSize: 34, marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '600', color: '#111827' },
  price: { marginTop: 6, color: '#4B5563', fontWeight: '500' },
  tick: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12,
          alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: '#0A84FF' }, tickOff: { backgroundColor: '#E5E7EB' }, tickText: { color: '#fff', fontWeight: '700' },
  checkout: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
              backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  totalL: { fontSize: 12, color: '#6B7280' }, totalV: { fontSize: 18, fontWeight: '700', color: '#111827' },
  cta: { marginLeft: 'auto', backgroundColor: '#0A84FF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
         shadowColor: '#0A84FF', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  ctaDis: { backgroundColor: '#A7C7FF' }, ctaText: { color: 'white', fontSize: 16, fontWeight: '700' },
  result: { backgroundColor: '#F3F4F6', margin: 16, padding: 12, borderRadius: 12 },
  resultT: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  resultV: { fontFamily: 'Courier', color: '#111827' },
}); 