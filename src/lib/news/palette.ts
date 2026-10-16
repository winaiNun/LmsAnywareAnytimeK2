/**
 * The colours of the news block. Each tab gets a pair of neighbouring hues from this palette, and its cards alternate between the
 * two, so a list has rhythm without turning into a rainbow. Every colour keeps WCAG contrast: white text on `solid`, `solid` text on `soft`.
 */
export type Tone = { solid: string; soft: string };

export const TONES = {
  blue: { solid: "#0052FF", soft: "#EAF0FF" },
  violet: { solid: "#7C3AED", soft: "#F5EFFE" },
  teal: { solid: "#0F766E", soft: "#E9F7F4" },
  green: { solid: "#15803D", soft: "#EEF9F1" },
  orange: { solid: "#C2410C", soft: "#FEF3E8" },
  rose: { solid: "#BE123C", soft: "#FEEBEF" },
} as const satisfies Record<string, Tone>;

export type ToneName = keyof typeof TONES;

/** Neighbours on the colour wheel: they sit well together. Tab 1 = blue/violet, tab 2 = teal/green, tab 3 = orange/rose, then round again. */
export const PAIRS: readonly (readonly [ToneName, ToneName])[] = [
  ["blue", "violet"],
  ["teal", "green"],
  ["orange", "rose"],
];

export const pairFor = (tabIndex: number): readonly [Tone, Tone] => {
  const [a, b] = PAIRS[((Math.floor(tabIndex) % PAIRS.length) + PAIRS.length) % PAIRS.length];
  return [TONES[a], TONES[b]];
};

/** The colour of card number `cardIndex` of a tab: even = the first hue of the tab's pair, odd = the second. */
export const toneFor = (tabIndex: number, cardIndex: number): Tone => pairFor(tabIndex)[Math.abs(Math.floor(cardIndex)) % 2];

/** The two colours of a tab (for its active pill: a gradient from one to the other). */
export const tabColors = (tabIndex: number): [string, string] => {
  const [a, b] = pairFor(tabIndex);
  return [a.solid, b.solid];
};
