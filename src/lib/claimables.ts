/**
 * What is genuinely waiting for the player: the only things that earn a dot on a tab or a number on the app icon.
 * Nothing is badged just to pull attention (no "new offer" dots, no dots on the shop or store), and vacation mode
 * turns them all off.
 */
export interface Claimables {
  calendar: number;
  giftBox: number;
  challenges: number;
  weekly: number;
  crewMilestones: number;
  pass: number;
  welcomeBack: number;
}

export const totalClaimables = (c: Claimables) => Object.values(c).reduce((a, b) => a + b, 0);
