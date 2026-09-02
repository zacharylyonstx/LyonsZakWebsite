#!/usr/bin/env python3
"""Semantic region masks for THE CROSSING's art-directed release pass (G1.1 Task 4).

Produces six grayscale masks of the LOCKED hero photo (IMG_1917) — kids,
trampoline+net, playhouse (incl. its furniture corner), canopy, sky, ground —
at full photo resolution, plus two packed RGB textures the crossing shader
samples at the projector UV:

    maskA.rgb = (kids, trampoline, playhouse)
    maskB.rgb = (canopy, sky, ground)

Method (per the task brief, in this order):
  1. depth thresholds from the 16-bit hero depth map (ground/canopy/sky bands),
  2. color keys (sky = bright + desaturated),
  3. HAND-AUTHORED polygon corrections everywhere automation is not enough —
     the kids, the trampoline enclosure, the playhouse corner, and the patio
     overhang are hand-drawn from visual inspection of the photograph. This is
     sanctioned art direction, not a general algorithm: these masks are for
     exactly this photograph and no other.

Masks are made DISJOINT by priority (kids > trampoline > playhouse > sky >
canopy > ground), then feathered; the leftover (fence, patio overhang, swing
set, mid-yard scraps) is the shader's implicit "rest" region (1 - sum).

Outputs land in the sandbox's gitignored public/ dir (like photo.jpg): the
photo shows the family and is never committed; masks are derived from it.
Run:  python3 tools/masks/make-masks.py     (from site/experiments/a2-crossing)
"""

from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, "..", ".."))
REPO = os.path.abspath(os.path.join(SITE, ".."))

# v2 (Scene 4, 2026-08-30): RESTORED from archive/2026-08-29-slice-attempt-1
# (site/experiments/a2-crossing/tools/masks/) and re-pointed at the v2
# sources. The hand-authored geometry below is UNCHANGED — it was tuned to
# IMG_1917's composition, and the v2 hero source
# (.recon/final/05a-backyard-hero-IMG1917.jpeg) is the same full 4032x3024
# frame. The photo input is the GRADED frame (the crossing's actual staged
# source): geometry doesn't care about the grade, but the sky COLOR KEY does
# — SKY_MIN_LUM/SKY_MAX_SAT re-verified against the graded frame via the
# probe printout + masks-preview composite (see scene4-report.md).
# Outputs land in .recon/final/ (gitignored) as nbhd-maskA/B.png, which
# prepare-assets.mjs stages to public/masks/.
SRC_PHOTO = os.path.join(REPO, ".recon/final/05a-backyard-hero-IMG1917-graded.jpeg")
SRC_DEPTH = os.path.join(REPO, ".recon/final/depth/05a-backyard-hero-IMG1917.depth.png")
OUT_DIR = os.path.join(REPO, ".recon/final")
PACKED_W, PACKED_H = 2048, 1536  # matches the photo.jpg working texture grid

# ---------------------------------------------------------------------------
# Hand-authored geometry (normalized photo coords, x right / y down).
# Read off grid overlays of the working photo — see the task report.
# ---------------------------------------------------------------------------

# The jumping/sitting kids: loose feathered boxes per figure (coarse on
# purpose — a clean hand box beats a noisy auto matte; the luminance-driven
# dissolve inside the region hides the box edges).
KID_BOXES = [
    (0.112, 0.462, 0.172, 0.592),  # white-shirt girl leaning right
    (0.126, 0.535, 0.192, 0.620),  # crouching kid below her
    (0.178, 0.440, 0.267, 0.610),  # orange-shirt boy + orange-tank girl (overlapping pair)
    (0.340, 0.482, 0.404, 0.612),  # pink-dress girl, arms raised
    (0.446, 0.516, 0.514, 0.607),  # two girls sitting on the far rim
]

# Trampoline + net enclosure: one polygon following the net's sagging top
# edge, the pole tops, the pad rim, the legs and the ladder.
TRAMP_POLY = [
    (0.048, 0.430), (0.056, 0.348), (0.080, 0.342), (0.090, 0.412),
    (0.134, 0.425), (0.138, 0.358), (0.154, 0.356), (0.162, 0.420),
    (0.236, 0.428), (0.240, 0.332), (0.260, 0.332), (0.266, 0.418),
    (0.278, 0.418), (0.280, 0.350), (0.338, 0.348), (0.344, 0.425),
    (0.455, 0.428), (0.462, 0.372), (0.478, 0.370), (0.484, 0.425),
    (0.498, 0.400), (0.502, 0.356), (0.514, 0.356), (0.518, 0.430),
    (0.522, 0.590),  # right rim
    (0.500, 0.660), (0.420, 0.690), (0.372, 0.730), (0.296, 0.730),
    (0.240, 0.700), (0.150, 0.700), (0.096, 0.685), (0.058, 0.655),
    (0.044, 0.600),
]

