import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseConfig';

export type NotifCategory = 'invitations' | 'joins' | 'leaves' | 'changes' | 'cancellations' | 'always';

const sendPushNotificationsCallable = httpsCallable<
  { uids: string[]; title: string; body: string; category: NotifCategory },
  { sentCount: number; skippedCount: number }
>(functions, 'sendPushNotifications');

export const sendCategorizedPushNotification = async (
  uids: string[],
  title: string,
  body: string,
  category: NotifCategory
) => {
  if (!uids || uids.length === 0) return;

  try {
    await sendPushNotificationsCallable({ uids, title, body, category });
  } catch (e) {
    console.error('[PushService] Error sending notifications:', e);
  }
};
