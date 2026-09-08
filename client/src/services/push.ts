import { pushApi } from './api';

export function isPushSupported(): boolean {
  try {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  } catch { return false; }
}

export function getPushPermission(): 'granted' | 'denied' | 'default' {
  if (!isPushSupported()) return 'default';
  return Notification.permission as 'granted' | 'denied' | 'default';
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray.buffer as ArrayBuffer;
}

export async function initPushNotifications() {
  if (!isPushSupported()) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    if (existing) {
      try {
        await pushApi.subscribe({
          endpoint: existing.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(existing.getKey('p256dh')!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(existing.getKey('auth')!))),
          },
        });
      } catch {}
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const res = await pushApi.getVapidKey();
    if (!res.success || !res.data?.publicKey) return;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(res.data.publicKey),
    });

    const subJson = subscription.toJSON();
    await pushApi.subscribe({
      endpoint: subscription.endpoint,
      keys: { p256dh: subJson.keys!.p256dh, auth: subJson.keys!.auth },
    });
  } catch {}
}
