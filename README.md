# Fuely Automation Templates

Chatfuel template marketplace data. The landing page reads it via `MARKETPLACE_TEMPLATES_BASE_URL` (GitHub raw),
the dashboard applies a template through the `fuelyAutomationApplyTemplate` mutation.

Every file in this repository is data. There is no build step and no dependency to install —
`node scripts/validate.mjs` checks the whole catalog and CI runs the same command on every pull request.

---

## Repository structure

```
index.json                 # Card-shaped listing of the whole catalog (one fetch for the index page)
templates/
  <template-id>.json       # Full template data (TemplateDetail)
authors/
  <author-id>.json         # Full author profile (AuthorProfile)
assets/                    # Images and videos referenced by templates and authors
schema/                    # JSON Schema for each file type (editor support)
scripts/validate.mjs       # Zero-dependency validator
```

Asset paths are written **relative to the repository root**, without a leading slash —
`assets/demo.mp4` — and the consumer joins them onto `MARKETPLACE_TEMPLATES_BASE_URL`.
An empty string means "none".

---

## TemplateDetail

| Field                     | Type                                                 | Description                                                                                             |
| ------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `id`                      | `string`                                             | Unique slug, lowercase with hyphens. Must match the filename. Used in the URL (`/templates/{id}`) and as the key that selects a template in the dashboard. |
| `title`                   | `string`                                             | Template name, up to 60 characters. Shown on the card and as the page heading.                          |
| `category`                | `string`                                             | Primary category (one of the `Categories` values).                                                      |
| `categories`              | `string[]`                                           | All categories the template belongs to. The primary one comes first.                                    |
| `rating`                  | `number`                                             | Optional, 1.0 to 5.0. Only meaningful once the template has reviews; omit it otherwise.                 |
| `iconType`                | `"cursor" \| "moon" \| "repeat" \| "chat" \| "grow"` | Icon type for the card.                                                                                 |
| `author`                  | `string`                                             | Author ID (reference to a file in `authors/`).                                                          |
| `whatItRuns`              | `string`                                             | Brief description of what the template runs, up to 40 characters (template page sidebar).               |
| `whatClientGets`          | `string`                                             | What the client gets, up to 40 characters (sidebar).                                                    |
| `exampleOutcome`          | `string`                                             | Example outcome, up to 60 characters, e.g. `"Up to 40% fewer no-shows"`.                                |
| `aboutParagraphs`         | `string[]`                                           | Template description paragraphs ("About" section). At least two, and unique to this template.           |
| `videoUrl`                | `string`                                             | Demo video path. Empty string if none.                                                                  |
| `knowledgeBaseUrl`        | `string`                                             | Knowledge base link. Empty string if none.                                                              |
| `funnelSteps`             | `string[]`                                           | Funnel steps — exactly 5. A `\n` within a string is a line break in the UI.                             |
| `revenueMin`              | `number`                                             | Minimum agency revenue per year (USD) with `defaultClients` clients.                                    |
| `revenueMax`              | `number`                                             | Maximum agency revenue per year (USD) with `defaultClients` clients.                                    |
| `defaultClients`          | `number`                                             | Initial value of the "clients on this funnel" slider.                                                   |
| `maxClients`              | `number`                                             | Maximum slider value.                                                                                   |
| `reviews`                 | `TemplateReview[]`                                   | User reviews. Ships empty; real reviews are added as they come in.                                      |
| `fuelyAutomationTemplate` | `FuelyAutomationTemplateInput`                       | Automation configuration, passed to the `fuelyAutomationApplyTemplate` mutation.                        |

### Allowed `iconType` values

Each value maps to a fixed card background gradient, implemented in the landing page code and not
changeable from JSON. Pick the one that matches what triggers the automation:

| Value    | Use it for                                                                 |
| -------- | -------------------------------------------------------------------------- |
| `cursor` | Something the contact clicks or comments — ads, post comments, story replies, ref links. |
| `moon`   | Always-on cover: after-hours, weekends, out-of-office.                     |
| `repeat` | Recurring contact: reminders, rebooking, win-backs, follow-up sequences.    |
| `chat`   | Ordinary inbound conversation: questions, bookings, support.                |
| `grow`   | Qualification and intake that feeds a sales process.                        |

### TemplateReview

| Field       | Type     | Description                                        |
| ----------- | -------- | -------------------------------------------------- |
| `name`      | `string` | Reviewer name.                                     |
| `rating`    | `number` | Review rating, 1.0 to 5.0.                         |
| `text`      | `string` | Review text.                                       |
| `avatarUrl` | `string` | Avatar path, or an empty string for none.          |

---

## AuthorProfile

| Field             | Type                | Description                                                                         |
| ----------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `id`              | `string`            | Unique author slug. Matches `template.author` and the filename. Used in the URL (`/templates/author/{id}`). |
| `name`            | `string`            | Author's display name.                                                              |
| `avatarUrl`       | `string`            | Avatar path relative to the repository root, or an empty string for none.           |
| `aboutParagraphs` | `string[]`          | Author description paragraphs ("About" section).                                    |
| `socialLinks`     | `string[]`          | Author link URLs.                                                                   |
| `reviews`         | `AuthorReview[]`    | Optional. Same shape as `TemplateReview`.                                           |

