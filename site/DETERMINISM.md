# The film's determinism contract

Signed at the integration pass, 2026-08-30 (branch `v2`). This file is the
complete, closed inventory of every way a settled frame of LyonsZak.com is
allowed to differ from a pure function of `(journey t, viewport)`. Anything
not listed here is a bug: the full-journey byte sweep
(`scripts/qa.mjs tsweep`, videos pinned, stops steered per §2) must report
**maxDiff 0** at every stop except as §3 admits. No unsigned exceptions
exist.

**The law** (unchanged since the scaffold): native scroll is the only input;
scenes render from a damped journey value; settled frames are byte-stable
and reversible — scrub anywhere, come back, get the identical raster.

**Current verification**: 41-stop full-journey tsweep spanning all seven
scenes, both seams under cross-dissolve, and the crossing's own checkpoint
equivalents (swap p=0.2 at t=0.4506, reversibility stops p=0.14/0.26/0.31/
0.85) — byte-zero at 40/41 stops, the one non-zero stop being §3's ULP class
at t=0 (maxDiff 1, changedPct 0). Re-run against the production build in the
integration battery with the same result. Re-verified at the delight pass
(2026-08-30, 48 stops incl. the chat-reveal, porch-life, and carry-crossfade
windows): every new delight element is a pure function of (journey t,
viewport) — this inventory gained no new row (see
`.recon/reports/delight-pass.md`).

## 1 — The three silent ambient video loops (pinned, by design)

| Element | File | Why it exists |
| --- | --- | --- |
| THE WEIRD ONES' TV | `assets/weird/eas-broadcast.mp4` (63s, re-edited from the 82s source — dead-black stretches excised, splices inside black) | The fabricated EAS broadcast playing on the period TV — ambient motion is the scene |
| THE KEEPER's plaque | `assets/keeper/plaque-loop.mp4` (8s) | The real candle flame flickering on Luke's plaque — the flame is the point |
| TEASPANKS's frame (added 2026-09-01) | `assets/teaspanks/loop.mp4` (5.97s, cut from the master at 11.5s, `-an`) | The music video itself playing in its frame — Luke on the kit, Penny on the mic; the frame is the chapter |

All three are muted, looped, and **silent by construction** (`ffmpeg -an`; neither
delivered file carries an audio stream at all — nothing to unmute). They are
the film's only wall-clock pixels while the journey rests. Byte sweeps pin
them: `tsweep --pinvideo <seconds>` pauses every `<video>`, seeks the fixed
frame, raises `crossingDebug.videosPinned` (both scenes' per-frame `play()`
resumes stand down), and double-rAF-flushes so the VideoTextures re-upload
before capture. Reduced motion removes both `<video>` elements from the DOM
entirely and renders each scene's real still through the identical material.

## 2 — The pocket-glint CSS pulse (wall-clock, decorative, steered around)

`.pocket-glint`'s pulse/ring keyframes run on the wall clock (the mug/v1
precedent). Two windows of the journey show a live glint; byte-sweep stops
must not land inside them:

- **Gig glint** (THE BAND's drum kit, added 2026-09-01): t ∈ [0.5852, 0.6101]
  (on only while `gigOpacity ≥ 0.999`, band-local ≈ [0.07, 0.33])
- **Mailbox glint** (THE NEIGHBORHOOD street): t ∈ (0.5632, 0.5785]
- **TV glint** (THE WEIRD ONES): t ∈ (0.8435, 0.8761)

(Recomputed 2026-09-01 for the 17,200px pixel-weighted map — segments.ts:
street-local window `[0.7, 0.8, 0.93, 1.0]` of `[0.5276, 0.5785]`;
weird-local `[0.55, 0.62, 0.83, 0.89]` of `[0.7907, 0.8866]`. The JUKEBOX
and TEASPANKS pockets' own glints are parked off-screen and never given
opacity — their controls are the labeled pills, which carry no wall-clock
animation. Recompute these t-ranges if segments.ts or the rig windows ever
move.)

**Retro-diagnosis, closing scene5-report.md's open item:** the "pre-existing
t=0.615 boundary residue" (maxDiff 12–43, never twice the same, reproduced
on the base commit) sat INSIDE the old mailbox-glint window (t ∈ [0.6026,
0.648] under the pre-retune mapping) — it was this exception class caught at
an unsteered stop, not a texture-upload race. Evidence: after the
integration retune, the equivalent street-settle stops OUTSIDE the new glint
window (t=0.628, 0.634) are byte-zero across three independent
launch-to-launch runs. No separate "boundary residue" exception exists.

If the film ever needs glint-window frames swept byte-exact, drive the pulse
from the timeline instead of the clock.

## 3 — The drummer-range single-ULP driver class (signed, invisible)

At t ≤ ~0.08 (in practice: t=0 most runs, occasionally one or two nearby
stops; 40/41 stops byte-zero in the current sweep), the reverse-scrub frame
can differ from the forward frame by **exactly one pixel, one channel, ±1**
(maxDiff 1, meanDiff ~2e-7, changedPct 0 — invisible at any zoom).
Isolated in scene4-report.md: a round trip that never wakes the crossing is
byte-exact; after the crossing's FIRST live render the shell canvas settles
into a second **stable** raster state (repeat round trips are byte-identical
to each other) differing by one ULP on one drum-hardware fragment. That is
ANGLE/Metal cross-context rounding, not scroll-state leakage. The known fix
direction — a one-frame full-state warm render at boot — trades an edge-case
visible flash for a QA-only artifact, and is declined. Signed as accepted.

## 4 — Timing notes that are NOT exceptions (for completeness)

- **The drummer load settle** (1.1s camera ease at first paint): one-time,
  convergent (after it ends every frame is f(t)), skipped if the visitor has
  already scrolled and under reduced motion. Sweeps run after it.
- **Stop + interact media** (the record's 30s excerpt, both pockets'
  videos): user-gesture-started, journey held while a pocket is open — never
  running in a settled journey frame.
- **Cross-process captures are not comparable**: ANGLE/Metal float rounding
  differs between browser launches (low-amplitude full-frame noise, mean
  ~1/255). Determinism is defined and verified **same-session** — the only
  comparison `qa.mjs` ever makes.

## Amending this contract

A change that adds any wall-clock or cross-frame state must either make it a
pure function of journey t, or add a row here with the pinning/steering
mechanism the byte sweep uses — in the same commit.
