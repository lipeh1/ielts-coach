# Learning App Design System

> Version: 1.0  
> Product: Adult learning, self-study, and personal knowledge management  
> Platform: Mobile-first; adapt to iOS and Android  
> Design direction: Apple-inspired minimalism, editorial clarity, calm focus, and natural interaction

This document is the project's visual source of truth. It is a newly authored, project-specific design system inspired by the selected direction; it is not an original export from DESIGN.md / designmd.ai.

## 1. Product principles

1. **Content before chrome.** Reading, thinking, remembering, and organizing knowledge are the primary tasks.
2. **Quiet confidence.** Use restrained colors, typography, whitespace, and fine separators rather than decoration.
3. **Progress without pressure.** Show useful progress without making streaks, points, or leaderboards the product's center.
4. **Direct manipulation.** Let content respond naturally to touch, with visible and reversible actions where possible.
5. **Consistency over novelty.** Reuse tokens and components; do not invent one-off styles without a clear reason.
6. **Accessible by default.** Maintain readable contrast, adequate touch targets, scalable text, and reduced-motion support.
7. **Platform-aware, not platform-imitation.** Respect iOS and Android interaction conventions rather than copying one platform's details everywhere.

## 2. Visual foundations

### 2.1 Color tokens

Use semantic tokens in code; avoid hard-coded colors inside individual screens.

| Token | Light value | Use |
|---|---|---|
| `color.canvas` | `#F7F6F3` | Main app background |
| `color.surface` | `#FFFFFF` | Cards, sheets, reading surfaces |
| `color.surface-subtle` | `#F1F0EC` | Secondary grouped areas |
| `color.text-primary` | `#191919` | Main text and primary icons |
| `color.text-secondary` | `#686868` | Supporting text |
| `color.text-tertiary` | `#858585` | Metadata; verify contrast before use |
| `color.border` | `#E6E4DF` | Hairline borders and separators |
| `color.accent` | `#007AFF` | Primary interactive accent |
| `color.accent-pressed` | `#005FCC` | Pressed accent state |
| `color.accent-subtle` | `#EAF2FF` | Selected surfaces, subtle accent backgrounds |
| `color.success` | `#237A45` | Success and completed states |
| `color.success-subtle` | `#E7F4EA` | Subtle success backgrounds |
| `color.warning` | `#8A5A00` | Warning states |
| `color.warning-subtle` | `#FFF2D6` | Subtle warning backgrounds |
| `color.danger` | `#B42318` | Destructive/error states |
| `color.danger-subtle` | `#FCE8E6` | Subtle error backgrounds |
| `color.focus-ring` | `#2F7CF6` | Keyboard/accessibility focus |

Rules:
- Neutrals should dominate the interface. Use the accent color for actions, links, selection, and focus—not decoration.
- Success, warning, and danger colors are semantic and should not be repurposed as brand accents.
- Never communicate a state by color alone; pair it with a label, icon, or other visible cue.
- Test text and controls for WCAG contrast. If a token fails in a given context, adjust the context-specific token rather than sacrificing readability.
- Dark mode is an implementation variant, not a simple inversion. Define and test separate semantic values before claiming dark-mode support.

### 2.2 Typography

Prefer platform system fonts for native-feeling rendering and strong multilingual coverage.

Suggested stacks:
- iOS: system UI font; use the platform's default Chinese fallback.
- Android: Roboto / Noto Sans CJK system fallback as appropriate.
- Cross-platform web: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, with a tested Chinese fallback.

| Token | Suggested size | Weight | Use |
|---|---:|---|---|
| `type.display` | 32 px | Semibold | Rare hero/title moments |
| `type.title-1` | 28 px | Semibold | Screen title |
| `type.title-2` | 23 px | Semibold | Major section title |
| `type.title-3` | 19 px | Semibold | Card/section title |
| `type.body` | 16–18 px | Regular | Main UI and learning content |
| `type.body-small` | 14–15 px | Regular | Secondary controls and supporting text |
| `type.caption` | 12–13 px | Regular/Medium | Metadata; use sparingly |
| `type.button` | 15–16 px | Medium/Semibold | Button labels |
| `type.metric` | 24–32 px | Semibold | Progress metrics and key numbers |

Typography rules:
- Reading content may use a larger size and more generous line height than UI labels.
- Use sentence case; avoid unnecessary all-caps labels.
- Use tabular numerals for durations, percentages, and statistics when supported.
- Do not use ultra-light weights for important content.
- Avoid truncating meaningful learning content; allow wrapping and provide deliberate line limits only for previews.

### 2.3 Spacing

Use a 4 px base grid, with 8 px as the common rhythm.

| Token | Value |
|---|---:|
| `space.1` | 4 px |
| `space.2` | 8 px |
| `space.3` | 12 px |
| `space.4` | 16 px |
| `space.5` | 20 px |
| `space.6` | 24 px |
| `space.8` | 32 px |
| `space.10` | 40 px |
| `space.12` | 48 px |
| `space.16` | 64 px |

