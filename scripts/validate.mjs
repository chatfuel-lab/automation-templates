#!/usr/bin/env node
// Validates the catalog against the marketplace contract and against what the
// fuelyAutomationApplyTemplate mutation actually accepts. Zero dependencies:
// run it with `node scripts/validate.mjs` from the repository root.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const CATEGORIES = [
  'Beauty & aesthetics',
  'Clinics',
  'Real estate',
  'Local services',
  'Fitness coaching',
  'Education',
  'E-commerce',
  'Coaching & creators',
  'Professional services',
];

const ICON_TYPES = ['cursor', 'moon', 'repeat', 'chat', 'grow'];

// The marketplace whitelist: the backend knows Facebook, TikTok and web widget
// scopes too, but templates published here target WhatsApp and Instagram only.
const SCOPES = [
  'WhatsAppDirectMessages',
  'WhatsAppClickFromAds',
  'WhatsAppClickFromPosts',
  'InstagramDirectMessages',
  'InstagramPostComments',
  'InstagramAdComments',
  'InstagramStoryReplies',
  'InstagramIgMeLinks',
  'InstagramClickFromAds',
];

// Settings every scope carries.
const COMMON_SETTINGS = [
  'bookingRules',
  'catalogImages',
  'collectContactInfo',
  'followUps',
  'incomingMessages',
  'messageDelays',
  'switchToHuman',
  'whenAIReplies',
];

// Settings a scope carries on top of the common set.
const SCOPE_EXTRA_SETTINGS = {
  WhatsAppDirectMessages: [],
  WhatsAppClickFromAds: ['keywords', 'listOfAds', 'sendEventsToMeta'],
  WhatsAppClickFromPosts: [],
  InstagramDirectMessages: [],
  InstagramPostComments: ['keywords', 'listOfPosts', 'privateReply', 'publicReply'],
  InstagramAdComments: ['keywords', 'listOfAds', 'privateReply', 'publicReply'],
  InstagramStoryReplies: ['keywords', 'listOfStories'],
  InstagramIgMeLinks: ['refLinks'],
  InstagramClickFromAds: ['keywords', 'listOfAds'],
};

// Filter settings pick which conversations an automation catches. A base
// automation catches everything by definition, so it cannot carry one, and only
// a scope that has at least one filter setting can hold custom automations.
const FILTER_SETTINGS = ['keywords', 'listOfPosts', 'refLinks', 'listOfAds', 'listOfStories'];

// Rejected by the mutation with FuelyTemplateSettingNotSupported: post, ad and
// story ids are per-bot, so they can only be chosen after the template is applied.
const NON_TEMPLATABLE_SETTINGS = ['listOfPosts', 'listOfAds', 'listOfStories'];

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

const runes = (value) => [...value.trim()].length;

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
  } catch (error) {
    fail(path, `not valid JSON — ${error.message}`);
    return null;
  }
}

function requireString(where, object, field, { min = 1, max = Infinity } = {}) {
  const value = object[field];
  if (typeof value !== 'string') {
    fail(where, `${field} must be a string`);
    return null;
  }
  const length = runes(value);
  if (length < min) fail(where, `${field} must not be empty`);
  if (length > max) fail(where, `${field} is ${length} characters, the limit is ${max}`);
  return value;
}

function requireEnum(where, object, field, allowed) {
  const value = object[field];
  if (!allowed.includes(value)) {
    fail(where, `${field} must be one of ${allowed.join(', ')} — got ${JSON.stringify(value)}`);
    return null;
  }
  return value;
}

function requireArray(where, object, field, { min = 0, max = Infinity } = {}) {
  const value = object[field];
  if (!Array.isArray(value)) {
    fail(where, `${field} must be an array`);
    return null;
  }
  if (value.length < min) fail(where, `${field} needs at least ${min} entries`);
  if (value.length > max) fail(where, `${field} has ${value.length} entries, the limit is ${max}`);
  return value;
}

function requireInteger(where, object, field, { min = 0, max = Infinity } = {}) {
  const value = object[field];
  if (!Number.isInteger(value)) {
    fail(where, `${field} must be an integer`);
    return null;
  }
  if (value < min || value > max) fail(where, `${field} must be between ${min} and ${max}`);
  return value;
}

