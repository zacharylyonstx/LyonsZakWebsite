// The LOCKED matched camera pose from Task 7 — verbatim values from
// site/experiments/match/camera.json (cine mode's `P`-key output, matched
// against the hero photo from 10600's back deck). Do not retune here; the
// projector and the departure path's t=0 keyframe must stay this exact pose.
import type { MatchedPose } from './crossingMaterial';

export const MATCHED_POSE: MatchedPose = {
  pos: [4.8, 1.95, 47.4],
  look: [5.274412074794912, 0.28955773821781583, 67.32530714138622],
  fov: 66,
};

/** Hero photo aspect (IMG_1917: 4032x3024). The projector frustum uses this,
 *  never the viewport's aspect. */
export const PHOTO_ASPECT = 4 / 3;