# Playhouse main box (roofline -> walls -> base).
PLAYHOUSE_POLY = [
    (0.540, 0.482), (0.600, 0.464), (0.720, 0.450), (0.843, 0.440),
    (0.862, 0.450), (0.862, 0.478), (0.854, 0.484),
    (0.854, 0.706), (0.838, 0.716), (0.640, 0.726), (0.548, 0.738),
    (0.538, 0.730),
]
# The play-corner furniture in front of / beside the playhouse crosses WITH it
# as one reveal (photo chairs/bench shrink-wrapped onto game ground would
# smear if they released with the lawn).
PLAYHOUSE_EXTRA_BOXES = [
    (0.570, 0.640, 0.648, 0.790),  # pinwheel walker / toys at the left corner
    (0.596, 0.618, 0.726, 0.805),  # red camp chair
    (0.758, 0.706, 0.840, 0.812),  # small red kid chair
    (0.784, 0.648, 0.930, 0.745),  # wooden bench
    (0.890, 0.652, 0.975, 0.730),  # toy crate / trucks
]

# Patio overhang + downspout (top-right foreground): excluded from canopy/sky
# so it stays in the "rest" region (it is the viewer's own porch, not canopy).
PATIO_POLY = [
    (0.618, 0.0), (1.0, 0.0), (1.0, 0.215),
    (0.880, 0.168), (0.800, 0.125), (0.720, 0.080), (0.660, 0.030),
]
DOWNSPOUT_POLY = [
    (0.778, 0.055), (0.802, 0.055), (0.828, 0.272), (0.800, 0.285),
]

# Fence top / ground top polylines (x, y) — linear between points.
FENCE_TOP = [(0.0, 0.488), (0.50, 0.490), (0.56, 0.464), (0.87, 0.436), (1.0, 0.422)]
GROUND_TOP = [(0.0, 0.598), (0.30, 0.615), (0.55, 0.625), (1.0, 0.635)]

# Sky color key + depth gates (tuned against the histogram printout below).
SKY_MIN_LUM = 0.78       # overcast sky is near-white...
SKY_MAX_SAT = 0.16       # ...and desaturated
SKY_MAX_DEPTH = 0.22     # and at far depth (depth map: near = bright)
CANOPY_MAX_Y = 0.56      # canopy zone never reaches below this