Rules:
- Screen side padding: normally 20–24 px; adapt to platform and device width.
- Compact control gap: 8 px; related form fields: 12–16 px.
- Separate major sections by 24–32 px.
- Use whitespace to group content before adding containers or shadows.

### 2.4 Shape, borders, and elevation

| Token | Value | Use |
|---|---:|---|
| `radius.xs` | 4 px | Small labels and compact controls |
| `radius.sm` | 6 px | Buttons and small interactive elements |
| `radius.md` | 10 px | Cards, inputs, sheets |
| `radius.lg` | 14 px | Large content panels when needed |
| `radius.pill` | 999 px | Chips or circular icon controls only when appropriate |
| `border.hairline` | 1 px | Standard separators |
| `elevation.none` | none | Default |
| `elevation.overlay` | subtle | Menus and floating sheets only |

Rules:
- Prefer a 1 px border or background contrast over a shadow.
- Do not make every element pill-shaped.
- Avoid large diffuse shadows, glassmorphism, neon glows, and decorative gradients.
- Reserve overlays and elevation for meaningful depth relationships.

## 3. Layout and navigation

- Use a predictable primary navigation model with no more than 3–5 top-level destinations.
- Keep the most frequent action—usually Continue learning or Resume—easy to reach.
- On phones, respect safe areas and thumb reach; place frequent primary actions in comfortable reach without covering content.
- Avoid nested cards. Use headings, spacing, and separators to establish hierarchy.
- Use a list layout for information-dense notes and libraries; use cards only when the content benefits from grouping or preview.
- Empty states should explain what the user can do next, not merely show an illustration.
- Loading states should preserve layout to prevent visual jumps.
- Support small screens, larger text settings, long localized strings, and portrait orientation.

Suggested primary destinations (adapt to product scope):
1. Today / Home
2. Library / Courses
3. Notes / Knowledge
4. Review
5. Profile / Settings

Do not include all five if the product does not need them.

## 4. Component specifications

### 4.1 Buttons

Variants:
- **Primary:** accent or near-black fill, high-contrast label; use for the main action on a screen.
- **Secondary:** surface fill with border or subtle neutral background.
- **Tertiary:** text-only for low-emphasis actions.
- **Destructive:** semantic danger styling and explicit confirmation when consequences are significant.

Rules:
- One visually dominant primary action per screen or focused task area.
- Typical minimum height: 44 px; 48 px is a comfortable default.
- Use 6–8 px corner radius, not a universal pill shape.
- Provide default, pressed, disabled, loading, and focus states.
- Button text should describe the action: “Continue reading”, “Save note”, “Start review”.
- Avoid vague labels such as “OK” when a clearer action is possible.

### 4.2 Icon buttons

- Use a consistent icon family and stroke weight.
- Prefer platform-native symbols or a restrained library such as Phosphor/Radix where appropriate.
- Do not mix unrelated icon families or use emoji as functional icons.
- Icon-only controls need an accessible name and a sufficiently large hit target (normally at least 44 × 44 px).
- Decorative icons must not compete with content.

### 4.3 Cards and list rows

- Default to flat surfaces, thin borders, and 10 px radius.
- Use cards only when content is a meaningful group: a course preview, a learning task, or a summary.
- Avoid putting every row inside its own card.
- Rows should have clear title, optional metadata, and an obvious interaction affordance.
- Pressed states should be subtle and immediate.

### 4.4 Inputs and search

- Inputs should have persistent labels when the field's purpose would otherwise be unclear.
- Placeholder text is a hint, not a substitute for a label.
- Provide clear focus, filled, error, disabled, and validation states.
- Search should preserve query and results when users navigate back where practical.
- Make clear actions available without making the field visually busy.

### 4.5 Progress indicators

- Use thin progress bars, completion counts, and concise labels.
- Show both progress and meaning, e.g. “6 of 10 lessons”, not only a percentage.
- Use animation only when it helps the user perceive a real state change.
- Do not use red for ordinary incomplete progress.
- Avoid guilt-inducing language or exaggerated streak warnings.

### 4.6 Learning cards and course modules

A course/module summary may contain:
- Course or topic title
- Current lesson
- Short progress indicator
- Estimated duration only when useful
- A clear Continue / Start action

Do not show every metadata field on every surface. Prioritize the next useful action.

### 4.7 Reading and highlighting

- Reading view should prioritize the text and reduce surrounding UI.
- Support readable line length, comfortable line height, and adjustable text size when possible.
- Highlighting colors should be limited and meaningfully differentiated.
- Saving a highlight or note must show a clear confirmation without interrupting reading.
- Preserve scroll position when returning from a note or related content.

### 4.8 Notes and knowledge items

- Make search, tags, sorting, and backlinks discoverable without permanently crowding the screen.
- Distinguish editable content from metadata.
- Autosave should show a clear state such as Saving / Saved / Offline.
- Destructive deletion should be reversible or confirmed when appropriate.
- Empty libraries should offer a concrete next step such as Create a note or Import material.

