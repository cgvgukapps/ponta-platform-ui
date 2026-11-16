# Design notes

## 1. Tokens

All values live in `src/styles/tokens.css`. Components use utilities mapped to these variables and never hard-code colour. The only literal colour maths is inside the canvas drawing code, which composes alpha from token values read at runtime. Contrast for every pair is verified by `npm run contrast` and written to `contrast.md`.

### Colour

| Group | Token | Value | Use |
| --- | --- | --- | --- |
| Surface | `--canvas` | `#0b0d12` | App background |
| | `--surface-1` / `-2` / `-3` | `#11141b` / `#171b24` / `#1e232e` | Panels, raised rows, hover and selected |
| | `--hairline` / `-strong` | white 8% / 14% | Dividers, card edges |
| | `--hairline-hover` / `-dashed` | white 26% / 32% | Hover edge, dashed drop zones and estimates |
| | `--control-border` | white 42% | Input, select, checkbox and switch edges (4.1:1) |
| Text | `--fg-1` to `--fg-4` | `#ededed`, `#c3c3c3`, `#a7a7a7`, `#8a8a8a` | Primary to quietest. `--fg-4` is the floor (5.0:1 on surface 2) |
| Accent | `--accent` | `#1e76fa` | Focus ring, selection, graphics. Not for body text |
| | `--accent-text` | `#4a90fb` | Blue text on dark (5.9:1 on surface 1) |
| | `--accent-fill` / hover / active | `#1558c9` / `#1a63de` / `#114aa8` | Primary button. White label 6.4:1 |
| Team | `--team-home` | `#d6293d` | Crimson, circles on the pitch and team chips only |
| | `--team-away` | `#2bc7b9` | Teal |
| | `--highlight` | `#ffd700` | Selected event, citation markers |
| Pitch | `--pitch`, `--pitch-line`, `--pitch-hex` | `#16231b`, white 26%, white 7% | Canvas |
| Heat | `--heat-0` to `--heat-8` | `#111034` to `#ffdff8` | Value and pressure, lightness-monotonic |
| Decision quality | `--dq-poor` / `suboptimal` / `good` / `optimal` | `#f2603c` / `#f29d2e` / `#a3d93b` / `#33c26b` | Band chips only |
| Parity | `--parity-ink` / `-dim` / `--on-parity` | `#d2cbbb` / `#a39d90` / `#14110b` | Full, Degraded and Blocked marks |
| Confidence | `--conf-ink` | white 62% | Level bar and dashed edge, no hue |
| Status | `--danger`, `--warn` (+ tints) | `#f2603c`, `#f29d2e` | Errors and warnings in banners, not analytics |

The printable brief is the only light surface. `[data-theme='print']` overrides surfaces, text, hairlines, accent text, parity, confidence and decision-quality tokens, each re-verified for contrast on white.

### Type

Geist for text and Geist Mono for ids, times and numbers, both self-hosted (`public/fonts`, OFL texts included). Numerals use `tabular-nums` throughout. Inter and JetBrains Mono are self-hosted fallbacks only.

| Step | Size / line | Typical use |
| --- | --- | --- |
| `2xs` | 11 / 16 | Mono labels, table headers, kickers |
| `xs` | 12 / 16 | Secondary text, chips, citations |
| `sm` | 13 / 20 | Default UI text (body base is 13) |
| `base` | 14 / 20 | Brief bullets, answers |
| `md` | 16 / 24 | Lead text |
| `lg` | 20 / 28 | Question text in Ask |
| `xl` | 24 / 32 | Page titles, gate counts |
| `2xl` | 32 / 40 | Ask heading, decision-quality ratio |

### Spacing, radii, motion

- Spacing: Tailwind's 4 px scale. Page gutters 24 px, panel padding 16 px, dense table rows 8 to 10 px vertical.
- Radii: 4 (chips, inputs inside dense tables), 6 (buttons, inputs), 8 (panels and cards). Nothing else.
- Motion: 120, 160 and 200 ms with `cubic-bezier(0.2, 0, 0, 1)`. Under `prefers-reduced-motion` a global rule removes transitions and animation, and the Ask turn shows its answer at once instead of streaming. The replay never autoplays.
- Focus: a 2 px `--accent` ring with 2 px offset on every interactive element.

### Verified contrast (highlights)

95 pairs checked, none failing. The full table is `contrast.md`.

