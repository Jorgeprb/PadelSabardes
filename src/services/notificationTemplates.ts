export const NOTIFICATION_TEMPLATE_CATEGORIES = [
  'invitations',
  'joins',
  'assigned',
  'leaves',
  'kicked',
  'reminders',
  'changes',
  'cancellations',
] as const;

export type NotificationTemplateCategory = (typeof NOTIFICATION_TEMPLATE_CATEGORIES)[number];

export type NotificationTemplate = {
  title: string;
  body: string;
};

export type NotificationTemplateMap = Record<NotificationTemplateCategory, NotificationTemplate>;

export type NotificationTemplateVariables = Record<string, string | number | boolean | null | undefined>;

const DEFAULT_TEMPLATE: NotificationTemplate = {
  title: '{defaultTitle}',
  body: '{description}',
};

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplateMap = {
  invitations: { ...DEFAULT_TEMPLATE },
  joins: { ...DEFAULT_TEMPLATE },
  assigned: { ...DEFAULT_TEMPLATE },
  leaves: { ...DEFAULT_TEMPLATE },
  kicked: { ...DEFAULT_TEMPLATE },
  reminders: { ...DEFAULT_TEMPLATE },
  changes: { ...DEFAULT_TEMPLATE },
  cancellations: { ...DEFAULT_TEMPLATE },
};

const sanitizeTemplateField = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

export const normalizeNotificationTemplates = (value: unknown): NotificationTemplateMap => {
  const source = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};

  return NOTIFICATION_TEMPLATE_CATEGORIES.reduce((accumulator, category) => {
    const entry = typeof source[category] === 'object' && source[category] !== null
      ? source[category] as Record<string, unknown>
      : {};

    accumulator[category] = {
      title: sanitizeTemplateField(entry.title, DEFAULT_NOTIFICATION_TEMPLATES[category].title),
      body: sanitizeTemplateField(entry.body, DEFAULT_NOTIFICATION_TEMPLATES[category].body),
    };
    return accumulator;
  }, {} as NotificationTemplateMap);
};

export const renderNotificationTemplate = (template: string, variables: NotificationTemplateVariables) =>
  template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });

export const resolveNotificationTemplate = (
  templates: NotificationTemplateMap,
  category: NotificationTemplateCategory,
  fallbackTitle: string,
  fallbackBody: string,
  variables: NotificationTemplateVariables = {},
) => {
  const resolvedVariables: NotificationTemplateVariables = {
    appName: 'PADEL Sabardes',
    defaultTitle: fallbackTitle,
    description: fallbackBody,
    ...variables,
  };

  const template = templates[category];
  const title = renderNotificationTemplate(template.title, resolvedVariables).trim() || fallbackTitle;
  const body = renderNotificationTemplate(template.body, resolvedVariables).trim() || fallbackBody;

  return { title, body };
};
