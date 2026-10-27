import { describe, expect, it } from "vitest";
import { PLAIN, speciesFor } from "../src/engine/species";

describe("Cozy species", () => {
  const all = [1, 2, 3, 4, 5, 6, 7].map(speciesFor);

  it("gives every colour its own temperament, so moods tell pieces apart", () => {
    expect(new Set(all.map((species) => species.temperament)).size).toBe(7);
  });

  it("mixes body shapes and surfaces: blobby, cloudy, angular, glassy", () => {
    expect(new Set(all.map((species) => species.shape))).toEqual(new Set(["blob", "squircle", "cloud", "angular"]));
    expect(all.some((species) => species.surface === "glass")).toBe(true);
    expect(all.some((species) => species.surface === "speckle")).toBe(true);
  });

  it("keeps the tongue-out face off rose, where a pink tongue would vanish", () => {
    expect(speciesFor(7).temperament).not.toBe("cheeky");
  });

  it("draws anything outside the seven colours as a plain body", () => {
    expect(speciesFor(8)).toBe(PLAIN);
    expect(speciesFor(9)).toBe(PLAIN);
  });
});
