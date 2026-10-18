export type ChallengeSheetState = "collapsed" | "expanded";

const SHEET_SNAP_OFFSET = 72;
const SHEET_SNAP_VELOCITY = 500;

export function resolveChallengeSheetState(
  currentState: ChallengeSheetState,
  offsetY: number,
  velocityY: number,
): ChallengeSheetState {
  if (
    offsetY >= SHEET_SNAP_OFFSET ||
    velocityY >= SHEET_SNAP_VELOCITY
  ) {
    return "collapsed";
  }

  if (
    offsetY <= -SHEET_SNAP_OFFSET ||
    velocityY <= -SHEET_SNAP_VELOCITY
  ) {
    return "expanded";
  }

  return currentState;
}