function rejectUnknownKeys(where, object, allowed) {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) fail(where, `unknown field ${key}`);
  }
}

// --- setting values -------------------------------------------------------

const SETTING_VALIDATORS = {
  whenAIReplies(where, update) {
    rejectUnknownKeys(where, update, ['option']);
    requireEnum(where, update, 'option', ['Always', 'OutsideOfWorkingHours']);
  },
  incomingMessages(where, update) {
    rejectUnknownKeys(where, update, ['howToReply', 'messagePrompt']);
    requireEnum(where, update, 'howToReply', ['UsingAI', 'DontReply']);
    requireString(where, update, 'messagePrompt', { max: 5000 });
  },
  followUps(where, update) {
    rejectUnknownKeys(where, update, ['howToSend', 'messagePrompt']);
    requireEnum(where, update, 'howToSend', ['Send', 'DontSend']);
    requireString(where, update, 'messagePrompt', { max: 3000 });
  },
  switchToHuman(where, update) {
    rejectUnknownKeys(where, update, ['howToSwitch', 'rules']);
    requireEnum(where, update, 'howToSwitch', ['SwitchToTeammates', 'DontSwitch']);
    const rules = requireArray(where, update, 'rules', { max: 20 });
    (rules ?? []).forEach((rule, index) => {
      const at = `${where}.rules[${index}]`;
      if (!isPlainObject(rule)) return fail(at, 'must be an object');
      // assignees are user ids, which do not exist until the template is applied.
      rejectUnknownKeys(at, rule, ['switchingConditions', 'messagePrompt']);
      if ('assignees' in rule) {
        fail(at, 'assignees must never be set in a template (FuelyTemplateSwitchToHumanAssigneesNotSupported)');
      }
      requireString(at, rule, 'switchingConditions', { max: 3000 });
      requireString(at, rule, 'messagePrompt', { max: 3000 });
    });
  },
  messageDelays(where, update) {
    rejectUnknownKeys(where, update, ['enabled']);
    if (typeof update.enabled !== 'boolean') fail(where, 'enabled must be a boolean');
  },
  collectContactInfo(where, update) {
    rejectUnknownKeys(where, update, ['howToCollect', 'captures']);
    requireEnum(where, update, 'howToCollect', ['CollectInfo', 'DoNotCollectInfo']);
    const captures = requireArray(where, update, 'captures', { max: 40 });
    const seen = new Set();
    (captures ?? []).forEach((capture, index) => {
      const at = `${where}.captures[${index}]`;
      if (!isPlainObject(capture)) return fail(at, 'must be an object');
      rejectUnknownKeys(at, capture, ['name', 'description']);
      const name = requireString(at, capture, 'name');
      requireString(at, capture, 'description', { max: 450 });
      if (name !== null) {
        if (seen.has(name)) fail(at, `duplicate capture name ${name}`);
        seen.add(name);
      }
    });
  },
  bookingRules(where, update) {
    rejectUnknownKeys(where, update, ['autonomyLevel']);
    requireEnum(where, update, 'autonomyLevel', [
      'CollectIntents',
      'BookWithTeammatesApproval',
      'BookWithTeammatesReview',
      'BookWithFullAutonomy',
      'DontBook',
    ]);
  },
  catalogImages(where, update) {
    rejectUnknownKeys(where, update, ['whenToShow', 'imagesPerCatalogItem']);
    requireEnum(where, update, 'whenToShow', ['Never', 'OnceMentioned', 'WhenAsked']);
    requireInteger(where, update, 'imagesPerCatalogItem', { min: 1, max: 10 });
  },
  keywords(where, update) {
    rejectUnknownKeys(where, update, ['reactTo', 'keywords']);
    const reactTo = requireEnum(where, update, 'reactTo', [
      'AnyComment',
      'CommentThatContains',
      'CommentThatExactlyMatches',
      'CommentThatDoesNotContain',
    ]);
    const list = requireArray(where, update, 'keywords', { max: 50 });
    (list ?? []).forEach((keyword, index) => {
      if (typeof keyword !== 'string' || runes(keyword) === 0) {
        fail(`${where}.keywords[${index}]`, 'must be a non-empty string');
      } else if (runes(keyword) > 50) {
        fail(`${where}.keywords[${index}]`, 'is longer than 50 characters');
      }
    });
    if (reactTo && reactTo !== 'AnyComment' && (list ?? []).length === 0) {
      fail(where, `reactTo ${reactTo} needs at least one keyword`);
    }
  },
  refLinks(where, update) {
    rejectUnknownKeys(where, update, ['refs']);
    const refs = requireArray(where, update, 'refs', { min: 1, max: 20 });
    (refs ?? []).forEach((ref, index) => {
      if (typeof ref !== 'string' || runes(ref) === 0) {
        fail(`${where}.refs[${index}]`, 'must be a non-empty string');
      } else if (runes(ref) > 100) {
        fail(`${where}.refs[${index}]`, 'is longer than 100 characters');
      }
    });
  },
  privateReply(where, update) {
    rejectUnknownKeys(where, update, ['privateReplyHowToReply', 'exactTextReply', 'messagePrompt']);
    requireEnum(where, update, 'privateReplyHowToReply', ['UsingAI', 'ExactText', 'DontReply']);
    requireString(where, update, 'exactTextReply', { max: 1000 });
    requireString(where, update, 'messagePrompt', { max: 3000 });
  },
  publicReply(where, update) {
    rejectUnknownKeys(where, update, [
      'publicReplyHowToReply',
      'exactTextReply',
      'messagePrompt',
      'likeContactComment',
    ]);
    requireEnum(where, update, 'publicReplyHowToReply', ['UsingAI', 'ExactText', 'DontReply']);
    requireString(where, update, 'exactTextReply', { max: 1000 });
    requireString(where, update, 'messagePrompt', { max: 3000 });
    // Liking a comment is a Facebook-only capability; Instagram scopes reject it.
    if (update.likeContactComment !== false) {
      fail(where, 'likeContactComment must be false on Instagram scopes');
    }
  },
};