def polyline_y(pts: list[tuple[float, float]], xs: np.ndarray) -> np.ndarray:
    px = np.array([p[0] for p in pts])
    py = np.array([p[1] for p in pts])
    return np.interp(xs, px, py)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    photo = ImageOps.exif_transpose(Image.open(SRC_PHOTO)).convert("RGB")
    W, H = photo.size
    rgb = np.asarray(photo, dtype=np.float32) / 255.0

    depth_img = Image.open(SRC_DEPTH)
    depth_img = depth_img.resize((W, H), Image.LANCZOS)
    depth = np.asarray(depth_img, dtype=np.float32)
    if depth.ndim == 3:
        depth = depth[..., 0]
    depth /= depth.max() if depth.max() > 0 else 1.0  # near = bright

    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = np.where(mx > 1e-5, (mx - mn) / np.maximum(mx, 1e-5), 0.0)

    ys, xs = np.mgrid[0:H, 0:W]
    nx = xs / (W - 1)
    ny = ys / (H - 1)

    def poly(points, extra=()):
        im = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(im)
        if len(points) >= 3:
            d.polygon([(p[0] * (W - 1), p[1] * (H - 1)) for p in points], fill=255)
        for b in extra:
            d.rounded_rectangle(
                [b[0] * (W - 1), b[1] * (H - 1), b[2] * (W - 1), b[3] * (H - 1)],
                radius=0.012 * W, fill=255,
            )
        return np.asarray(im, dtype=np.float32) / 255.0

    def boxes(bs):
        return poly([(0, 0)], extra=bs) if bs else np.zeros((H, W), np.float32)

    # diagnostics for threshold tuning
    sky_probe = (ny < 0.30) & (nx < 0.14)
    canopy_probe = (ny < 0.35) & (nx > 0.42) & (nx < 0.60)
    print(f"probe sky   lum {lum[sky_probe].mean():.3f}  sat {sat[sky_probe].mean():.3f}  depth {depth[sky_probe].mean():.3f}")
    print(f"probe leaf  lum {lum[canopy_probe].mean():.3f}  sat {sat[canopy_probe].mean():.3f}  depth {depth[canopy_probe].mean():.3f}")

    # ---- raw regions ------------------------------------------------------
    kids_raw = boxes(KID_BOXES)
    tramp_raw = poly(TRAMP_POLY)
    play_raw = poly(PLAYHOUSE_POLY, PLAYHOUSE_EXTRA_BOXES)
    patio = poly(PATIO_POLY)
    patio = np.maximum(patio, poly(DOWNSPOUT_POLY))

    fence_y = polyline_y(FENCE_TOP, nx)
    ground_y = polyline_y(GROUND_TOP, nx)

    sky_raw = (
        (lum > SKY_MIN_LUM) & (sat < SKY_MAX_SAT) & (depth < SKY_MAX_DEPTH)
        & (ny < CANOPY_MAX_Y) & (patio < 0.5)
    ).astype(np.float32)

    canopy_raw = ((ny < fence_y) & (patio < 0.5)).astype(np.float32) * (1.0 - sky_raw)

    ground_raw = (ny > ground_y).astype(np.float32)

    # ---- disjoint by priority --------------------------------------------
    order = [
        ("kids", kids_raw),
        ("trampoline", tramp_raw),
        ("playhouse", play_raw),
        ("sky", sky_raw),
        ("canopy", canopy_raw),
        ("ground", ground_raw),
    ]
    taken = np.zeros((H, W), np.float32)
    final: dict[str, np.ndarray] = {}
    for name, raw in order:
        m = np.clip(raw - taken, 0.0, 1.0)
        taken = np.clip(taken + m, 0.0, 1.0)
        final[name] = m

    # ---- feather + renormalize -------------------------------------------
    fr = max(2, int(round(W * 0.004)))  # ~16px at 4032: soft but local
    for name in final:
        im = Image.fromarray((final[name] * 255).astype(np.uint8))
        final[name] = np.asarray(im.filter(ImageFilter.GaussianBlur(fr)), np.float32) / 255.0
    total = sum(final.values())
    scale = np.where(total > 1.0, 1.0 / np.maximum(total, 1e-6), 1.0)
    for name in final:
        final[name] *= scale

    # ---- outputs ----------------------------------------------------------
    # Per-region grayscale masks + the inspection composite go to a
    # subfolder (diagnostics); only the two packed textures live at the
    # .recon/final/ top level, where prepare-assets.mjs's staging map reads.
    diag_dir = os.path.join(OUT_DIR, "nbhd-masks")
    os.makedirs(diag_dir, exist_ok=True)
    for name, m in final.items():
        Image.fromarray((m * 255).astype(np.uint8)).save(os.path.join(diag_dir, f"{name}.png"))
        print(f"{name:10s} coverage {m.mean() * 100:5.1f}%")

    def packed(names):
        # Area-averaged (BOX) downsample, NOT Lanczos (fix round 1, G1.1 Task
        # 4 review finding): BOX resampling is a true convex combination —
        # every output texel is a weighted average of source texels with
        # non-negative weights summing to 1, applied identically across the
        # three stacked channels. Since the per-pixel mask-channel sum is
        # <=1 everywhere at native resolution (the renormalization above),
        # a convex combination of <=1 values is itself <=1 — the resampled
        # sum stays <=1 BY CONSTRUCTION. Lanczos's sinc kernel has negative
        # lobes (that's the ringing that sharpens edges), so it is not a
        # convex combination and can overshoot above 1 locally at a hard
        # mask boundary. (The shader also clamps `keep` to 1.0 as a second,
        # independent guarantee — this change removes the only known way the
        # clamp could actually have to do work.)
        arr = np.stack([final[n] for n in names], axis=2)
        im = Image.fromarray((arr * 255).astype(np.uint8))
        return im.resize((PACKED_W, PACKED_H), Image.BOX)

    packed(["kids", "trampoline", "playhouse"]).save(os.path.join(OUT_DIR, "nbhd-maskA.png"))
    packed(["canopy", "sky", "ground"]).save(os.path.join(OUT_DIR, "nbhd-maskB.png"))

    # color-coded inspection composite over the photo
    colors = {
        "kids": (255, 40, 40), "trampoline": (255, 180, 0), "playhouse": (60, 120, 255),
        "canopy": (40, 200, 80), "sky": (0, 220, 220), "ground": (180, 60, 220),
    }
    overlay = rgb.copy()
    for name, m in final.items():
        c = np.array(colors[name], np.float32) / 255.0
        overlay = overlay * (1 - 0.55 * m[..., None]) + c * 0.55 * m[..., None]
    prev = Image.fromarray((overlay * 255).astype(np.uint8))
    prev.resize((PACKED_W, PACKED_H), Image.LANCZOS).save(os.path.join(diag_dir, "masks-preview.png"))
    rest = np.clip(1.0 - sum(final.values()), 0.0, 1.0)
    print(f"{'rest':10s} coverage {rest.mean() * 100:5.1f}%  (implicit)")
    print(f"wrote masks -> {OUT_DIR}")


if __name__ == "__main__":
    main()
