import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

export type NotifCategory = 'invitations' | 'joins' | 'leaves' | 'changes' | 'cancellations' | 'always';

export const sendCategorizedPushNotification = async (
  uids: string[],
  title: string,
  body: string,
  category: NotifCategory
) => {
  if (!uids || uids.length === 0) return;

  try {
    const tokenDocs = await Promise.all(uids.map(uid => getDoc(doc(db, 'users', uid))));

    const messages = tokenDocs
      .map(d => d.exists() ? d.data() : null)
      .filter(Boolean)
      .filter((u: any) => {
        if (!u.pushToken) return false;
        if (u.notifPrefs?.pushEnabled === false) return false;
        if (category !== 'always' && u.notifPrefs?.[category] === false) return false;
        return true;
      })
      .map((u: any) => ({
        to: u.pushToken,
        sound: 'default',
        title,
        body,
        data: { source: 'padelsabardes', category },
      }));

    if (messages.length === 0) return;

    // For FCM Web tokens, we need to use the FCM v1 API or a Cloud Function.
    // For now, we store the token and the Expo endpoint still works for Expo tokens.
    // A production PWA should use a Cloud Function to send via FCM Admin SDK.
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    console.error('[PushService] Error sending notifications:', e);
  }
};