function validateSettings(where, settings, { scope, isBase }) {
  const seen = new Set();
  const allowedInScope = [...COMMON_SETTINGS, ...(SCOPE_EXTRA_SETTINGS[scope] ?? [])];

  settings.forEach((setting, index) => {
    const at = `${where}.settings[${index}]`;
    if (!isPlainObject(setting)) return fail(at, 'must be an object');

    const keys = Object.keys(setting);
    if (keys.length !== 1) {
      return fail(at, `must name exactly one setting, found ${keys.length}`);
    }
    const [name] = keys;

    if (seen.has(name)) fail(at, `${name} is set twice on the same automation (FuelyTemplateDuplicateSetting)`);
    seen.add(name);

    if (NON_TEMPLATABLE_SETTINGS.includes(name)) {
      return fail(at, `${name} cannot be set from a template (FuelyTemplateSettingNotSupported)`);
    }
    if (!SETTING_VALIDATORS[name]) {
      return fail(at, `unknown setting ${name}`);
    }
    if (!allowedInScope.includes(name)) {
      return fail(at, `${name} does not exist on ${scope} (FuelySettingNotAllowedInScope)`);
    }
    if (isBase && FILTER_SETTINGS.includes(name)) {
      return fail(at, `${name} is a filter setting and cannot go on a base automation (FuelySettingNotAllowedInScope)`);
    }

    const arm = setting[name];
    if (!isPlainObject(arm)) return fail(at, `${name} must be an object`);
    const armKeys = Object.keys(arm);
    if (armKeys.length !== 1) {
      return fail(at, `${name} must have exactly one of update or setInheritFromScope`);
    }
    if (armKeys[0] === 'setInheritFromScope') {
      if (!SCOPES.includes(arm.setInheritFromScope)) {
        fail(at, `${name}.setInheritFromScope must be a whitelisted scope`);
      }
      return;
    }
    if (armKeys[0] !== 'update') {
      return fail(at, `${name} may only use update or setInheritFromScope, not ${armKeys[0]}`);
    }
    if (!isPlainObject(arm.update)) return fail(at, `${name}.update must be an object`);
    SETTING_VALIDATORS[name](`${at}.${name}.update`, arm.update);
  });
}

