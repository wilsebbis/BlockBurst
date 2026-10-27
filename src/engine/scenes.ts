/**
 * Scenery for the Cozy look: soft pastel places for the creatures to live in, each with its own weather and a
 * little outfit they wear while they're there (snorkels at the beach, beanies in the snow, propeller hats up in
 * the sky, bonnets and dummies in the nursery). Calm first: muted colours, slow drifting weather, nothing that
 * competes with the board. Purely visual: nothing here reads or changes the rules.
 */

export type SceneId = "meadow" | "forest" | "pond" | "beach" | "underwater" | "caverns" | "mines" | "snow" | "sky" | "nursery" | "twilight";

export type WeatherKind = "petals" | "leaves" | "rain" | "sparkle" | "bubbles" | "motes" | "snow" | "clouds" | "fireflies";

export type Accessory = "flowers" | "mushroom" | "rainhat" | "snorkel" | "helmet" | "crystal" | "hardhat" | "beanie" | "propeller" | "bonnet" | "nightcap";

/** How a scene's line clears burst: in its own little things, mixed in with the stars. */
export type ClearBurst = "petal" | "leaf" | "drop" | "sparkle" | "bubble" | "crystal" | "flake" | "puff" | "heart" | "firefly";

export interface Scene {
  id: SceneId;
  name: string;
  emoji: string;
  weather: WeatherKind;
  accessory: Accessory;
  burst: ClearBurst;
}

export const SCENES: readonly Scene[] = [
  { id: "meadow", name: "Wildflower Meadow", emoji: "🌼", weather: "petals", accessory: "flowers", burst: "petal" },
  { id: "forest", name: "Whispering Forest", emoji: "🌲", weather: "leaves", accessory: "mushroom", burst: "leaf" },
  { id: "pond", name: "Rainy Pond", emoji: "🌧️", weather: "rain", accessory: "rainhat", burst: "drop" },
  { id: "beach", name: "Sunny Beach", emoji: "🏖️", weather: "sparkle", accessory: "snorkel", burst: "sparkle" },
  { id: "underwater", name: "Under the Sea", emoji: "🐠", weather: "bubbles", accessory: "helmet", burst: "bubble" },
  { id: "caverns", name: "Crystal Caverns", emoji: "💎", weather: "motes", accessory: "crystal", burst: "crystal" },
  { id: "mines", name: "Lantern Mines", emoji: "⛏️", weather: "motes", accessory: "hardhat", burst: "sparkle" },
  { id: "snow", name: "Snowy Peaks", emoji: "🏔️", weather: "snow", accessory: "beanie", burst: "flake" },
  { id: "sky", name: "Cloud Islands", emoji: "☁️", weather: "clouds", accessory: "propeller", burst: "puff" },
  { id: "nursery", name: "The Nursery", emoji: "🍼", weather: "sparkle", accessory: "bonnet", burst: "heart" },
  { id: "twilight", name: "Firefly Twilight", emoji: "🌙", weather: "fireflies", accessory: "nightcap", burst: "firefly" },
];

export const sceneById = (id: SceneId): Scene => SCENES.find((s) => s.id === id) ?? SCENES[0]!;

/** Deterministic 0..1 noise, so a backdrop is the same every time it's painted. */
function noise(i: number, seed: number): number {
  const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function vertical(ctx: CanvasRenderingContext2D, h: number, stops: readonly string[]): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach((c, i) => g.addColorStop(i / Math.max(1, stops.length - 1), c));
  return g;
}

