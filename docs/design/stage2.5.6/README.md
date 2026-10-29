# stage2.5.6 — local fluid-glass sheets

Parent and authority: [governance/STATE.md](../../../governance/STATE.md), stage2.5.6, derived from stage2 reconstruction; the transparency follow-up below belongs to stage2.5.6.1. Scope: the user's2026-10-29 request to apply the latest collection's fluid-glass material to More, records, AI and related sheets, followed by adjustable transparency. This is a bounded implementation/evidence record, not a parallel plan. Design owner: [DESIGN.md](../../../DESIGN.md), candidate revision27, extending revisions25/26 through stage2.5.6.2 below. Revision26 is checkpointed at a616d660; the new visual refinement awaits user acceptance. Earlier entries preserve their original evidence boundaries.

## Source and implementation

Inspected upstream main: [adc4f29fc8c471de49bfc7c08ccda8fe7a698868](https://github.com/huaixuanhu/My-design-system-collection/tree/adc4f29fc8c471de49bfc7c08ccda8fe7a698868/systems/fluid-glass/project). Read the system README, component examples, material CSS/JavaScript and design/token definitions. Local files and upstream blob identities are recorded in [SOURCE.md](../../../client/src/vendor/fluid-glass/SOURCE.md). No live CDN dependency, new package or additional scene renderer is introduced.

- Regular glass shell, pearl controls, one opaque reading/editing ground; shared light/dark tokens with panel-only namespace.
- More480px; reading forms660px; bounded mobile width, internal scrolling,22px shell/14px paper radii and quieter spacing.
- 380ms opening and300ms closing. Shell transform is separate from child opacity, preserving access to live backdrop pixels. Reduced motion settles immediately.
- Optical maps use layout dimensions instead of animated screen bounds. Bevel-only reflection fixes a faint diagonal seam observed in the larger initial adaptation.
- Existing cards, room, dock, camera, reading state, saved schema and provider controls are unchanged. Input fields and paid actions retain existing labels, locks and explicit confirmation behavior.

## Verification

`pnpm check:all` passed: governance structure, TypeScript, compiled access/record/AI/random entrypoints,15 access +132 gameplay/motion +44 record +58 AI +65 randomness tests =314, and production build. The existing large-client-chunk advisory remains; no new dependency was added. This gate does not itself prove visual quality.

Actual Chromium browser at `http://127.0.0.1:5175/`, using `pnpm dev:ai-preview 5175`:

- Day/night More and AI sheets render with live backdrop lens; normal and reduced sheet motion, navigation and close controls exercised.
- Three cards drawn/revealed: Ten of Cups upright, Five of Disks reversed, Three of Cups reversed. Questions and three position labels remain through panel/theme changes.
- One simulated Terra result completes; save attaches it to one in-memory record. History/detail preserve question, labels, orientations, notes, spread positions and simulated interpretation.
- Fixture counters after the flow: `calls:1`, `attempts:1`, `records:1`, `randomCalls:0`. These are local fixture counts, not external provider/database evidence.
- Contextual help opens; first Escape removes help, second closes the sheet and returns focus to More. Closing content becomes inert immediately; settled navigation leaves one open sheet.
- 390×844 viewport: record panel366px wide at x12, internally scrollable; AI body scrollWidth equals clientWidth339px, with no horizontal overflow. Original viewport restored after verification.
- Browser error log is empty. No continuous material animation was introduced; quantitative frame-time and native-device profiling were not performed.

The preview reads no external credentials, calls neither ANU/OpenAI/Neon and uses disposable in-memory records. The retained real local/cloud quantum pools were not accessed. No production AI activation, shared-record write, commit, push or deployment occurred. All65 original generated-file fingerprints remain identical to the initial snapshot; final governance and whitespace checks pass.

## Rendered evidence and limits

Screenshots include the preview's explicit synthetic-data banner. It wraps over the very top of the390px view; that banner belongs only to the validation harness. Long content uses an opaque surface by the selected system's material-role rule. It intentionally does not receive live background distortion.

| View | Evidence |
| --- | --- |
| More, day | [more-day.jpg](more-day.jpg) |
| AI form, day | [ai-day.jpg](ai-day.jpg) |
| AI form, night | [ai-night.jpg](ai-night.jpg) |
| Saved record,390px | [records-narrow.jpg](records-narrow.jpg) |

The inspected desktop browser exercises the live-backdrop path. Other engines retain the source CSS blur/highlight fallback; Safari/Firefox, native mobile, assistive-technology and low-end performance qualification remain untested. Source compliance and these local checks do not establish pixel equivalence to Apple's native material or user acceptance.

## stage2.5.6.1 — transparency verification

The requested native slider controls the existing material fog parameter; increasing transparency decreases fog. Default32 retains0.68 fog, while the0/100 endpoints map to fog1/0. Only the preference is stored locally; no backend or new vendor-engine path was added. Text/controls keep full opacity and reading surfaces remain opaque. Pointer input updates once per frame; preference writes happen on change/reset.

Chromium checks: Home/End reach0/100; day veil alpha changes from0.9 to0 while shell opacity stays1. Keyboard70% survives a page reload; reset restores32. Night uses the same parameter while AI paper remains rgb(28,31,37). An entered question remains through transparency/theme/panel changes. At390×844, More's content width equals scrollWidth355px; the153px slider, percentage, reset and help all fit. Clicking the range midpoint produces50%. Contextual help and its Escape dismissal work; the original viewport is restored afterward. System reduced-transparency behavior is retained from the engine/source and was not separately exercised on a configured OS.

Fresh `pnpm check:all` passes the same314 tests, compiled runtimes and build. Browser fixture counters remain calls0, attempts0, randomCalls0, records0; no new generation, acquisition or save was needed for this presentation change. Screenshot: [transparency-day.jpg](transparency-day.jpg). Changes remain local and uncommitted.

## stage2.5.6.2 — panel coherence and appearance

Parent: STATE.md stage2.5.6.2, following the user's screenshot feedback. The requested prior checkpoint is a616d660. The new fixes are uncommitted. This entry supersedes the earlier opaque reading-ground treatment for the current candidate while retaining those historical observations.

AI and records now read directly on a continuous hazed glass shell. Their body background is transparent, without inset margin/radius/shadow; text-heavy shells retain a minimum haze even at100% transparency. Input surfaces and disabled actions are quieter. Appearance uses system/day/night native radios in one glass capsule. All round panel control icons are centered SVGs; whitespace/letter-spacing cannot offset their glyphs. The small transparency help ring regains the standard28px target. Menu/history hover no longer creates a white inset tile.

Final independent read-only review found no concrete blocker in the four changed product files; radio accessibility, preference updates, SVG labels and unchanged request paths were checked. Fresh `pnpm check:all` passes all314 tests, governance, TypeScript, compiled runtimes and production build (ignored log `.local/fluid-glass/check-polish.log`). Existing large-chunk advisory remains. Read-only audit and desktop Chromium observation confirm:

- AI and record body backgrounds are computed transparent. Day/night AI and day records were visually inspected; AI0/100 transparency retains continuous reading haze. No separate pasted white rectangle remains in these inspected views.
- System/day/night native radios respond to keyboard arrows, update selected/visible state and preserve the question draft. The existing appearance preference remains the only owner.
- SVG centers match button centers; measured offsets are0 within subpixel animation precision. Close, previous/next, zoom and transparency reset use the same treatment.
- At390×844, appearance spans x260.5–370.5 and does not overlap the wordmark (right146.9). AI body scrollWidth/clientWidth both355px; form controls remain available by internal scrolling.
- Current fixture counters remain calls0, attempts0, randomCalls0, records0. No provider or storage operation was needed. Restore original66% transparency and desktop viewport after checks; leave day AI preview open for review.
- All65 inherited generated-file hashes are unchanged. Product changes are limited to index markup, reading appearance binding and panel/appearance CSS; no AI prompt/backend/schema change.

Rendered evidence: [More/day](polish-more-day.jpg), [AI/day](polish-ai-day.jpg), [AI/night](polish-ai-night.jpg). The thin yellow banner belongs to the credential-free test harness.

Remaining bounded UI items: AI model/effort/budget retain native option popups, so popup styling varies by OS; labels and keyboard behavior remain reliable. Actual large saved readings and interpretation density should be revisited with the upcoming detail choices, rather than assumed solved by shell styling. Full Safari/Firefox, physical-phone, assistive-technology and quantitative contrast/performance qualification remain unperformed. No new user acceptance, further commit, push or deployment is claimed.
