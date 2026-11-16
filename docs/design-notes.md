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
