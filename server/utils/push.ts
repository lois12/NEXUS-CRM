import webpush from 'web-push';
import { v4 as uuidv4 } from 'uuid';
import { run, query, get } from '../db/database';
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } from '../config';

webpush.setVapidDetails('mailto:nexus@crm.local', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

export function saveSubscription(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string) {
  const existing = get('SELECT id FROM push_subscriptions WHERE endpoint = ?', [subscription.endpoint]);
  if (existing) {
    run('UPDATE push_subscriptions SET userId = ?, p256dh = ?, auth = ?, userAgent = ? WHERE endpoint = ?',
      [userId, subscription.keys.p256dh, subscription.keys.auth, userAgent, subscription.endpoint]);
  } else {
    run('INSERT INTO push_subscriptions (id, userId, endpoint, p256dh, auth, userAgent) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, userAgent]);
  }
}

export function removeSubscription(endpoint: string) {
  run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
}

export async function sendPushNotification(userId: string, payload: { title: string; body: string; tag?: string; link?: string }) {
  const subs = query('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE userId = ?', [userId]);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          tag: payload.tag || 'nexus-chat',
          link: payload.link || '/',
          icon: '/favicon.svg',
          badge: '/favicon.svg',
        })
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        removeSubscription(sub.endpoint);
      }
    }
  }
}

export async function sendPushBatch(userIds: string[], payload: { title: string; body: string; tag?: string; link?: string }) {
  const uniqueIds = [...new Set(userIds)];
  await Promise.all(uniqueIds.map(id => sendPushNotification(id, payload)));
}
