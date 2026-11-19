# Match page payload

The shareable match page (`match-page.html`, `src/match-page/`) renders from one JSON payload. It is the deliverable for a founder-run "concierge" pilot before the AI layer exists: a prospect sends one export, and Ponta returns this page. Brief: `ponta-blueprint/frontend-design-brief-v2.md`, section 5.3.

## Producing a page

1. In `ponta-platform`: `python tools/match_page_payload.py skillcorner --out /path/outside/repos/page.json` (or `metrica`). Optional `--notes notes.txt` adds analyst notes, one paragraph per blank-line-separated block.
2. Here: `npm run build`, then `npm run export:match-page -- /path/outside/repos/page.json /path/outside/repos/page.html`.
3. The HTML file is self-contained (scripts, styles, fonts and payload inlined) and opens from disk with no network.

`npm run build` also writes `dist/match-page-sample.html` from `src/match-page/sample-payload.json`, which is produced by the same exporter on a synthetic ten-second match with fictional players.

**Real payloads stay out of every repository.** They are derived from licensed or unverified sample data; both the exporter and this document assume an output path outside the repos.

## What the page does not contain

No generated prose: there is no AI layer yet, and the page says so. No player names: players are codes (`home_10`); names stay with the club. Moments are selected by stated rules, never by a model.

## Shape

Types: `src/match-page/types.ts`. Field names in moments follow the semantic event schema (`ponta-blueprint/ai-layer.md`); the data check is the Parity Report's `to_dict()` (`matrix_engine/parity.py`).

| Field | Meaning |
|---|---|
| `payload_version`, `schema_version`, `engine_version`, `generated_at` | Provenance. `engine_version` names both engines. |
| `sample_data` | True when the page shows sample data; the page then says so in its header. |
| `match` | `match_id`, `provider`, `home`, `away` (team labels, not names), `duration_min`, `sample_rate_hz`, `pitch` (`length_m`, `width_m`). |
| `data_check` | The Parity Report: `mode`, `summary` (counts per state), `coverage`, and `metrics`: per metric `family`, `label`, `state` (`full`, `degraded`, `blocked`), `reason`, `measure`, `unlock`. |
| `coverage` | `decisions_total` and `decisions_scored` (passes and carries), `scored_share`, `not_scored_causes` (`goalkeeper`, `set_piece`, `no_score_from_engine`), `ball_detected_share`, `player_observation_share`. |
| `moment_groups[]` | `id`, `title`, `rule` (shown on the page), `moments[]`. |
| `moments[]` | One semantic event each: `event_id`, `event_idx`, `timestamp_s`, `minute_display`, `period`, `actor_player_ref`, `actor_team`, `action_type`, `action_outcome`, `target_player_ref`, `inferred_intended_ref`, `inference_confidence`, `dq_score` (0 to 1.5), `dq_band`, `chosen_option_pov`, `best_option_player_ref`, `best_option_pov`, `xt_delta`, `movement_value`, `opposition_pressure` (engine scale 1 to 10), `pitch_zone`, `ball_detected`, `players_observed`, and `snapshot`. |
| `snapshot` | Positions at the event's start frame for drawing only: `frame`, `players[]` (`ref`, `team`, `x`, `y` in centred metres, home attacking +x), `ball`, `start`, `end`. Coordinates are for the page; they never enter an AI prompt. |
| `notes[]` | Analyst notes, written by a person, labelled as such. |
| `statement` | The provenance sentence shown under the title. |

## Moment rules (current)

| Group | Rule |
|---|---|
| Lowest-gain decisions under pressure (`low_gain_under_pressure`, was `poor_under_pressure`) | Passes and carries with Low gain or Partial gain under 1v1 pressure of 7 or more, lowest first |
| Passes that lost the ball | Failed passes the engine scored, highest pressure first |
| Best decisions that moved the ball forward in value | Completed passes and carries with Full gain and a positive value change, largest first |
| Most valuable off-ball runs | Movements with a positive engine run bonus, highest movement value first |

Four per group. The pressure figure of 7 is a selection rule for this page, not a product threshold; the engine defines none yet.
