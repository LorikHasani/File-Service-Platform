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

export async function getPushStatus(userId?: string): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return 'disabled';
    if (!userId) return 'enabled';

    // The browser subscription must also be registered to THIS account.
    // On a shared device it may still belong to the previously logged-in
    // user — then this account shows "disabled" so Enable can claim it.
    const { data } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', subscription.endpoint)
      .eq('user_id', userId)
      .maybeSingle();
    return data ? 'enabled' : 'disabled';
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

    const subscribe = () =>
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
      });

    const saveSubscription = (sub: PushSubscription) => {
      const json = sub.toJSON();
      return supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
          user_agent: navigator.userAgent,
        },
        { onConflict: 'endpoint' }
      );
    };

    let subscription = (await registration.pushManager.getSubscription()) || (await subscribe());
    let { error } = await saveSubscription(subscription);

    if (error) {
      // The endpoint is most likely still registered to a different
      // account (shared device) and RLS blocks taking over that row.
      // Reset the browser subscription and register fresh — the orphaned
      // row is pruned server-side on its next failed send.
      await subscription.unsubscribe();
      subscription = await subscribe();
      ({ error } = await saveSubscription(subscription));
      if (error) throw error;
    }

    return 'enabled';
  } catch (err) {
    console.error('Failed to enable push notifications:', err);
    return 'error';
  }
}

export async function disablePushNotifications(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return true;

    // RLS limits the delete to rows this account owns.
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    await subscription.unsubscribe();
    return true;
  } catch (err) {
    console.error('Failed to disable push notifications:', err);
    return false;
  }
}

export async function sendTestPush(): Promise<'sent' | 'no_subscription' | 'error'> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return 'error';

    const response = await fetch('/api/create-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'test_push',
        title: 'Test notification 🔔',
        message: 'Push notifications are working on this device!',
      }),
    });
    if (!response.ok) return 'error';

    const data = await response.json();
    return data.sent > 0 ? 'sent' : 'no_subscription';
  } catch (err) {
    console.error('Test push failed:', err);
    return 'error';
  }
}
