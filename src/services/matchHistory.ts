import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { renderNotificationTemplate } from './notificationTemplates';

export type MatchHistoryEventType =
  | 'created'
  | 'updated'
  | 'schedule_changed'
  | 'joined'
  | 'left'
  | 'added'
  | 'kicked';

export type MatchHistoryEntry = {
  id: string;
  type: MatchHistoryEventType;
  actorName?: string;
  actorUid?: string;
  targetName?: string;
  matchDate?: string;
  matchTime?: string;
  createdAt: string;
};

const HISTORY_LIMIT = 20;

const historyTranslationKeys: Record<MatchHistoryEventType, string> = {
  created: 'match_history_created',
  updated: 'match_history_updated',
  schedule_changed: 'match_history_schedule_changed',
  joined: 'match_history_joined',
  left: 'match_history_left',
  added: 'match_history_added',
  kicked: 'match_history_kicked',
};

export const createMatchHistoryEntry = (
  type: MatchHistoryEventType,
  payload: Omit<MatchHistoryEntry, 'id' | 'type' | 'createdAt'> = {},
): MatchHistoryEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  type,
  createdAt: new Date().toISOString(),
  ...payload,
});

export const appendMatchHistory = async (matchId: string, entry: MatchHistoryEntry) => {
  await runTransaction(db, async (transaction) => {
    const matchRef = doc(db, 'matches', matchId);
    const matchSnapshot = await transaction.get(matchRef);
    if (!matchSnapshot.exists()) return;

    const currentHistory = Array.isArray(matchSnapshot.data().historial)
      ? matchSnapshot.data().historial
      : [];

    transaction.update(matchRef, {
      historial: [entry, ...currentHistory].slice(0, HISTORY_LIMIT),
    });
  });
};

export const renderMatchHistoryText = (
  entry: MatchHistoryEntry,
  t: (key: any) => string,
) => renderNotificationTemplate(
  t(historyTranslationKeys[entry.type] as any),
  {
    actorName: entry.actorName,
    targetName: entry.targetName,
    matchDate: entry.matchDate,
    matchTime: entry.matchTime,
  },
);