### 4.9 Flashcards and review

- Keep the current card as the visual focus.
- Make reveal, remember/forget, and next-card actions unambiguous.
- Do not rely on color alone for correctness or confidence.
- Provide progress in a low-pressure form such as “8 of 20”.
- Avoid long or decorative flip animations that slow repeated review.

### 4.10 Quiz and answer feedback

- Show selection immediately.
- Distinguish selected, correct, incorrect, and disabled states.
- Present explanations in readable text.
- Avoid relying solely on red/green; include text or icons.
- Allow the user to review the explanation before continuing where the learning flow calls for it.

### 4.11 Charts and study statistics

- Use restrained lines and a small semantic palette.
- Label axes and values when needed; provide a text equivalent for important information.
- Focus on trends and useful reflection, not competitive ranking.
- Do not imply precision that the underlying data does not support.

### 4.12 Sheets, dialogs, and toasts

- Use dialogs for decisions that truly require interruption.
- Use sheets for focused secondary tasks that preserve context.
- Use toasts for brief non-critical confirmation; never use a disappearing toast as the only record of an error or important result.
- Make dismissal and back navigation predictable.

## 5. Motion and interaction

This section implements the project's interpretation of the `apple-design` principles.

- Feedback should begin immediately after a user action.
- Prefer direct manipulation: dragged content follows the pointer/finger.
- Gesture-driven animations should be interruptible and allow reversal.
- Use spring motion where it communicates physical continuity; do not add springs to every element.
- Preserve directional and spatial consistency between related screens.
- Use edge resistance only when it matches the platform and interaction.
- Avoid animations that delay reading, typing, saving, or repeated review.
- Respect the system's reduced-motion preference.
- Do not communicate success, failure, or data persistence through motion alone.
- Use haptics and sound only when supported by platform conventions and user expectations; provide restraint and avoid repeated nuisance feedback.

Suggested starting ranges, to be validated in context:
- Press feedback: 80–140 ms
- Small state transition: 140–220 ms
- Screen/content transition: 180–300 ms
- Spring motion: tune stiffness/damping for the component; avoid one global spring for all interactions

These are starting values, not universal requirements. Prefer platform-native motion when using native UI frameworks.

## 6. Accessibility and inclusive design

- Aim for WCAG AA contrast for text and essential UI controls.
- Respect system text scaling and avoid clipping at larger text sizes.
- Use a minimum touch target around 44 × 44 pt on iOS and follow current platform guidance on Android.
- Ensure controls have accessible names, roles, and state announcements.
- Support screen readers and logical focus order.
- Do not encode meaning by color alone.
- Honor reduced-motion settings.
- Ensure keyboard navigation for platforms that support keyboards.
- Test long Chinese/English mixed strings, dynamic content, empty states, errors, offline states, and loading states.
- Do not use motion, sound, or haptics as the only way to communicate essential information.

## 7. Content tone

- Calm, direct, respectful, and specific.
- Encourage progress without shame, urgency, or manipulative streak pressure.
- Prefer “Continue your lesson” over “Don’t break your streak!”
- Prefer “Saved” over celebratory copy for routine operations.
- Explain errors and offer a recovery action.
- Avoid empty motivational clichés.

## 8. Anti-patterns

Do not:
- Use multiple competing accent colors without semantic need.
- Use large gradients, neon, glassmorphism, or heavy shadows as the main visual language.
- Make every container, button, and tag a pill.
- Place every piece of information in a separate card.
- Use emoji as a substitute for a consistent icon system.
- Use tiny, low-contrast metadata for important information.
- Animate every element on every screen.
- Use a chart or metric merely to fill space.
- Make XP, streaks, or rankings more prominent than learning content.
- Add a new token or one-off style when an existing semantic token works.

## 9. Implementation and quality checklist

Before shipping a screen, verify:
- [ ] It uses semantic design tokens rather than scattered hard-coded values.
- [ ] There is a clear primary action and readable information hierarchy.
- [ ] Content is not buried under decorative cards or controls.
- [ ] Buttons, fields, and icon controls have visible interaction states.
- [ ] Motion is purposeful, interruptible where appropriate, and respects reduced motion.
- [ ] Touch targets and contrast are adequate.
- [ ] Long text, empty, loading, error, offline, and disabled states are designed.
- [ ] Progress and answer states are not communicated by color alone.
- [ ] The screen remains usable at larger text sizes and on narrow devices.
- [ ] No unrelated icon families, gradients, shadows, or accent colors were introduced.

## 10. Source and adaptation note

This is a new, consolidated project specification informed by the user's stated direction and the summarized ideas of `apple-design`, `minimalist-ui`, Cupertino Minimal, and LearnFlow. It is not a verbatim copy of missing source files and does not claim to reproduce the exact original DESIGN.md website entries. Review it against the actual product and implementation framework before treating it as final.
