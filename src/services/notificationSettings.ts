export type NotificationSettings = {
  reminderOffsetsMinutes: number[];
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  reminderOffsetsMinutes: [60],
};

export const normalizeNotificationSettings = (value: unknown): NotificationSettings => {
  const source = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};

  const reminderOffsetsMinutes = Array.isArray(source.reminderOffsetsMinutes)
    ? source.reminderOffsetsMinutes
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry) && entry > 0 && entry <= 7 * 24 * 60)
    : DEFAULT_NOTIFICATION_SETTINGS.reminderOffsetsMinutes;

  const uniqueSortedOffsets = Array.from(new Set(reminderOffsetsMinutes)).sort((left, right) => left - right);

  return {
    reminderOffsetsMinutes: uniqueSortedOffsets,
  };
};
