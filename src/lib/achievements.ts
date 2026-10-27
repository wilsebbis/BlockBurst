/**
 * Trophies: permanent awards for milestones. They come only from play (skill, lines, days, collection) and never
 * from spending. Status shows skill, not money.
 */
export interface TrophyStats {
  best: number;
  runs: number;
  lines: number;
  maxCombo: number;
  bestMulti: number;
  perfects: number;
  gems: number;
  adventureStars: number;
  adventureLevel: number;
  daysPlayed: number;
  collection: number;
  inCrew: boolean;
  rankTier: number;
}

export interface Trophy {
  id: string;
  name: string;
  emoji: string;
  how: string;
  test(s: TrophyStats): boolean;
  coins: number;
  cosmetic?: string;
}

export const TROPHIES: Trophy[] = [
  { id: 'first', name: 'First Block', emoji: '🧱', how: 'Finish your first game', test: (s) => s.runs >= 1, coins: 10 },
  { id: 'score5k', name: 'Warming Up', emoji: '🌡️', how: 'Score 5,000 in one game', test: (s) => s.best >= 5000, coins: 25 },
  { id: 'score25k', name: 'High Roller', emoji: '🎲', how: 'Score 25,000 in one game', test: (s) => s.best >= 25000, coins: 60 },
  { id: 'score100k', name: 'Six Figures', emoji: '💯', how: 'Score 100,000 in one game', test: (s) => s.best >= 100000, coins: 150, cosmetic: 'trophy' },
  { id: 'lines1k', name: 'Line Cook', emoji: '➖', how: 'Clear 1,000 lines', test: (s) => s.lines >= 1000, coins: 50 },
  { id: 'combo6', name: 'On Fire', emoji: '🔥', how: 'Reach a x6 combo', test: (s) => s.maxCombo >= 6, coins: 40 },
  { id: 'combo12', name: 'Unstoppable', emoji: '☄️', how: 'Reach a x12 combo', test: (s) => s.maxCombo >= 12, coins: 80 },
  { id: 'multi3', name: 'Triple Threat', emoji: '✖️', how: 'Clear 3 lines with one piece', test: (s) => s.bestMulti >= 3, coins: 40 },
  { id: 'multi4', name: 'Crossroads', emoji: '➕', how: 'Clear 4 lines with one piece', test: (s) => s.bestMulti >= 4, coins: 80 },
  { id: 'perfect', name: 'Clean Slate', emoji: '✨', how: 'Make a Perfect Clear', test: (s) => s.perfects >= 1, coins: 40 },
  { id: 'gems100', name: 'Gem Hunter', emoji: '💎', how: 'Collect 100 gems', test: (s) => s.gems >= 100, coins: 50 },
  { id: 'adv20', name: 'Adventurer', emoji: '🗺️', how: 'Reach Adventure level 20', test: (s) => s.adventureLevel >= 20, coins: 60 },
  { id: 'stars60', name: 'Star Collector', emoji: '⭐', how: 'Earn 60 Adventure stars', test: (s) => s.adventureStars >= 60, coins: 80 },
  { id: 'days7', name: 'Regular', emoji: '📅', how: 'Play the Daily Board on 7 days (any 7)', test: (s) => s.daysPlayed >= 7, coins: 40 },
  { id: 'days30', name: 'Local Legend', emoji: '🗓️', how: 'Play the Daily Board on 30 days (any 30)', test: (s) => s.daysPlayed >= 30, coins: 100 },
  { id: 'collect12', name: 'Collector', emoji: '🎨', how: 'Own 12 cosmetics', test: (s) => s.collection >= 12, coins: 40 },
  { id: 'crew', name: 'Squad Up', emoji: '🚩', how: 'Join or start a crew', test: (s) => s.inCrew, coins: 20 },
  { id: 'gold', name: 'Gold Standard', emoji: '🥇', how: 'Reach Gold rank', test: (s) => s.rankTier >= 2, coins: 80 },
];

export const earned = (s: TrophyStats) => TROPHIES.filter((t) => t.test(s)).map((t) => t.id);
