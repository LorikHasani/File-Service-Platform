import { supabase } from '@/lib/supabase';

// VAPID public key — safe to embed, it only identifies our push sender.
// The matching private key lives in the Vercel env (VAPID_PRIVATE_KEY).
export const VAPID_PUBLIC_KEY =
  'BNAlvOYedrfxmjCMP8eKO7f3cCkC_4zs9atkI8Lg7WFFxaXLfc4_ahI9cEjBS0JxtESSIfiF7JDhBid8KssIsBg';

export type PushStatus = 'enabled' | 'disabled' | 'denied' | 'unsupported';
export type EnableResult = 'enabled' | 'denied' | 'unsupported' | 'error';

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// True when running as an installed app (home-screen / standalone window).
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? 'enabled' : 'disabled';
  } catch {
    return 'disabled';
  }
}

export async function enablePushNotifications(userId: string): Promise<EnableResult> {
  if (!isPushSupported()) return 'unsupported';

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        user_agent: navigator.userAgent,
      },
      { onConflict: 'endpoint' }
    );
    if (error) throw error;

    return 'enabled';
  } catch (err) {
    console.error('Failed to enable push notifications:', err);
    return 'error';
  }
}
