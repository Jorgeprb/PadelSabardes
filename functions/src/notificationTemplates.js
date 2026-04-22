const NOTIFICATION_TEMPLATE_CATEGORIES = [
  "invitations",
  "joins",
  "assigned",
  "leaves",
  "kicked",
  "reminders",
  "changes",
  "cancellations",
];

const DEFAULT_TEMPLATE = {
  title: "{defaultTitle}",
  body: "{description}",
};

const DEFAULT_NOTIFICATION_TEMPLATES = NOTIFICATION_TEMPLATE_CATEGORIES.reduce((accumulator, category) => {
  accumulator[category] = { ...DEFAULT_TEMPLATE };
  return accumulator;
}, {});

const sanitizeTemplateField = (value, fallback) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeNotificationTemplates = (value) => {
  const source = typeof value === "object" && value !== null ? value : {};

  return NOTIFICATION_TEMPLATE_CATEGORIES.reduce((accumulator, category) => {
    const entry = typeof source[category] === "object" && source[category] !== null
      ? source[category]
      : {};

    accumulator[category] = {
      title: sanitizeTemplateField(entry.title, DEFAULT_NOTIFICATION_TEMPLATES[category].title),
      body: sanitizeTemplateField(entry.body, DEFAULT_NOTIFICATION_TEMPLATES[category].body),
    };
    return accumulator;
  }, {});
};

const renderTemplate = (template, variables) =>
  template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });

const resolveNotificationTemplate = (
  templates,
  category,
  fallbackTitle,
  fallbackBody,
  variables = {},
) => {
  const resolvedVariables = {
    appName: "PADEL Sabardes",
    defaultTitle: fallbackTitle,
    description: fallbackBody,
    ...variables,
  };

  const template = templates[category] || DEFAULT_TEMPLATE;
  const title = renderTemplate(template.title, resolvedVariables).trim() || fallbackTitle;
  const body = renderTemplate(template.body, resolvedVariables).trim() || fallbackBody;

  return { title, body };
};

module.exports = {
  normalizeNotificationTemplates,
  resolveNotificationTemplate,
};