| Pair | Ratio | Needs |
| --- | --- | --- |
| `fg-1` on canvas / `fg-4` on surface 3 | 16.6 / 4.56 | 4.5 |
| `accent-text` on surface 1 | 5.86 | 4.5 |
| `on-accent` on `accent-fill` | 6.42 | 4.5 |
| `accent` on canvas (focus ring) | 4.65 | 3 |
| `parity-ink-dim` on surface 1 | 6.83 | 4.5 |
| `dq-poor` on surface 1 | 5.72 | 4.5 |
| `danger` on surface 1 | 5.72 | 4.5 |
| `control-border` on surface 1 | 4.09 | 3 |
| `team-home` on pitch / `team-away` on pitch | 3.29 / 7.73 | 3 |
| `highlight` on pitch | 11.6 | 3 |
| Print: `fg-4`, `accent-text`, `parity-ink-dim` on white | 6.31, 6.42, 5.78 | 4.5 |

The audit found one real failure early on: the 14% hairline used for input edges was far below 3:1. Form controls now use `--control-border`.

Two honest limits. `team-home` on the pitch passes 3:1 by 0.29, so home markers always carry a white shirt number and an outline. `heat-0` and `heat-1` sit within 1.1:1 of the pitch on purpose, so low values fade out rather than shout. Heat is therefore never the only carrier of a value: the explain card and player table state the numbers.

## 2. The three colour collisions

**Away blue against brand blue.** Away is teal `#2bc7b9`, far from the brand `#1e76fa`. Brand blue is interaction colour only and is never drawn on the pitch canvas, in a team chip or in a chart. A blue element on the pitch cannot be mistaken for a team.

**Home red against error and Blocked.** Home is crimson `#d6293d` and appears only as a circle or a team dot. Errors use vermilion `#f2603c` and appear only as rectangular banners with an icon and a title. Blocked never uses red at all: it is an unfilled outline in the dimmer stone hue. Shape does the work (circle against rectangle), not hue alone.

**Decision-quality traffic lights against parity.** Parity is not traffic-light coloured. It uses one stone hue and reads as how full the mark is: a solid square for Full, a lightly filled square with an outline for Degraded, an unfilled outline for Blocked. The same fill levels are used on the icon, the badge and the 14-cell strip. The red-to-green ramp is reserved for the four decision-quality bands, and each band also carries a one-to-four bar glyph and a text label, so it survives greyscale and colour-blind viewing.

Known residual: `--dq-poor` and `--danger` are the same orange-red, as are `--dq-suboptimal` and `--warn`. They never share a component: a band is always a small pill with a bar glyph and a band name, a status is always a banner or row with an icon and a sentence. If this proves confusing in testing, the cheapest fix is to move `--danger` towards magenta.

## 3. The three visual channels

| Channel | Carries | Encoding | Never uses |
| --- | --- | --- | --- |
| Heat | Magnitude: value, pressure | Lightness-monotonic purple to pink ramp, hexagon fill | Texture, shape marks |
| Confidence | How certain the tracking is | A level bar (short means less certain), a dashed edge, and fading on the pitch. No hue, and no texture behind text | Colour |
| Parity and tier | What Ponta can say at all | Fill level (solid, light, empty) in the stone hue | The heat ramp, red and green |

On the pitch, when value and control are both on, control is drawn as a smaller inner hexagon so two fills do not blend into one. On the pitch, less certain zones are drawn fainter with a dashed hexagon edge; the fill is never textured. Event-only estimates use a fourth, structurally separate class: a dashed edge, ruled-paper background and hollow glyph with a range chip ("Good to Optimal"), so an estimate can never be read as a measured score.

## 4. Assumptions, ambiguities and hard-to-implement parts

Assumptions