`socialLinks` is a plain array of URLs. The icon is determined automatically by domain:
WhatsApp (`wa.me`), Instagram, Facebook, TikTok, Messenger; for other URLs — a browser (globe) icon.

---

## Categories

Allowed values for `category` and `categories`:

- `Beauty & aesthetics`
- `Clinics`
- `Real estate`
- `Local services`
- `Fitness coaching`
- `Education`

---

## index.json

A card-shaped listing of the catalog, so the index page needs one request instead of one per template.
It is derived data and must stay in sync with `templates/` and `authors/` — `scripts/validate.mjs`
fails the build if it drifts.

```json
{
  "templates": [
    {
      "id": "…", "title": "…", "category": "…", "categories": ["…"],
      "iconType": "…", "author": "…",
      "whatItRuns": "…", "whatClientGets": "…", "exampleOutcome": "…"
    }
  ],
  "authors": [{ "id": "…", "name": "…", "avatarUrl": "…" }]
}
```

---

## FuelyAutomationTemplateInput

Passed directly to the `fuelyAutomationApplyTemplate` GraphQL mutation in the dashboard.

```json
{
  "baseAutomations": [{ "scope": "…", "settings": [] }],
  "customAutomations": [{ "scope": "…", "name": "…", "settings": [] }]
}
```

- A **base automation** already exists on every bot, one per scope. Naming it here writes the settings
  you list onto it and leaves everything else untouched.
- A **custom automation** is created by the template. It needs a `name` (1–200 characters) and is
  created disabled, like any manually created rule. Applying the same template twice creates it twice.