function validateAutomationTemplate(where, template) {
  if (!isPlainObject(template)) return fail(where, 'fuelyAutomationTemplate must be an object');
  rejectUnknownKeys(where, template, ['baseAutomations', 'customAutomations']);

  const base = template.baseAutomations ?? [];
  const custom = template.customAutomations ?? [];
  if (!Array.isArray(base)) return fail(where, 'baseAutomations must be an array');
  if (!Array.isArray(custom)) return fail(where, 'customAutomations must be an array');
  if (base.length === 0 && custom.length === 0) {
    fail(where, 'template applies nothing — it needs at least one automation');
  }

  const seenScopes = new Set();
  base.forEach((entry, index) => {
    const at = `${where}.baseAutomations[${index}]`;
    if (!isPlainObject(entry)) return fail(at, 'must be an object');
    rejectUnknownKeys(at, entry, ['scope', 'settings']);
    const scope = requireEnum(at, entry, 'scope', SCOPES);
    if (scope) {
      if (seenScopes.has(scope)) {
        fail(at, `${scope} appears twice in baseAutomations (FuelyTemplateDuplicateAutomation)`);
      }
      seenScopes.add(scope);
    }
    const settings = requireArray(at, entry, 'settings', { min: 1 });
    if (scope && settings) validateSettings(at, settings, { scope, isBase: true });
  });

  const customCountByScope = new Map();
  custom.forEach((entry, index) => {
    const at = `${where}.customAutomations[${index}]`;
    if (!isPlainObject(entry)) return fail(at, 'must be an object');
    rejectUnknownKeys(at, entry, ['scope', 'name', 'settings']);
    const scope = requireEnum(at, entry, 'scope', SCOPES);
    requireString(at, entry, 'name', { max: 200 });
    const settings = requireArray(at, entry, 'settings', { min: 1 });
    if (!scope) return;

    const hasFilter = (SCOPE_EXTRA_SETTINGS[scope] ?? []).some((s) => FILTER_SETTINGS.includes(s));
    if (!hasFilter) {
      fail(at, `${scope} carries no filter setting, so it cannot hold a custom automation (FuelyAutomationScopeInvalid)`);
      return;
    }
    const count = (customCountByScope.get(scope) ?? 0) + 1;
    customCountByScope.set(scope, count);
    if (count > 30) fail(at, `more than 30 custom automations on ${scope} (FuelyAutomationScopeLimitReached)`);

    if (settings) validateSettings(at, settings, { scope, isBase: false });
  });
}

// --- files ----------------------------------------------------------------