1. Brand blue `#1e76fa` was not used for body text. The brief gave `#4a90fb` for text on dark, and `#1558c9` for the filled button.
2. Players are pseudonymous ("Home 10"). The only named profile route is `/players/h10`, marked Later.
3. `m_0386` (Tier 2) is two unpaired STATSports exports ("earlier season" and "current season"), a vendor-switch scenario. The brief did not say what unpaired sources look like, so this is a guess.
4. Library "Last opened" was dropped from the table to avoid horizontal scrolling at 1440 px. It remains on cards and in the sort model.
5. The 25 Hz feed is synthetic. The engine computes control surface, value and decision quality from them. Numbers are internally consistent (the explain card's ratio is recomputed from the listed alternatives) but are not football analytics.
6. Half-time is a real gap in the clock, skipped at 8× speed. Speeds above 10.5 m/s are clamped in the engine so the half-time jump does not produce teleport spikes.

Ambiguities and contradictions

1. "No free-form AI numbers" against a conversational answer: Ask text is composed from cited events, and counts and times are read from those events. The summary shows an explicit note stating that no figures were calculated by the language model. The mock does this by construction. A real system would need a templating layer that rejects any numeral not present in a cited event.
2. Tier 2 and Tier 3 are shown locked and In development, yet the parity gate must still explain what a second source would unlock. The ladder describes them and tags them In development. The "Add another source" button opens the Add data flow and "Tell me when this is available" only shows a toast, so no promise of a date is made.
3. Contrast and "restrained" pull against each other for Degraded and Blocked marks. Both are dim by design but still above 4.5:1.
4. Danger and warning share hues with two decision-quality bands (see section 2).

Hard to implement faithfully

1. A real parity report needs per-metric provenance from the pipeline. Here it is a static profile per match (`parity-profiles.json`).
2. Citation verification is simulated: the progress animation is real, the check is not.
3. Print: the brief's print view is a styled page with a print button. Pagination and PDF fidelity across browsers were not verified.
4. Pitch replay performance was measured at about 48 frames per second in a software-rendered headless Chrome with three overlays on, but not on real hardware or in Safari.
5. Glyph coverage was checked in the screenshots for the characters the product uses (÷, ×, ≥, →, –) and renders in Geist and Geist Mono.
6. Screen-reader behaviour of the canvas is minimal: the pitch is a single image with a text label and the timeline is a slider, but players are not individually focusable. The event list and player table carry the same information in accessible form.

## 5. Visual directions considered and rejected

1. **Light analyst desk, in the marketing site's white and blue.** Rejected: it reads as the website rather than a tool, and glare is wrong for long film sessions.
2. **Broadcast graphics, with saturated team colours, glow and large type.** Rejected: it merges team, heat and status into one loud channel and sounds like hype.
3. **Spreadsheet terminal, monospace everywhere in amber on black.** Rejected: it suits traders, not coaches, and leaves no room for the plain-language reasons the Parity Report depends on.

## 6. Review changes (15 November 2026)

Changes made after the first design review. The backend is not connected yet; everything is still mock data.

1. **Decision quality follows the engine.** Bands are the engine's (`ANALYTICS_SPECIFICATION.md` 7.1): Poor below 0.55, Suboptimal 0.55 to 0.79, Good 0.80 to 0.94, Optimal 0.95 and above, unified across passes, carries and intercepted passes. The score is the value at arrival divided by the best option at release, clipped to 0 to 1.5, so it can exceed 1.0 when a run improved the outcome. The explain card shows a 0 to 1.5 scale with the cut-offs marked and explains any score above 1.0. The mock generator supports this (`arrival` on a key event); `evt_41207` is the example above 1.0. Key events were re-scripted so the brief's band wording still matches; event ids, times and positions are unchanged.
2. **Citation chips lead with the moment.** A chip reads `07:48 · Pass, Home 5 to Home 6 · 0.94`. The event id moves to the hover preview, the accessible name and the printed brief, so the citation rule (`event_id`, timestamp, confidence) is still met. Where a caption already describes the action (Ask playlist), the chip is compact.
3. **Plain names.** "Parity report" is now **Data check** everywhere, matching Ask. Tiers are named by sources: **One source**, **Two sources**, **Paired sources**, with a hover hint. Full, Degraded and Blocked keep their names.
4. **Labelled counts.** The unlabelled `10 / 3 / 1` strip is replaced by `10 Full · 3 Degraded · 1 Blocked` with the parity marks, in the library and the match header.
5. **Data check page rolls up.** A family badge states the common case; a metric repeats a badge only when it differs, and drops its title when it would only repeat the family name.
6. **Replay.** The legend keeps every slot (dimmed when off), so toggling overlays no longer resizes the pitch. With Value on, control is drawn only where one team clearly controls a zone; confidence outlines only clearly uncertain zones. Player markers and numbers are larger. A disabled video button marks where a club-video link will go.
7. **Library.** Error messages wrap in full instead of truncating. Two-source and paired-source matches show **Data checked**, not Ready, with "Brief and replay in development".
8. **Navigation.** The "Coming later" group is hidden (`SHOW_LATER_NAV` in `AppShell.tsx`); the routes remain.

Not changed: tokens, contrast (98 pairs re-verified, none failing), the three colour collisions and the three visual channels.

## 7. Visual redesign to the founder's references (16 November 2026)

References: a calm tool UI (neutral near-blacks, white primary buttons, generous type, lists with dividers, soft filled tiles, thin icons, one gradient flourish on the AI input) and a set of simple, high-impact components (one big figure with a small label, pill steppers, white selected pills). The analytics system is unchanged: Data check marks, decision-quality colours and scale, team colours, the confidence channel and the naming rules.

1. **Palette:** neutral near-black (`#161616`, `#1c1c1c`, `#242424`, `#2a2a2a`) instead of cool navy. Panels are fills; outlines removed from panels, cards, tags, inputs and selects. Dashed outlines remain where they carry meaning (event-only estimates, low confidence, in development).
2. **Primary button:** white fill, near-black label. Blue is state only.
3. **Type:** Geist throughout, one step larger (body 14 px); the old mono class now means Geist with tabular figures; Geist Mono kept for code. The 33 uppercase mono labels became sentence-case labels.
4. **Components:** decision quality as a 40 px figure tile in the replay; larger Data check counts; a pill stepper in Add data; white selected pills for saved views; 1.5 px icons; softer radii.
5. **The one flourish:** the Ask composer has a blue to rose-red gradient edge (`--flourish-start`, `--flourish-end`).
6. **Two CSS bugs fixed:** unlayered `button { color: inherit }` and `* { border-color }` rules were overriding Tailwind utilities (the primary label colour and every `border-transparent`). Both now sit in `@layer base`.

Contrast: 104 pairs checked, none failing (surface 3, quiet text, link blue and the Poor band were adjusted; the white button label pair was added).
7. **Follow-up rounds (16 November 2026):**
   - Brief title on one line with the score dimmed; Data check as progressive disclosure (facts as one line, three big-figure count tiles, families as one collapsed list with a one-line reason when not Full, detail on click); the second-source panel reduced to a heading, three rows with a white "This match" pill and grey "In development" pill, one sentence and one action, at two type sizes.
   - Library: "One source" as quiet text; the sources badge only for multi-source matches.
   - Replay: overlay toggles as pills with swatches (shortcuts in tooltips); one-row legend with explanations in tooltips; the working formula under "How this is calculated"; explain tiles as fills (dashed edge kept for low confidence).
   - Match header: provider in the subtitle; active tabs underline in white; segmented controls as pill groups; timeline strip as a fill.

## 8. Second redesign: the "Davis" reference (16 November 2026)

The founder chose a new reference to adopt in full, keeping only Ponta blue as the brand colour. It supersedes parts of section 7.

1. **Palette:** cool near-black from the reference: background `#0E1116`, surface `#16191E`, raised `#1D2127`, popover `#24282E`, foreground `#FCFDFF`. Cards are a lighter surface with a faint edge (white 6%).
2. **Type:** Inter for all text; **Source Serif 4** (self-hosted, OFL) for page headings: Matches, the Data check, the Brief title, Ask, Add data steps, Settings, the match page.
3. **Action colour:** Ponta blue fills primary buttons and the send button again (replacing section 7's white primary). The fill is `#1A6EF0`, the brand blue nudged so a white label passes AA (4.6:1); `#1E76FA` stays for focus, selection and graphics.
4. **Ask:** centred serif heading over the composer; the composer has a thin blue-tinted edge (replacing the gradient), a square blue send button and the match picker in its toolbar; topic chips with icons below; a soft blue horizon glow. Answers open with a collapsible step list (read the data check, moments found, citations verified) with double checks; the data-check step opens when anything is limited.
5. **Tables:** a filled, rounded header row and plain rows with a hover fill, no dividers.
6. **Unchanged:** analytics colours (teams, decision-quality bands, Data check marks, confidence), the naming rules and every honesty rule.

Contrast: 104 pairs, none failing.

## 9. Coverage (brief v2, 5.2)

A metric can be Full while some decisions go unscored. The Data check carries a fourth tile, the share of passes and carries scored, and one plain line beneath the tiles listing why the rest were not (ball not detected, goalkeeper, set piece, outside tracked frames), ending "Findings use the scored decisions only." The brief header and the print view show the same figure and line. A low share is stated in the same neutral text as a high one: no warning colour, no alert, no threshold. The pre-processing check in Add data leaves coverage out, because it is measured during analysis. Sources without tracking show "Not measured". Mock figures sit on `Match.coverage`; the SkillCorner mock stays close to the 95.4% the engine measured on the real sample, and `m_0372` (21.4% of frames dropped, about 20 minutes) is the low-coverage example.

## 10. Reference details (16 November 2026)

- **Tinted label pills.** Parity and decision-quality badges are rounded pills with a low fill in their own hue and no hard edge. The parity icon still carries the state by how full it is; Blocked keeps a faint outline because it has no fill. The estimate band keeps its dashed edge. Band text was nudged (dark Poor `#f87c5e`; print Poor `#a8341a`, Suboptimal `#855300`) so every pill passes 4.5:1 on its tint; the pairs are in `docs/contrast.md`.
- **Selected state.** A selected event (Replay) and thread (Ask) take the accent tint with a 2 px blue underline. Hover and keyboard cursor stay grey, so selection is the only blue row. *(Revised 16 November 2026: dropdown options no longer take it; the chosen option is marked by its check only, on the same grey hover as every other menu.)* *(Revised again 16 November 2026: retired everywhere. The open conversation and the selected Replay event now use grey highlights, like the rail; the Replay row is one grey step above hover and the playhead row.)*
- **Icon tiles.** The Add data sample cards lead with a 40 px blue-tinted icon tile, one icon per kind of data, and an arrow that brightens on hover.
- **Chart style.** Pass decision quality on the player sketch is a column chart: one neutral series, the most common band in blue, 4 px rounded tops on a shared baseline, dashed gridlines, a direct count and share per column, a hover tooltip and a screen-reader table.
- **Sign-in** sits in one card on the Ask screen's blue horizon. **Settings** uses two-column rows (label and help left, control right), pill squads, a card footer for Save, and one "Your data" card for export and deletion.

## 11. Names in the client (brief v2, 5.1)

- **Codes everywhere below the client.** Brief text carries reference tokens (`{home_5}`); events, alternatives and Ask playlists carry team and shirt number. Nothing in the mock text hard-codes a player label any more.
- **One resolver.** `src/lib/names.tsx`: `WhoProvider` sits on the match layout, the print brief, each Ask turn and the player sketch; components read `useWho()`. With names on, a player in the roster shows by name; anyone missing (or a team with no roster) falls back to the code, "Home 5".
- **Rosters** (`src/mock/rosters.json`, served by `getRosterSync`) are fictional and per team: Harlow Athletic and Brackenridge Town in full, Stoneford Rovers partly (to show the fallback), the rest none. They include names over 24 characters, diacritics, and Cyrillic, Japanese, Arabic and Greek scripts.
- **Toggle:** Players, Show names / Show codes, in the account menu (Radix radio items). The choice is per viewer and kept in this browser.
- **Layout rules:** chips and list rows truncate with the full name on hover; the alternatives and player tables use fixed numeric columns so a name never moves a figure; the pitch callout cuts at 24 characters; pitch markers keep shirt numbers.
- **Screenshots:** `npm run shots` captures names on; `npm run shots -- --codes` captures the same set with codes into `docs/screenshots/codes`. Both runs check for horizontal page overflow.
- **Not covered:** the shareable match page renders engine output directly and shows codes; adding a roster to it is a decision for the concierge step, not done here.

## 12. Fixes from the review (brief v2, 5.4)

1. **Status colours.** `--danger` was the same orange-red as Poor, and `--warn` was identical to Suboptimal (`#f29d2e`). Danger is now magenta `#f05bb4` and warn violet `#a78bfa`, with print values `#b0237a` and `#6544c9`. Checked with the dataviz palette validator on the dark surface: danger against Poor, the home crimson and warn, and warn against Suboptimal and the brand blue, all clear the 15 dE normal-vision floor and the 8 dE colour-blind target (lowest: danger and warn 11.5 protan). Status always ships with an icon and a word. Contrast: 147 pairs pass.
2. **Print.** The print brief is a one-cell table whose `<thead>` holds the logo bar and match line, so it repeats on every printed page; `@page` adds "Page n of m" and keeps the page and its margins white; chips, pills and cited-moment rows do not split. **Verified in Chrome 157** by rendering the m_0412 brief to PDF in both name modes (3 pages, header on each, page numbers present, no split chips). **Not verified in Safari:** Playwright cannot print from WebKit, and Safari does not support `@page` margin boxes, so expect no page numbers there; whether its `<thead>` repeats needs a manual check.
3. **Pitch keyboard path.** The pitch is one focusable group; while it has focus, the left and right arrows step to the previous or next event (elsewhere they still step frames). A single always-mounted live region in the explain card announces "Selected. Pass, A to B. 34:12. Decision quality 0.64, Suboptimal" instead of reading out the whole card. Tested in Chrome: the selection, the URL and the announcement follow the arrows, and focus stays on the pitch. The player table remains the accessible view of player values.
4. **Video slot.** The disabled Video button next to "Play from 5 s before" stays. Settings, Data connections has a "Linked video source" row marked In development, with a disabled Connect. No player is designed.
5. **Data check reasons, audited.** Every Degraded or Blocked row in all six profiles names a cause. Seven Degraded rows had no measured figure, and one was vague ("in some events"): broadcast pass alternatives, carry alternatives, control zones and off-ball runs; unpaired GPS distance, high intensity and load trend. Each now carries a mock measured figure (for example "Ring incomplete for 11.4% of passes", "Overlap: 38 of 94 minutes"); the engine will measure them. Blocked rows rely on a named missing input, which is the cause.

## 13. Ask inside a match (16 November 2026)

- **A panel, not a page.** The match tab bar ends with an Ask toggle. The panel (`src/components/ask/AskPanel.tsx`) keeps its state while the user moves between Data check, Brief and Replay; it is keyed by match, so another match starts closed.
- **Where it sits.** Data check and Brief: docked on the right at 420 px; the content area is a size container, and both pages drop to one column below 1060 px (the Brief keeps its actions as a row above the brief). Replay: the third side tab (Events, Players, Ask); the explain card shrinks to its header and rating with a Details toggle, so the pitch keeps its width.
- **Context.** "Ask about this point" (brief) and "Ask about this moment" (explain card, and the panel's empty state on Replay) prefill the composer and attach a removable chip. The question carries the cited event ids; the mock engine answers from exactly those moments (a single moment adds the same team's passes and carries in the 20 seconds before it). Fatigue and medical questions are refused whatever the context.
- **Answer layout.** One renderer for page and panel (`src/components/ask/parts.tsx`). In the panel, moments are a numbered list of citation chips; clicking one opens Replay at that moment with the conversation still open.
- **Threads.** The panel and the Ask page share one store; the panel lists earlier conversations about the match and links each to the full page.
- **Pseudonymised questions.** `toRefs` turns roster names and code labels back into tokens before a question is stored; titles, questions and answer summaries are shown through `fillRefs`. Checked: a typed question with two names reads back as "Home 10 and Home 8" in codes mode.
- **Accessibility.** The brief's per-point buttons are named "Ask about this point"; the panel is a labelled region; the composer focuses when the panel is opened with a prefill.
- **Text size (revised):** in the panel everything is 13 px on a 20 px line: the composer (with a 28 px send button), the question bubbles, the answer summary, the step list, playlist heading, thresholds, follow-ups and the refusal card (its title 14 px). The full Ask page keeps its sizes (15 px summary and composer, 14 px elsewhere).
- Screenshots: `24c` (panel open on the brief), `24d` (a brief point answered), `24e` (a moment answered on Replay), in both name modes.

## 14. Field focus (16 November 2026)

Text inputs and dropdown fields show focus the way the Ask composer does: their own 1 px edge turns Ponta blue, with no outer ring. The 2 px offset ring stays for buttons, links, tabs, rows and other controls, where there is no field edge to light up. Dropdown and menu options show focus as their grey highlight, and the chosen option is marked by its check only.

## 15. Conversations list on the Ask page (16 November 2026)

The old threads column kept earlier choices: a grey column with a hard edge, a bordered header with a small "Threads" label and a boxed "New thread" button, two-line titles in one flat list, and the blue tint with underline for the open thread. It now matches the shell and the match panel:

- It sits on the page background with a hairline edge, 264 px wide.
- One full-width **New conversation** action at the top, then **Search conversations** (filters by title and match).
- Grouped by day: Today, Yesterday, Previous 7 days, Older (against the prototype's fixed "now").
- Each row is one 13 px title line (full title on hover) and a quiet line with the opponent and time.
- The open conversation takes the grey highlight the rail uses; no coloured fill or underline.
- "Threads" is now "Conversations" everywhere, matching the panel's "New conversation".
