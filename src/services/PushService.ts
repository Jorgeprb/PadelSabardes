import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebaseConfig';
import {
  normalizeNotificationTemplates,
  resolveNotificationTemplate,
  type NotificationTemplateCategory,
  type NotificationTemplateVariables,
} from './notificationTemplates';

export type NotifCategory =
  | 'invitations'
  | 'joins'
  | 'leaves'
  | 'assigned'
  | 'kicked'
  | 'changes'
  | 'cancellations'
  | 'always';

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

export const sendConfiguredPushNotification = async (
  uids: string[],
  category: NotificationTemplateCategory,
  fallbackTitle: string,
  fallbackBody: string,
  variables: NotificationTemplateVariables = {},
) => {
  if (!uids || uids.length === 0) return;

  try {
    const settingsSnapshot = await getDoc(doc(db, 'config', 'notificationTemplates'));
    const templates = normalizeNotificationTemplates(settingsSnapshot.data());
    const { title, body } = resolveNotificationTemplate(templates, category, fallbackTitle, fallbackBody, variables);
    await sendCategorizedPushNotification(uids, title, body, category);
  } catch (error) {
    console.error('[PushService] Error resolving notification template, using fallback text:', error);
    await sendCategorizedPushNotification(uids, fallbackTitle, fallbackBody, category);
  }
};