const TEMPLATE_FIELDS = [
  '$schema',
  'id',
  'title',
  'category',
  'categories',
  'rating',
  'iconType',
  'author',
  'whatItRuns',
  'whatClientGets',
  'exampleOutcome',
  'aboutParagraphs',
  'videoUrl',
  'knowledgeBaseUrl',
  'funnelSteps',
  'revenueMin',
  'revenueMax',
  'defaultClients',
  'maxClients',
  'reviews',
  'fuelyAutomationTemplate',
];

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checkAsset(where, field, value) {
  if (value === '') return;
  if (/^https?:\/\//.test(value)) return;
  if (!existsSync(join(ROOT, value))) fail(where, `${field} points at ${value}, which does not exist`);
}

const authorIds = new Set();
const authors = [];

for (const file of readdirSync(join(ROOT, 'authors')).filter((f) => f.endsWith('.json')).sort()) {
  const where = `authors/${file}`;
  const author = readJson(where);
  if (!author) continue;
  rejectUnknownKeys(where, author, ['$schema', 'id', 'name', 'avatarUrl', 'aboutParagraphs', 'socialLinks', 'reviews']);
  const id = requireString(where, author, 'id');
  if (id && !SLUG.test(id)) fail(where, `id ${id} is not a lowercase-hyphen slug`);
  if (id && id !== basename(file, '.json')) fail(where, `id ${id} does not match the filename`);
  requireString(where, author, 'name');
  if (typeof author.avatarUrl !== 'string') fail(where, 'avatarUrl must be a string');
  else checkAsset(where, 'avatarUrl', author.avatarUrl);
  const paragraphs = requireArray(where, author, 'aboutParagraphs', { min: 1 });
  (paragraphs ?? []).forEach((paragraph, index) => {
    if (typeof paragraph !== 'string' || runes(paragraph) === 0) {
      fail(where, `aboutParagraphs[${index}] must be a non-empty string`);
    }
  });
  const links = requireArray(where, author, 'socialLinks');
  (links ?? []).forEach((link, index) => {
    if (typeof link !== 'string' || !/^https?:\/\//.test(link)) {
      fail(where, `socialLinks[${index}] must be an http(s) URL`);
    }
  });
  if (id) {
    authorIds.add(id);
    authors.push({ id, name: author.name, avatarUrl: author.avatarUrl });
  }
}

const templates = [];
const uniqueness = {
  id: new Map(),
  title: new Map(),
  whatItRuns: new Map(),
  whatClientGets: new Map(),
  exampleOutcome: new Map(),
  aboutParagraphs: new Map(),
};

function trackUnique(field, value, where) {
  if (typeof value !== 'string') return;
  const key = value.trim().toLowerCase();
  const previous = uniqueness[field].get(key);
  if (previous) fail(where, `${field} is identical to the one in ${previous}`);
  else uniqueness[field].set(key, where);
}

for (const file of readdirSync(join(ROOT, 'templates')).filter((f) => f.endsWith('.json')).sort()) {
  const where = `templates/${file}`;
  const template = readJson(where);
  if (!template) continue;

  rejectUnknownKeys(where, template, TEMPLATE_FIELDS);

  const id = requireString(where, template, 'id');
  if (id && !SLUG.test(id)) fail(where, `id ${id} is not a lowercase-hyphen slug`);
  if (id && id !== basename(file, '.json')) fail(where, `id ${id} does not match the filename`);

  requireString(where, template, 'title', { max: 60 });
  requireEnum(where, template, 'category', CATEGORIES);
  requireEnum(where, template, 'iconType', ICON_TYPES);

  const categories = requireArray(where, template, 'categories', { min: 1 });
  if (categories) {
    categories.forEach((category, index) => {
      if (!CATEGORIES.includes(category)) fail(where, `categories[${index}] is not a known category`);
    });
    if (new Set(categories).size !== categories.length) fail(where, 'categories contains duplicates');
    if (categories[0] !== template.category) fail(where, 'categories must start with the primary category');
  }

  const author = requireString(where, template, 'author');
  if (author && !authorIds.has(author)) fail(where, `author ${author} has no file in authors/`);

  requireString(where, template, 'whatItRuns', { max: 40 });
  requireString(where, template, 'whatClientGets', { max: 40 });
  requireString(where, template, 'exampleOutcome', { max: 60 });

  const about = requireArray(where, template, 'aboutParagraphs', { min: 2 });
  (about ?? []).forEach((paragraph, index) => {
    if (typeof paragraph !== 'string' || runes(paragraph) === 0) {
      fail(where, `aboutParagraphs[${index}] must be a non-empty string`);
    }
  });

  for (const field of ['videoUrl', 'knowledgeBaseUrl']) {
    if (typeof template[field] !== 'string') fail(where, `${field} must be a string`);
  }
  if (typeof template.videoUrl === 'string') checkAsset(where, 'videoUrl', template.videoUrl);

  const steps = requireArray(where, template, 'funnelSteps', { min: 5, max: 5 });
  (steps ?? []).forEach((step, index) => {
    if (typeof step !== 'string' || runes(step) === 0) {
      fail(where, `funnelSteps[${index}] must be a non-empty string`);
    }
  });

  const revenueMin = requireInteger(where, template, 'revenueMin');
  const revenueMax = requireInteger(where, template, 'revenueMax');
  if (revenueMin !== null && revenueMax !== null && revenueMin >= revenueMax) {
    fail(where, 'revenueMin must be lower than revenueMax');
  }
  const defaultClients = requireInteger(where, template, 'defaultClients', { min: 1 });
  const maxClients = requireInteger(where, template, 'maxClients', { min: 1 });
  if (defaultClients !== null && maxClients !== null && defaultClients > maxClients) {
    fail(where, 'defaultClients must not exceed maxClients');
  }

  if ('rating' in template) {
    const rating = template.rating;
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      fail(where, 'rating must be a number between 1 and 5');
    }
  }

  const reviews = requireArray(where, template, 'reviews');
  (reviews ?? []).forEach((review, index) => {
    const at = `${where}.reviews[${index}]`;
    if (!isPlainObject(review)) return fail(at, 'must be an object');
    rejectUnknownKeys(at, review, ['name', 'rating', 'text', 'avatarUrl']);
    requireString(at, review, 'name');
    requireString(at, review, 'text');
    if (typeof review.rating !== 'number' || review.rating < 1 || review.rating > 5) {
      fail(at, 'rating must be a number between 1 and 5');
    }
    if (typeof review.avatarUrl !== 'string') fail(at, 'avatarUrl must be a string');
    else checkAsset(at, 'avatarUrl', review.avatarUrl);
  });

  validateAutomationTemplate(where, template.fuelyAutomationTemplate);

  trackUnique('id', id, where);
  trackUnique('title', template.title, where);
  trackUnique('whatItRuns', template.whatItRuns, where);
  trackUnique('whatClientGets', template.whatClientGets, where);
  trackUnique('exampleOutcome', template.exampleOutcome, where);
  trackUnique('aboutParagraphs', (about ?? []).join('\n'), where);

  templates.push(template);
}

