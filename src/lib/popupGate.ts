/**
 * At most one pop-up per visit ("Notifications, widgets, interface and unlocks": cap the login pop-up stack and
 * put the most valuable item first). Everything else waits inline on the home screen.
 */
let used = false;

export function claimPopup(): boolean {
  if (used) return false;
  used = true;
  return true;
}

export const popupUsed = () => used;

/** For tests. */
export const resetPopupGate = () => {
  used = false;
};
