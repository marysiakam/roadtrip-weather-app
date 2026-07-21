/**
 * Marks an error as caused by something the user can fix themselves (a typo,
 * an address with no nearby road, two places that aren't connected by road) —
 * as opposed to a system failure (network issue, missing API key, upstream
 * outage). The client uses this to pick a calm vs. alarming banner tone.
 */
export class UserFacingError extends Error {
  constructor(message) {
    super(message);
    this.userFacing = true;
  }
}