/** A soft rolling hill line across the screen, filled down to the bottom. */
function hill(ctx: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, colour: string, seed: number): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 20; x += 20) ctx.lineTo(x, base + Math.sin(x / (w * 0.22) + seed) * amp + Math.sin(x / (w * 0.09) + seed * 3) * amp * 0.3);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, colour);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, colour = "rgba(255,255,255,0.85)"): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(x, y, s, s * 0.42, 0, 0, Math.PI * 2);
  ctx.ellipse(x - s * 0.45, y + s * 0.05, s * 0.5, s * 0.32, 0, 0, Math.PI * 2);
  ctx.ellipse(x + s * 0.2, y - s * 0.25, s * 0.5, s * 0.42, 0, 0, Math.PI * 2);
  ctx.ellipse(x + s * 0.6, y + s * 0.05, s * 0.45, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function daisy(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, petal: string, centre: string): void {
  ctx.fillStyle = petal;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, r * 0.42, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = centre;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function pine(ctx: CanvasRenderingContext2D, x: number, base: number, h: number, colour: string, snow?: string): void {
  for (let tier = 0; tier < 3; tier++) {
    const top = base - h + tier * h * 0.26;
    const half = h * (0.2 + tier * 0.09);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.quadraticCurveTo(x + half * 0.5, top + h * 0.2, x + half, top + h * 0.38);
    ctx.lineTo(x - half, top + h * 0.38);
    ctx.quadraticCurveTo(x - half * 0.5, top + h * 0.2, x, top);
    ctx.fill();
    if (snow) {
      ctx.fillStyle = snow;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.quadraticCurveTo(x + half * 0.3, top + h * 0.08, x + half * 0.42, top + h * 0.15);
      ctx.quadraticCurveTo(x, top + h * 0.11, x - half * 0.42, top + h * 0.15);
      ctx.quadraticCurveTo(x - half * 0.3, top + h * 0.08, x, top);
      ctx.fill();
    }
  }
}

function roundTree(ctx: CanvasRenderingContext2D, x: number, base: number, h: number, leaf: string, trunk: string): void {
  ctx.fillStyle = trunk;
  ctx.beginPath();
  ctx.roundRect(x - h * 0.05, base - h * 0.45, h * 0.1, h * 0.45, h * 0.04);
  ctx.fill();
  ctx.fillStyle = leaf;
  ctx.beginPath();
  ctx.arc(x, base - h * 0.62, h * 0.3, 0, Math.PI * 2);
  ctx.arc(x - h * 0.2, base - h * 0.48, h * 0.2, 0, Math.PI * 2);
  ctx.arc(x + h * 0.2, base - h * 0.5, h * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Paints a scene's still backdrop (everything but the weather) at w x h CSS pixels. Called once per scene and
 * size and cached, so it can afford a little detail.
 */
export function paintBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, id: SceneId): void {
  const m = Math.min(w, h);
  switch (id) {
    case "meadow": {
      ctx.fillStyle = vertical(ctx, h, ["#cfe7f5", "#e8f3ee", "#f4f1e4"]);
      ctx.fillRect(0, 0, w, h);
      glow(ctx, w * 0.82, h * 0.08, m * 0.45, "rgba(255,236,190,0.75)");
      cloud(ctx, w * 0.2, h * 0.09, m * 0.12);
      cloud(ctx, w * 0.7, h * 0.15, m * 0.08, "rgba(255,255,255,0.7)");
      hill(ctx, w, h, h * 0.62, h * 0.03, "#d6ebc4", 1);
      hill(ctx, w, h, h * 0.74, h * 0.025, "#c5e3ad", 4);
      hill(ctx, w, h, h * 0.86, h * 0.02, "#b5da9a", 7);
      for (let i = 0; i < 70; i++) {
        const y = h * (0.66 + noise(i, 2) * 0.34);
        const r = 2 + ((y - h * 0.66) / (h * 0.34)) * 5;
        const kind = noise(i, 9);
        daisy(ctx, noise(i, 1) * w, y, r, kind < 0.6 ? "rgba(255,255,255,0.95)" : kind < 0.8 ? "#f6c3d2" : "#cdbdf0", "#f6cf63");
      }
      break;
    }
    case "forest": {
      ctx.fillStyle = vertical(ctx, h, ["#e4efd9", "#eef3df", "#dfe9cd"]);
      ctx.fillRect(0, 0, w, h);
      glow(ctx, w * 0.3, 0, m * 0.6, "rgba(255,244,200,0.8)");
      for (let i = 0; i < 9; i++) pine(ctx, (i / 8) * w + noise(i, 3) * 30, h * 0.34, h * (0.22 + noise(i, 4) * 0.08), "#c9dcb6");
      for (let i = 0; i < 7; i++) roundTree(ctx, (i / 6) * w + noise(i, 5) * 40 - 20, h * 0.3, h * (0.16 + noise(i, 6) * 0.06), "#b7d39f", "#c6ad94");
      hill(ctx, w, h, h * 0.8, h * 0.02, "#c4dcaa", 2);
      for (let i = 0; i < 8; i++) pine(ctx, noise(i, 7) * w, h * (0.95 + noise(i, 8) * 0.05), h * 0.2, "#a9c991");
      for (let i = 0; i < 10; i++) {
        // Toadstools in the grass.
        const x = noise(i, 11) * w;
        const y = h * (0.84 + noise(i, 12) * 0.14);
        const s = 5 + noise(i, 13) * 5;
        ctx.fillStyle = "#f3ead9";
        ctx.fillRect(x - s * 0.25, y - s * 0.4, s * 0.5, s * 0.9);
        ctx.fillStyle = "#f2a59b";
        ctx.beginPath();
        ctx.ellipse(x, y - s * 0.4, s, s * 0.6, 0, Math.PI, 0);
        ctx.fill();
      }
      // Sunbeams slanting through the canopy.
      ctx.fillStyle = "rgba(255,250,220,0.22)";
      for (let i = 0; i < 4; i++) {
        const x = w * (0.1 + i * 0.25);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + w * 0.08, 0);
        ctx.lineTo(x + w * 0.35, h);
        ctx.lineTo(x + w * 0.2, h);
        ctx.fill();
      }
      break;
    }
    case "pond": {
      ctx.fillStyle = vertical(ctx, h, ["#dcdfeb", "#e7ebee", "#dbe8e6"]);
      ctx.fillRect(0, 0, w, h);
      cloud(ctx, w * 0.25, h * 0.07, m * 0.16, "rgba(205,210,225,0.9)");
      cloud(ctx, w * 0.75, h * 0.11, m * 0.14, "rgba(212,216,230,0.9)");
      hill(ctx, w, h, h * 0.3, h * 0.02, "#cfdccf", 3);
      ctx.fillStyle = vertical(ctx, h, ["#cfe4e6", "#bcdadc"]);
      ctx.fillRect(0, h * 0.36, w, h);
      // Reeds along the far bank.
      ctx.strokeStyle = "#a9c49c";
      ctx.lineWidth = 2;
      for (let i = 0; i < 30; i++) {
        const x = noise(i, 4) * w;
        ctx.beginPath();
        ctx.moveTo(x, h * 0.37);
        ctx.quadraticCurveTo(x + 4, h * 0.3, x + 2 + noise(i, 5) * 6, h * (0.26 + noise(i, 6) * 0.04));
        ctx.stroke();
      }
      for (let i = 0; i < 16; i++) {
        // Lily pads, a few with lotus flowers.
        const x = noise(i, 7) * w;
        const y = h * (0.42 + noise(i, 8) * 0.56);
        const r = 8 + ((y - h * 0.4) / h) * 22;
        ctx.fillStyle = "#a8cf9a";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.ellipse(x, y, r, r * 0.45, 0, 0.3, Math.PI * 2 - 0.1);
        ctx.closePath();
        ctx.fill();
        if (noise(i, 9) < 0.35) daisy(ctx, x + r * 0.2, y - r * 0.15, r * 0.25, "#f6c3d2", "#f6d77a");
      }
      break;
    }
    case "beach": {
      ctx.fillStyle = vertical(ctx, h, ["#bfe3f4", "#e0f1f6"]);
      ctx.fillRect(0, 0, w, h);
      glow(ctx, w * 0.78, h * 0.08, m * 0.5, "rgba(255,240,190,0.9)");
      cloud(ctx, w * 0.2, h * 0.1, m * 0.1);
      ctx.fillStyle = vertical(ctx, h, ["#9fd8d6", "#b9e6df"]);
      ctx.fillRect(0, h * 0.24, w, h * 0.2);
      hill(ctx, w, h, h * 0.42, h * 0.008, "#f2f7f4", 2);
      hill(ctx, w, h, h * 0.43, h * 0.01, "#f6e6c8", 5);
      ctx.fillStyle = "#f3dcb7";
      for (let i = 0; i < 60; i++) {
        ctx.beginPath();
        ctx.arc(noise(i, 1) * w, h * (0.48 + noise(i, 2) * 0.5), 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 6; i++) {
        // Starfish and shells.
        const x = noise(i, 3) * w;
        const y = h * (0.8 + noise(i, 4) * 0.18);
        ctx.fillStyle = i % 2 ? "#f5b8a4" : "#f7d3e0";
        ctx.font = `${14 + noise(i, 5) * 8}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(i % 2 ? "⭐" : "🐚", x, y);
      }
      // A striped umbrella.
      const ux = w * 0.12;
      const uy = h * 0.9;
      ctx.strokeStyle = "#cdb59a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ux, uy);
      ctx.lineTo(ux + 8, uy - m * 0.2);
      ctx.stroke();
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k % 2 ? "#ffffff" : "#f5b5b5";
        ctx.beginPath();
        ctx.moveTo(ux + 8, uy - m * 0.24);
        ctx.arc(ux + 8, uy - m * 0.2, m * 0.11, Math.PI + (k / 5) * Math.PI, Math.PI + ((k + 1) / 5) * Math.PI);
        ctx.fill();
      }
      break;
    }
    case "underwater": {
      ctx.fillStyle = vertical(ctx, h, ["#c6edf0", "#a7dde2", "#8fcdd4"]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      for (let i = 0; i < 5; i++) {
        const x = w * (i * 0.24 - 0.05);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + w * 0.1, 0);
        ctx.lineTo(x + w * 0.22, h * 0.8);
        ctx.lineTo(x + w * 0.12, h * 0.8);
        ctx.fill();
      }
      hill(ctx, w, h, h * 0.9, h * 0.015, "#efe2c4", 3);
      for (let i = 0; i < 14; i++) {
        // Kelp, swaying a little in the painting itself.
        const x = noise(i, 4) * w;
        const tall = h * (0.12 + noise(i, 5) * 0.16);
        ctx.strokeStyle = i % 3 ? "#9fcf9f" : "#b4d98f";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.bezierCurveTo(x + 14, h - tall * 0.3, x - 14, h - tall * 0.7, x + 6, h - tall);
        ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        // Coral, in sea-shell pastels.
        const x = noise(i, 6) * w;
        const y = h * (0.93 + noise(i, 7) * 0.06);
        ctx.fillStyle = ["#f5b3c2", "#f8cfa4", "#cdb8ee"][i % 3]!;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.ellipse(x + (k - 1.5) * 6, y - 8 - (k % 2) * 6, 4, 10, (k - 1.5) * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "caverns": {
      ctx.fillStyle = vertical(ctx, h, ["#d3c8e6", "#e3dcef", "#cfc3e2"]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#c2b5da";
      for (let i = 0; i < 14; i++) {
        // Stalactites.
        const x = (i / 13) * w + noise(i, 1) * 20;
        const len = h * (0.05 + noise(i, 2) * 0.1);
        ctx.beginPath();
        ctx.moveTo(x - 12, 0);
        ctx.quadraticCurveTo(x, len * 1.3, x + 12, 0);
        ctx.fill();
      }
      hill(ctx, w, h, h * 0.88, h * 0.02, "#c6b9dd", 4);
      for (let i = 0; i < 12; i++) {
        // Glowing crystals.
        const x = noise(i, 3) * w;
        const y = h * (0.86 + noise(i, 4) * 0.12);
        const s = 10 + noise(i, 5) * 14;
        const colour = ["#f6bfe0", "#bfe2f6", "#d7c4fa", "#c4f2e2"][i % 4]!;
        glow(ctx, x, y - s * 0.5, s * 2.2, "rgba(255,255,255,0.5)");
        for (const [dx, k] of [[-0.45, 0.7], [0, 1], [0.45, 0.6]] as const) {
          ctx.fillStyle = colour;
          ctx.beginPath();
          ctx.moveTo(x + dx * s, y - s * 1.4 * k);
          ctx.lineTo(x + dx * s + s * 0.22, y - s * 0.9 * k);
          ctx.lineTo(x + dx * s + s * 0.18, y);
          ctx.lineTo(x + dx * s - s * 0.18, y);
          ctx.lineTo(x + dx * s - s * 0.22, y - s * 0.9 * k);
          ctx.fill();
        }
      }
      break;
    }
    case "mines": {
      ctx.fillStyle = vertical(ctx, h, ["#ead8c4", "#f1e4d4", "#e3cdb6"]);
      ctx.fillRect(0, 0, w, h);
      // Timber beams holding up the roof.
      ctx.fillStyle = "#d7b998";
      ctx.fillRect(0, h * 0.04, w, 14);
      for (let i = 0; i < 4; i++) ctx.fillRect((i / 3) * (w - 14), h * 0.04, 14, h * 0.3);
      for (let i = 0; i < 3; i++) {
        // Hanging lanterns.
        const x = w * (0.2 + i * 0.3);
        const y = h * 0.16;
        glow(ctx, x, y, m * 0.2, "rgba(255,214,140,0.7)");
        ctx.strokeStyle = "#b99a7c";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, h * 0.04 + 14);
        ctx.lineTo(x, y - 8);
        ctx.stroke();
        ctx.fillStyle = "#ffe3a3";
        ctx.beginPath();
        ctx.roundRect(x - 6, y - 8, 12, 16, 4);
        ctx.fill();
      }
      hill(ctx, w, h, h * 0.9, h * 0.01, "#dcc2a6", 2);
      // Rails across the floor.
      ctx.strokeStyle = "#c8a989";
      ctx.lineWidth = 3;
      for (const y of [h * 0.94, h * 0.985]) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.fillStyle = "#cfb092";
      for (let x = 6; x < w; x += 22) ctx.fillRect(x, h * 0.93, 6, h * 0.07);
      for (let i = 0; i < 10; i++) {
        // Little gold nuggets in the walls.
        ctx.fillStyle = "#f6d98e";
        ctx.beginPath();
        ctx.arc(noise(i, 6) * w, h * (0.4 + noise(i, 7) * 0.45), 2 + noise(i, 8) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "snow": {
      ctx.fillStyle = vertical(ctx, h, ["#d9e6f4", "#eef3f9", "#f7f9fc"]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#e3eaf5";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.34);
      ctx.lineTo(w * 0.25, h * 0.12);
      ctx.lineTo(w * 0.45, h * 0.3);
      ctx.lineTo(w * 0.7, h * 0.08);
      ctx.lineTo(w, h * 0.32);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fill();
      for (let i = 0; i < 10; i++) pine(ctx, (i / 9) * w + noise(i, 2) * 20, h * 0.36, h * 0.12, "#bcd3cc", "#ffffff");
      hill(ctx, w, h, h * 0.8, h * 0.025, "#f2f6fb", 3);
      for (let i = 0; i < 6; i++) pine(ctx, noise(i, 4) * w, h * (0.97 + noise(i, 5) * 0.03), h * 0.18, "#a9c7bf", "#ffffff");
      break;
    }
    case "sky": {
      ctx.fillStyle = vertical(ctx, h, ["#bcdcf8", "#dbe9fb", "#fbe6ef"]);
      ctx.fillRect(0, 0, w, h);
      // A soft rainbow.
      const colours = ["#f7b9b9", "#f8d6a8", "#f7ecaa", "#c5e8b7", "#b8daf3", "#d2c3f1"];
      ctx.lineWidth = m * 0.035;
      colours.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.55, m * 0.75 - i * m * 0.035, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      cloud(ctx, w * 0.15, h * 0.12, m * 0.14);
      cloud(ctx, w * 0.85, h * 0.2, m * 0.12);
      cloud(ctx, w * 0.1, h * 0.88, m * 0.22);
      cloud(ctx, w * 0.6, h * 0.95, m * 0.3);
      cloud(ctx, w * 0.95, h * 0.82, m * 0.16);
      break;
    }
    case "nursery": {
      ctx.fillStyle = vertical(ctx, h, ["#f8e3e8", "#fbeef0"]);
      ctx.fillRect(0, 0, w, h);
      for (let y = 0, row = 0; y < h * 0.8; y += 36, row++) {
        // Wallpaper: little stars and dots.
        for (let x = (row % 2) * 18; x < w; x += 36) {
          ctx.fillStyle = (x + row) % 3 ? "rgba(255,255,255,0.7)" : "rgba(246,214,140,0.55)";
          ctx.font = "12px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText((x + row) % 3 ? "•" : "★", x, y + 12);
        }
      }
      // The baby mobile.
      ctx.strokeStyle = "#d8bfa6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, 0);
      ctx.lineTo(w * 0.5, h * 0.05);
      ctx.moveTo(w * 0.3, h * 0.05);
      ctx.lineTo(w * 0.7, h * 0.05);
      ctx.stroke();
      ["🌙", "⭐", "☁️"].forEach((icon, i) => {
        const x = w * (0.3 + i * 0.2);
        ctx.beginPath();
        ctx.moveTo(x, h * 0.05);
        ctx.lineTo(x, h * 0.1);
        ctx.stroke();
        ctx.font = `${m * 0.06}px system-ui, sans-serif`;
        ctx.fillText(icon, x, h * 0.13);
      });
      // A wooden cot rail along the floor.
      ctx.fillStyle = "#f0ddc8";
      ctx.fillRect(0, h * 0.86, w, h * 0.14);
      ctx.fillStyle = "#e6cdb3";
      ctx.fillRect(0, h * 0.86, w, 8);
      for (let x = 10; x < w; x += 26) ctx.fillRect(x, h * 0.86, 7, h * 0.14);
      break;
    }
    case "twilight": {
      ctx.fillStyle = vertical(ctx, h, ["#bdb6e0", "#e2c4dc", "#f6d3cf"]);
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.4 + noise(i, 2) * 0.5})`;
        ctx.beginPath();
        ctx.arc(noise(i, 1) * w, noise(i, 3) * h * 0.4, 0.8 + noise(i, 4) * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      glow(ctx, w * 0.8, h * 0.1, m * 0.25, "rgba(255,250,230,0.8)");
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath();
      ctx.arc(w * 0.8, h * 0.1, m * 0.05, 0, Math.PI * 2);
      ctx.fill();
      hill(ctx, w, h, h * 0.72, h * 0.03, "#b8acd2", 2);
      hill(ctx, w, h, h * 0.84, h * 0.025, "#a99fc8", 5);
      for (let i = 0; i < 8; i++) roundTree(ctx, noise(i, 6) * w, h * (0.9 + noise(i, 7) * 0.1), h * 0.14, "#9a90bd", "#8f84b0");
      break;
    }
  }
}

interface Flake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  hue: number;
}

/**
 * The scene's weather: a light, slow particle field over the backdrop. A gust (after a big clear) blows it
 * sideways for a moment.
 */
export class Weather {
  private flakes: Flake[] = [];
  private ripples: { x: number; y: number; t0: number }[] = [];
  private gustUntil = 0;

  constructor(
    public kind: WeatherKind,
    private w: number,
    private h: number,
  ) {
    const n = { petals: 22, leaves: 18, rain: 70, sparkle: 26, bubbles: 24, motes: 30, snow: 60, clouds: 6, fireflies: 22 }[kind];
    for (let i = 0; i < n; i++) this.flakes.push(this.spawn(true));
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  gust(now: number): void {
    this.gustUntil = now + 1400;
  }

  private spawn(anywhere: boolean): Flake {
    const { w, h, kind } = this;
    const r = Math.random;
    const f: Flake = { x: r() * w, y: anywhere ? r() * h : -20, vx: 0, vy: 0, size: 1, phase: r() * Math.PI * 2, hue: r() };
    switch (kind) {
      case "petals":
        Object.assign(f, { vx: 0.25 + r() * 0.3, vy: 0.25 + r() * 0.3, size: 4 + r() * 3 });
        break;
      case "leaves":
        Object.assign(f, { vx: 0.15 + r() * 0.2, vy: 0.35 + r() * 0.3, size: 5 + r() * 4 });
        break;
      case "rain":
        Object.assign(f, { vx: -0.8, vy: 6 + r() * 3, size: 10 + r() * 8 });
        break;
      case "snow":
        Object.assign(f, { vx: 0, vy: 0.4 + r() * 0.5, size: 1.5 + r() * 2.5 });
        break;
      case "bubbles":
        if (!anywhere) f.y = h + 20;
        Object.assign(f, { vx: 0, vy: -(0.35 + r() * 0.5), size: 2 + r() * 5 });
        break;
      case "motes":
      case "fireflies":
        if (!anywhere) f.y = h + 10;
        Object.assign(f, { vx: (r() - 0.5) * 0.2, vy: -(0.08 + r() * 0.15), size: 1.5 + r() * 2.5 });
        break;
      case "sparkle":
        Object.assign(f, { size: 2 + r() * 3 });
        break;
      case "clouds":
        if (!anywhere) f.x = -120;
        Object.assign(f, { y: r() * h, vx: 0.08 + r() * 0.12, size: 40 + r() * 50 });
        break;
    }
    return f;
  }

  step(now: number): void {
    const gust = now < this.gustUntil ? Math.sin(((this.gustUntil - now) / 1400) * Math.PI) * 3 : 0;
    for (let i = 0; i < this.flakes.length; i++) {
      const f = this.flakes[i]!;
      const sway = Math.sin(now / 900 + f.phase);
      f.x += f.vx + gust + (this.kind === "snow" || this.kind === "petals" || this.kind === "leaves" || this.kind === "bubbles" ? sway * 0.35 : 0);
      f.y += f.vy;
      if (this.kind === "rain" && f.y > this.h * 0.4 && Math.random() < 0.02 && this.ripples.length < 12) {
        this.ripples.push({ x: f.x, y: f.y, t0: now });
        this.flakes[i] = this.spawn(false);
        continue;
      }
      const out = f.y > this.h + 30 || f.y < -40 || f.x > this.w + 130 || f.x < -140;
      if (out) this.flakes[i] = this.spawn(false);
    }
    this.ripples = this.ripples.filter((r) => now - r.t0 < 900);
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    for (const f of this.flakes) {
      switch (this.kind) {
        case "petals": {
          ctx.fillStyle = f.hue < 0.6 ? "rgba(250,205,220,0.85)" : f.hue < 0.85 ? "rgba(255,255,255,0.9)" : "rgba(214,196,246,0.85)";
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, f.size, f.size * 0.55, now / 700 + f.phase, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "leaves": {
          ctx.fillStyle = f.hue < 0.5 ? "rgba(190,214,150,0.85)" : f.hue < 0.8 ? "rgba(244,196,140,0.85)" : "rgba(236,160,140,0.8)";
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, f.size, f.size * 0.45, Math.sin(now / 600 + f.phase) * 1.2, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "rain": {
          ctx.strokeStyle = "rgba(150,170,200,0.35)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(f.x + f.vx * 2, f.y + f.size);
          ctx.stroke();
          break;
        }
        case "snow": {
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "bubbles": {
          ctx.strokeStyle = "rgba(255,255,255,0.75)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          ctx.beginPath();
          ctx.arc(f.x - f.size * 0.35, f.y - f.size * 0.35, f.size * 0.25, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "motes":
        case "fireflies": {
          const pulse = 0.5 + Math.sin(now / 500 + f.phase * 3) * 0.5;
          const colour = this.kind === "fireflies" ? `rgba(255,240,160,${0.35 + pulse * 0.6})` : f.hue < 0.5 ? `rgba(255,255,255,${0.3 + pulse * 0.5})` : `rgba(255,220,240,${0.3 + pulse * 0.5})`;
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * 3);
          g.addColorStop(0, colour);
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(f.x - f.size * 3, f.y - f.size * 3, f.size * 6, f.size * 6);
          break;
        }
        case "sparkle": {
          const tw = Math.max(0, Math.sin(now / 400 + f.phase * 5));
          if (tw < 0.05) break;
          ctx.fillStyle = `rgba(255,255,255,${tw * 0.9})`;
          const s = f.size * tw;
          ctx.beginPath();
          ctx.moveTo(f.x, f.y - s * 2);
          ctx.quadraticCurveTo(f.x, f.y, f.x + s * 2, f.y);
          ctx.quadraticCurveTo(f.x, f.y, f.x, f.y + s * 2);
          ctx.quadraticCurveTo(f.x, f.y, f.x - s * 2, f.y);
          ctx.quadraticCurveTo(f.x, f.y, f.x, f.y - s * 2);
          ctx.fill();
          break;
        }
        case "clouds":
          cloud(ctx, f.x, f.y, f.size, "rgba(255,255,255,0.55)");
          break;
      }
    }
    for (const r of this.ripples) {
      const k = (now - r.t0) / 900;
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, 3 + k * 12, (3 + k * 12) * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

const HAT_SCALE = 1.5;

/**
 * The scene's outfit, drawn on a face. (x, y) is between the eyes, `cell` the body's cell size, `eye` the eye
 * size the face used and `spread` the distance from the middle to each eye.
 */
export function drawAccessory(ctx: CanvasRenderingContext2D, kind: Accessory, x: number, y: number, cell: number, eye: number, spread: number, now: number): void {
  const top = y - cell * 0.37;
  const white = eye * 0.19;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Hats are drawn at a base size and scaled up from the crown of the head, so they read at a glance.
  if (kind !== "snorkel" && kind !== "helmet") {
    ctx.translate(x, top);
    ctx.scale(HAT_SCALE, HAT_SCALE);
    ctx.translate(-x, -top);
  }
  switch (kind) {
    case "flowers": {
      // A daisy chain across the top of the head.
      for (let k = -2; k <= 2; k++) {
        const fx = x + k * cell * 0.13;
        const fy = top + cell * 0.08 + Math.abs(k) * cell * 0.03;
        daisy(ctx, fx, fy, cell * 0.045, k % 2 ? "#f7c6d6" : "#ffffff", "#f6cf63");
      }
      break;
    }
    case "mushroom": {
      const cx = x + cell * 0.08;
      ctx.fillStyle = "#f19c92";
      ctx.beginPath();
      ctx.ellipse(cx, top + cell * 0.04, cell * 0.24, cell * 0.17, -0.15, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#fff6ee";
      for (const [dx, dy, r] of [[-0.1, -0.06, 0.04], [0.05, -0.1, 0.035], [0.13, -0.02, 0.03]] as const) {
        ctx.beginPath();
        ctx.arc(cx + dx * cell, top + cell * 0.04 + dy * cell, r * cell, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "rainhat": {
      ctx.fillStyle = "#f7d56e";
      ctx.beginPath();
      ctx.ellipse(x, top + cell * 0.07, cell * 0.33, cell * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, top + cell * 0.06, cell * 0.2, cell * 0.17, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(160,120,40,0.35)";
      ctx.lineWidth = Math.max(1, cell * 0.02);
      ctx.beginPath();
      ctx.ellipse(x, top + cell * 0.06, cell * 0.2, cell * 0.04, 0, 0, Math.PI);
      ctx.stroke();
      break;
    }
    case "snorkel": {
      // A mask over both eyes and a tube up the side.
      ctx.fillStyle = "rgba(200,235,250,0.35)";
      ctx.strokeStyle = "#6fb7d9";
      ctx.lineWidth = Math.max(1.5, cell * 0.04);
      ctx.beginPath();
      ctx.roundRect(x - spread - white * 1.35, y - white * 1.3, (spread + white * 1.35) * 2, white * 2.6, white * 1.1);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(111,183,217,0.8)";
      ctx.beginPath();
      ctx.moveTo(x - spread - white * 1.35, y);
      ctx.lineTo(x - cell * 0.5, y - cell * 0.05);
      ctx.moveTo(x + spread + white * 1.35, y);
      ctx.lineTo(x + cell * 0.5, y - cell * 0.05);
      ctx.stroke();
      ctx.strokeStyle = "#f6a65c";
      ctx.lineWidth = Math.max(2, cell * 0.06);
      const sx = x + spread + white * 1.6;
      ctx.beginPath();
      ctx.moveTo(sx, y + white * 0.6);
      ctx.lineTo(sx, top - cell * 0.12);
      ctx.stroke();
      ctx.fillStyle = "#f6a65c";
      ctx.beginPath();
      ctx.arc(sx, top - cell * 0.14, cell * 0.04, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "helmet": {
      // A glass diving bubble, with a little bubble escaping now and then.
      const r = cell * 0.4;
      ctx.fillStyle = "rgba(220,245,255,0.22)";
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = Math.max(1.5, cell * 0.035);
      ctx.beginPath();
      ctx.arc(x, y + cell * 0.02, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(x, y + cell * 0.02, r * 0.78, Math.PI * 1.15, Math.PI * 1.4);
      ctx.stroke();
      const t = ((now / 1600) % 1 + 1) % 1;
      ctx.beginPath();
      ctx.arc(x + r * 0.5, y - r - t * cell * 0.3, cell * 0.035 * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "crystal": {
      const pulse = 0.6 + Math.sin(now / 600) * 0.2;
      const cx = x - cell * 0.05;
      const g = ctx.createRadialGradient(cx, top, 0, cx, top, cell * 0.3);
      g.addColorStop(0, `rgba(255,220,250,${pulse * 0.7})`);
      g.addColorStop(1, "rgba(255,220,250,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - cell * 0.3, top - cell * 0.3, cell * 0.6, cell * 0.6);
      for (const [dx, k, colour] of [[-0.09, 0.7, "#c9b6f5"], [0, 1, "#f5b9e0"], [0.09, 0.6, "#b6e0f5"]] as const) {
        const bx = cx + dx * cell;
        const tall = cell * 0.22 * k;
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.moveTo(bx, top + cell * 0.05 - tall);
        ctx.lineTo(bx + cell * 0.05, top + cell * 0.05 - tall * 0.6);
        ctx.lineTo(bx + cell * 0.04, top + cell * 0.06);
        ctx.lineTo(bx - cell * 0.04, top + cell * 0.06);
        ctx.lineTo(bx - cell * 0.05, top + cell * 0.05 - tall * 0.6);
        ctx.fill();
      }
      break;
    }
    case "hardhat": {
      ctx.fillStyle = "#f6cf5b";
      ctx.beginPath();
      ctx.ellipse(x, top + cell * 0.07, cell * 0.3, cell * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, top + cell * 0.06, cell * 0.22, cell * 0.18, 0, Math.PI, 0);
      ctx.fill();
      // The lamp, with a soft beam.
      const flick = 0.75 + Math.sin(now / 130) * 0.05;
      const lx = x;
      const ly = top - cell * 0.03;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, cell * 0.35);
      g.addColorStop(0, `rgba(255,240,190,${flick})`);
      g.addColorStop(1, "rgba(255,240,190,0)");
      ctx.fillStyle = g;
      ctx.fillRect(lx - cell * 0.35, ly - cell * 0.35, cell * 0.7, cell * 0.7);
      ctx.fillStyle = "#fffbe8";
      ctx.beginPath();
      ctx.arc(lx, ly, cell * 0.05, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "beanie": {
      ctx.fillStyle = "#a9c8ee";
      ctx.beginPath();
      ctx.ellipse(x, top + cell * 0.08, cell * 0.25, cell * 0.2, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#f3f6fb";
      ctx.beginPath();
      ctx.roundRect(x - cell * 0.27, top + cell * 0.04, cell * 0.54, cell * 0.08, cell * 0.04);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = Math.max(1, cell * 0.018);
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * cell * 0.07, top + cell * 0.04);
        ctx.lineTo(x + k * cell * 0.055, top - cell * 0.08);
        ctx.stroke();
      }
      ctx.fillStyle = "#f6f0f6";
      ctx.beginPath();
      ctx.arc(x, top - cell * 0.13, cell * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "propeller": {
      // A striped beanie cap with a propeller that spins.
      const colours = ["#f7b2b2", "#f7e08f", "#a8d5f2"];
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = colours[k]!;
        ctx.beginPath();
        ctx.moveTo(x, top + cell * 0.07);
        ctx.ellipse(x, top + cell * 0.07, cell * 0.2, cell * 0.16, 0, Math.PI + (k / 3) * Math.PI, Math.PI + ((k + 1) / 3) * Math.PI);
        ctx.fill();
      }
      ctx.strokeStyle = "#c4a88f";
      ctx.lineWidth = Math.max(1, cell * 0.025);
      ctx.beginPath();
      ctx.moveTo(x, top - cell * 0.09);
      ctx.lineTo(x, top - cell * 0.15);
      ctx.stroke();
      const spin = Math.cos(now / 70);
      ctx.fillStyle = "#f29eb6";
      ctx.beginPath();
      ctx.ellipse(x, top - cell * 0.16, cell * 0.2 * Math.abs(spin) + cell * 0.02, cell * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e9c46a";
      ctx.beginPath();
      ctx.arc(x, top - cell * 0.16, cell * 0.025, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "bonnet": {
      // Babies: a frilly bonnet and a dummy.
      ctx.fillStyle = "#fbe7ef";
      ctx.beginPath();
      ctx.arc(x, top + cell * 0.14, cell * 0.33, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineTo(x + cell * 0.3, top + cell * 0.14);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      for (let k = 0; k <= 8; k++) {
        const a = Math.PI * (1.05 + (k / 8) * 0.9);
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * cell * 0.33, top + cell * 0.14 + Math.sin(a) * cell * 0.33, cell * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      // The dummy is drawn at face size, outside the hat scaling.
      ctx.restore();
      ctx.save();
      const my = y + white * 1.85;
      ctx.fillStyle = "#a8d9ee";
      ctx.beginPath();
      ctx.ellipse(x, my, white * 1.1, white * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f6b7cc";
      ctx.lineWidth = Math.max(1.5, cell * 0.03);
      ctx.beginPath();
      ctx.arc(x, my + white * 0.75, white * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "nightcap": {
      // A floppy cap, its tip drooping down the side with a pompom.
      ctx.fillStyle = "#b9b0e6";
      ctx.beginPath();
      ctx.moveTo(x - cell * 0.24, top + cell * 0.08);
      ctx.quadraticCurveTo(x - cell * 0.05, top - cell * 0.3, x + cell * 0.32, top - cell * 0.02);
      ctx.quadraticCurveTo(x + cell * 0.15, top - cell * 0.02, x + cell * 0.24, top + cell * 0.08);
      ctx.fill();
      ctx.fillStyle = "#fff7e0";
      ctx.beginPath();
      ctx.roundRect(x - cell * 0.26, top + cell * 0.04, cell * 0.52, cell * 0.07, cell * 0.035);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + cell * 0.33, top, cell * 0.055, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f7df8a";
      ctx.font = `${Math.round(cell * 0.12)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", x - cell * 0.04, top - cell * 0.06);
      break;
    }
  }
  ctx.restore();
}