- Both lists are optional, but a template that names neither does nothing.
- Each object in `settings` contains **exactly one** setting key, and each setting contains exactly one of
  `update` (an explicit value) or `setInheritFromScope` (inherit from that scope's base automation).

### FuelyAutomationScope (available values)

- `WhatsAppDirectMessages`
- `WhatsAppClickFromAds`
- `WhatsAppClickFromPosts`
- `InstagramDirectMessages`
- `InstagramPostComments`
- `InstagramAdComments`
- `InstagramStoryReplies`
- `InstagramIgMeLinks`
- `InstagramClickFromAds`

### Which settings exist on which scope

Every scope carries the common set: `whenAIReplies`, `incomingMessages`, `followUps`, `switchToHuman`,
`messageDelays`, `collectContactInfo`, `bookingRules`, `catalogImages`. Naming a setting a scope does not
carry returns `FuelySettingNotAllowedInScope`.

| Scope                     | Extra settings                                     | Custom automations |
| ------------------------- | -------------------------------------------------- | ------------------ |
| `WhatsAppDirectMessages`  | —                                                  | no                 |
| `WhatsAppClickFromAds`    | `keywords`, `sendEventsToMeta`                     | yes                |
| `WhatsAppClickFromPosts`  | —                                                  | no                 |
| `InstagramDirectMessages` | —                                                  | no                 |
| `InstagramPostComments`   | `keywords`, `privateReply`, `publicReply`          | yes                |
| `InstagramAdComments`     | `keywords`, `privateReply`, `publicReply`          | yes                |
| `InstagramStoryReplies`   | `keywords`                                         | yes                |
| `InstagramIgMeLinks`      | `refLinks`                                         | yes                |
| `InstagramClickFromAds`   | `keywords`                                         | yes                |

`keywords` and `refLinks` are **filter** settings: they decide which conversations an automation catches.
A base automation catches everything by definition, so it cannot carry one — put them on a custom
automation. A scope with no filter setting cannot hold custom automations at all.

`likeContactComment` on `publicReply` must be `false`: liking a comment is a Facebook-only capability.

### FuelySettingUpdateInput (available settings)

Each object in the `settings` array contains **one** of the following fields:

| Field                | Shape of `update`                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `whenAIReplies`      | `{ option: "Always" \| "OutsideOfWorkingHours" }`                                                            |
| `incomingMessages`   | `{ howToReply: "UsingAI" \| "DontReply", messagePrompt: string }`                                            |
| `followUps`          | `{ howToSend: "Send" \| "DontSend", messagePrompt: string }`                                                 |
| `switchToHuman`      | `{ howToSwitch: "SwitchToTeammates" \| "DontSwitch", rules: SwitchToHumanRule[] }`                           |
| `messageDelays`      | `{ enabled: boolean }`                                                                                       |
| `collectContactInfo` | `{ howToCollect: "CollectInfo" \| "DoNotCollectInfo", captures: [{ name: string, description: string }] }`   |
| `bookingRules`       | `{ autonomyLevel: "CollectIntents" \| "BookWithTeammatesApproval" \| "BookWithTeammatesReview" \| "BookWithFullAutonomy" \| "DontBook" }` |
| `catalogImages`      | `{ whenToShow: "Never" \| "OnceMentioned" \| "WhenAsked", imagesPerCatalogItem: number }`                     |
| `keywords`           | `{ reactTo: "AnyComment" \| "CommentThatContains" \| "CommentThatExactlyMatches" \| "CommentThatDoesNotContain", keywords: string[] }` |
| `refLinks`           | `{ refs: string[] }`                                                                                         |
| `privateReply`       | `{ privateReplyHowToReply: "UsingAI" \| "ExactText" \| "DontReply", exactTextReply: string, messagePrompt: string }` |
| `publicReply`        | `{ publicReplyHowToReply: "UsingAI" \| "ExactText" \| "DontReply", exactTextReply: string, messagePrompt: string, likeContactComment: false }` |

`listOfPosts`, `listOfAds` and `listOfStories` exist on the mutation but **cannot be set from a template**
(`FuelyTemplateSettingNotSupported`) — post, ad and story ids only exist once a bot is connected. An
automation created without them is generic for its source, which is the sensible default.

#### SwitchToHumanRule

| Field                 | Type                  | Description                                                                                                             |
| --------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `switchingConditions` | `string`              | Handoff condition (up to 3000 characters).                                                                              |
| `messagePrompt`       | `string`              | Message sent to the user on handoff (up to 3000 characters).                                                            |
| `assignees`           | `array` (optional)    | Assigned agents. **Do not specify** in templates — will cause a `FuelyTemplateSwitchToHumanAssigneesNotSupported` error. |

### Limits

Counted in characters after trimming, so a whitespace-only value counts as empty.

| Field                                          | Limit                          |
| ---------------------------------------------- | ------------------------------ |
| `incomingMessages.messagePrompt`               | 1–5000                         |
| `followUps.messagePrompt`                      | 1–3000                         |
| `switchToHuman.rules[].switchingConditions`    | 1–3000                         |
| `switchToHuman.rules[].messagePrompt`          | 1–3000                         |
| `switchToHuman.rules`                          | up to 20 rules                 |
| `collectContactInfo.captures`                  | up to 40, `description` ≤ 450  |
| `keywords.keywords`                            | up to 50, each ≤ 50            |
| `refLinks.refs`                                | up to 20, each ≤ 100           |
| `privateReply`/`publicReply` `exactTextReply`  | 1–1000                         |
| `privateReply`/`publicReply` `messagePrompt`   | 1–3000                         |
| `catalogImages.imagesPerCatalogItem`           | 1–10                           |
| custom automation `name`                       | 1–200                          |

### Errors a badly formed template returns

| Code                                             | Cause                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `FuelyTemplateSettingNotSupported`               | `listOfPosts`, `listOfAds` or `listOfStories` in `settings`.       |
| `FuelyTemplateSwitchToHumanAssigneesNotSupported`| Any `assignees` entry on a switch-to-human rule.                   |
| `FuelyTemplateDuplicateSetting`                  | The same setting key twice on one automation.                      |
| `FuelyTemplateDuplicateAutomation`               | The same scope twice in `baseAutomations`.                         |
| `FuelySettingNotAllowedInScope`                  | A setting the scope does not carry, including a filter setting on a base automation. |
| `FuelyAutomationScopeInvalid`                    | A custom automation on a scope with no filter setting.             |
| `FuelyAutomationNameInvalid`                     | A custom automation name that is blank or over 200 characters.     |
| `FuelyAutomationScopeLimitReached`               | More than 30 custom automations on one scope.                      |

`scripts/validate.mjs` catches every one of these before the template is published.

---

## Writing a good template

- **The `id` is the URL.** Make it descriptive and keyword-bearing — `dental-clinic-after-hours-whatsapp`,
  not `template-7`. It cannot be changed later without breaking the page.
- **`aboutParagraphs` is the page body.** Write it for the person deciding whether to install this:
  one sentence on the problem, one paragraph on how the automation solves it. Do not reuse copy
  between templates; the validator rejects duplicates.
- **Prompts are the product.** Write them for the vertical, state what the AI may and may not say, and
  point at the knowledge base for anything factual — prices, hours, availability. Say plainly what the
  assistant must never do, and hand over to a human where a wrong answer would matter.
- **Claim ranges, not statistics.** `exampleOutcome` should read `"Up to 40% fewer no-shows"`, never an
  invented precise figure.
- **`funnelSteps` must match the trigger.** A comment-triggered template starts at `Comment\nposted`,
  not `Message\nreceived`.

## Adding a new template

1. Create `templates/{new-id}.json` with the full `TemplateDetail` data.
2. If the author is new, create `authors/{author-id}.json` and add any avatar to `assets/`.
3. Add the matching entry to `index.json` → `templates[]` (and `authors[]` for a new author).
4. Run `node scripts/validate.mjs` until it passes.
5. Open a pull request. CI runs the same validator.
