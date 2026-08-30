# Fuely Automation Templates

Chatfuel template marketplace data. The landing page reads it via `MARKETPLACE_TEMPLATES_BASE_URL` (GitHub raw),
the dashboard applies a template through the `fuelyAutomationApplyTemplate` mutation.

---

## TemplateDetail

| Field        | Type                                                 | Description                                                                                       |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `id`         | `string`                                             | Unique slug. Used in the URL (`/templates/{id}`) and as a key for selecting a template in the dashboard. |
| `title`      | `string`                                             | Template name.                                                                                    |
| `category`   | `string`                                             | Primary category (one of the `CATEGORIES` values).                                                |
| `categories` | `string[]`                                           | All categories the template belongs to (includes the primary one).                                |
| `rating`     | `number`                                             | Rating from 1.0 to 5.0.                                                                          |
| `iconType`   | `"cursor" \| "moon" \| "repeat" \| "chat" \| "grow"` | Icon type for the card.                                                                           |
| `author`     | `string`                                             | Author ID (reference to `authors[].id`).                                                          |

### Allowed `iconType` values

Each value maps to a fixed card background gradient (implemented in the landing page code, cannot be changed via JSON):

| `whatItRuns` | `string` | Brief description of what the template runs (shown in the template page sidebar). |
| `whatClientGets` | `string` | What the client gets (shown in the sidebar). |
| `exampleOutcome` | `string` | Example outcome, e.g. `"+34% inquiries covered"`. |
| `aboutParagraphs` | `string[]` | Template description paragraphs ("About" section). |
| `videoUrl` | `string` | Demo video URL. Empty string if none. |
| `knowledgeBaseUrl` | `string` | Knowledge base link. Empty string if none. |
| `funnelSteps` | `string[]` | Funnel steps (5 items). `\n` within a string is a line break in the UI. |
| `revenueMin` | `number` | Minimum agency revenue per year (USD) with `defaultClients` clients. |
| `revenueMax` | `number` | Maximum agency revenue per year (USD) with `defaultClients` clients. |
| `defaultClients` | `number` | Initial value of the "clients on this funnel" slider. |
| `maxClients` | `number` | Maximum slider value. |
| `reviews` | `TemplateReview[]` | User reviews. |
| `fuelyAutomationTemplate` | `FuelyAutomationTemplateInput` | Automation configuration, passed to the `fuelyAutomationApplyTemplate` mutation. |

### TemplateReview

| Field       | Type     | Description      |
| ----------- | -------- | ---------------- |
| `name`      | `string` | Reviewer name.   |
| `avatarUrl` | `string` | Avatar.          |
| `rating`    | `number` | Review rating.   |
| `text`      | `string` | Review text.     |

### FuelyAutomationTemplateInput

Passed directly to the `fuelyAutomationApplyTemplate` GraphQL mutation in the dashboard.

#### FuelyAutomationScope (available values)

- `WhatsAppDirectMessages`
- `WhatsAppClickFromAds`
- `WhatsAppClickFromPosts`
- `InstagramDirectMessages`
- `InstagramPostComments`
- `InstagramAdComments`
- `InstagramStoryReplies`
- `InstagramIgMeLinks`
- `InstagramClickFromAds`

#### FuelySettingUpdateInput (available settings)

Each object in the `settings` array contains **one** of the following fields:

| Field                | Type                                                                                           | Description                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `whenAIReplies`      | `{ update: { option: "Always" \| "OutsideOfWorkingHours" } }`                                  | When AI replies.                                                                                       |
| `incomingMessages`   | `{ update: { howToReply: "UsingAI" \| "DontReply", messagePrompt: string } }`                  | Incoming message reply settings. `messagePrompt` is the AI system prompt (up to 5000 characters).      |
| `followUps`          | `{ update: { howToSend: "Send" \| "DontSend", messagePrompt: string } }`                       | Follow-up message settings. `messagePrompt` up to 3000 characters.                                     |
| `switchToHuman`      | `{ update: { howToSwitch: "SwitchToTeammates" \| "DontSwitch", rules: SwitchToHumanRule[] } }` | Handoff to a human agent.                                                                              |
| `messageDelays`      | object                                                                                         | Message delay settings.                                                                                |
| `collectContactInfo` | object                                                                                         | Contact info collection.                                                                               |
| `keywords`           | object                                                                                         | Keyword-triggered actions.                                                                             |

#### SwitchToHumanRule

| Field                 | Type                  | Description                                                                                                             |
| --------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `switchingConditions` | `string`              | Handoff condition (up to 3000 characters).                                                                              |
| `messagePrompt`       | `string`              | Message sent to the user on handoff (up to 3000 characters).                                                            |
| `assignees`           | `array` (optional)    | Assigned agents. **Do not specify** in templates — will cause a `FuelyTemplateSwitchToHumanAssigneesNotSupported` error. |

---

## AuthorProfile

| Field             | Type                | Description                                                                                           |
| ----------------- | ------------------- | ----------------------------------------------------------------------------------------------------- |
| `id`              | `string`            | Unique author slug. Matches `template.author`. Used in the URL (`/templates/author/{id}`).            |
| `name`            | `string`            | Author's full name.                                                                                   |
| `avatarUrl`       | `string`            | Avatar path. Local files: `/assets/template-installation/avatar1.png` … `avatar8.png`.                |
| `aboutParagraphs` | `string[]`          | Author description paragraphs ("About" section).                                                      |
| `socialLinks`     | `AuthorSocialLinks` | Social media links.                                                                                   |
| `reviews`         | `AuthorReview[]`    | Author reviews.                                                                                       |

### AuthorSocialLinks

Array of strings — author link URLs (`string[]`). The icon is determined automatically by domain: WhatsApp (`wa.me`), Instagram, Facebook, TikTok, Messenger; for other URLs — a browser (globe) icon.

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

## Repository structure

```
templates/
  template-name-1.json   # Full template data (TemplateDetail)
  template-name-2.json
authors/
  name-1.json              # Full author profile (AuthorProfile)
  name-2.json
```

### Adding a new template

1. Create `templates/{new-id}.json` with full `TemplateDetail` data.
2. Add a compact entry to `index.json` → `templates[]`.
3. If the author is new — create `authors/{author-id}.json`.
4. Add the avatar to assets.
5. Push everything together.