// --- index.json -----------------------------------------------------------

const INDEX_TEMPLATE_FIELDS = [
  'id',
  'title',
  'category',
  'categories',
  'iconType',
  'author',
  'whatItRuns',
  'whatClientGets',
  'exampleOutcome',
];

const index = readJson('index.json');
if (index) {
  rejectUnknownKeys('index.json', index, ['$schema', 'templates', 'authors']);

  const indexed = new Map((index.templates ?? []).map((entry) => [entry.id, entry]));
  if (!Array.isArray(index.templates)) fail('index.json', 'templates must be an array');
  else if (indexed.size !== index.templates.length) fail('index.json', 'templates contains duplicate ids');

  for (const template of templates) {
    const entry = indexed.get(template.id);
    if (!entry) {
      fail('index.json', `${template.id} is missing — every template needs an index entry`);
      continue;
    }
    rejectUnknownKeys(`index.json (${template.id})`, entry, [...INDEX_TEMPLATE_FIELDS, 'rating']);
    for (const field of INDEX_TEMPLATE_FIELDS) {
      if (JSON.stringify(entry[field]) !== JSON.stringify(template[field])) {
        fail('index.json', `${template.id}.${field} does not match templates/${template.id}.json`);
      }
    }
    if (JSON.stringify(entry.rating) !== JSON.stringify(template.rating)) {
      fail('index.json', `${template.id}.rating does not match templates/${template.id}.json`);
    }
    indexed.delete(template.id);
  }
  for (const id of indexed.keys()) {
    fail('index.json', `${id} has no file in templates/`);
  }

  const indexedAuthors = new Map((index.authors ?? []).map((entry) => [entry.id, entry]));
  if (!Array.isArray(index.authors)) fail('index.json', 'authors must be an array');
  for (const author of authors) {
    const entry = indexedAuthors.get(author.id);
    if (!entry) {
      fail('index.json', `author ${author.id} is missing`);
      continue;
    }
    rejectUnknownKeys(`index.json (author ${author.id})`, entry, ['id', 'name', 'avatarUrl']);
    for (const field of ['name', 'avatarUrl']) {
      if (entry[field] !== author[field]) {
        fail('index.json', `author ${author.id}.${field} does not match authors/${author.id}.json`);
      }
    }
    indexedAuthors.delete(author.id);
  }
  for (const id of indexedAuthors.keys()) {
    fail('index.json', `author ${id} has no file in authors/`);
  }
}

// --- report ---------------------------------------------------------------

if (errors.length > 0) {
  for (const error of errors) console.error(`✗ ${error}`);
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'} found.`);
  process.exit(1);
}

console.log(`✓ ${templates.length} templates and ${authors.length} authors are valid.`);
