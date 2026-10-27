import type { Settings } from "../stores/useMetaStore";

/** The Cozy look is the default; saves from before the setting existed have no value and get it too. */
export const isCozy = (settings: Pick<Settings, "look">) =>
  settings.look !== "classic";
