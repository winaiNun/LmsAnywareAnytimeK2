/**
 * Line-icon path data (24px grid, drawn with a 1.7 stroke, round caps). Pure data so server components, client
 * components and scripts can all use it. Learning-area / media-type icons are stored in the database as these KEYS.
 */
const circle = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const ICON_PATHS: Record<string, string> = {
  // ---- subjects & media types (stored in the database)
  "book-open": "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  calculator: "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01",
  flask: "M10 2v7.5L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9.5V2M8.5 2h7M7 16h10",
  globe: `${circle(12, 12, 10)}M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z`,
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  palette: "M12 22a10 10 0 1 1 10-10c0 3-2 4-4.5 4H15a2 2 0 0 0-1.5 3.3c.6.7.4 2.7-1.5 2.7zM13.5 6.5h.01M17.5 10.5h.01M8.5 7.5h.01M6.5 12.5h.01",
  wrench: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z",
  languages: "M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  laptop: "M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9M2 20h20",
  "play-circle": `${circle(12, 12, 10)}M10 8l6 4-6 4z`,
  "file-text": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8M8 9h2",
  "clipboard-check": "M9 2h6v4H9zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4",
  gamepad: "M6 12h4M8 10v4M15 13h.01M18 11h.01M17.3 5H6.7a4 4 0 0 0-3.9 3.2l-1.7 8A3 3 0 0 0 4 20c1 0 1.8-.4 2.4-1.2L8 17h8l1.6 1.8c.6.8 1.4 1.2 2.4 1.2a3 3 0 0 0 2.9-3.8l-1.7-8A4 4 0 0 0 17.3 5z",
  "app-window": "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM2 9h20M6 6.5h.01M10 6.5h.01",
  presentation: "M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M7 21l5-5 5 5",
  "calendar-check": "M8 2v4M16 2v4M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 10h18M9 16l2 2 4-4",
  book: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20",
  headphones: "M3 14v-2a9 9 0 0 1 18 0v2M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z",
  "help-circle": `${circle(12, 12, 10)}M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01`,
  lightbulb: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.7.6 1 1.3 1 2.3h6c0-1 .3-1.7 1-2.3A7 7 0 0 0 12 2z",

  // ---- interface
  eye: `M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z${circle(12, 12, 3)}`,
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  "external-link": "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3",
  maximize: "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3",
  share: "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13",
  pin: "M12 17v5M9 10.8V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6.8a2 2 0 0 0 .6 1.4l1.8 1.8a1 1 0 0 1-.7 1.7H7.3a1 1 0 0 1-.7-1.7l1.8-1.8a2 2 0 0 0 .6-1.4z",
  "chevron-left": "M15 18l-6-6 6-6",
  "chevron-right": "M9 18l6-6-6-6",
  search: `${circle(11, 11, 7)}M21 21l-4.3-4.3`,
  x: "M18 6L6 18M6 6l12 12",
  check: "M20 6L9 17l-5-5",
  menu: "M4 6h16M4 12h16M4 18h16",
  logout: "M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M16 16.5l4.5-4.5L16 7.5M20.5 12H9",
  sparkles: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
};

export type IconKey = keyof typeof ICON_PATHS;

/** Icons an admin may give a learning area / media type (the first block above). */
export const CHOICE_KEYS = [
  "book-open", "calculator", "flask", "globe", "activity", "palette", "wrench", "languages", "users", "laptop",
  "play-circle", "file-text", "clipboard-check", "gamepad", "app-window", "presentation", "calendar-check", "book", "headphones", "help-circle", "lightbulb", "sparkles",
] as const;

export const isIconKey = (v: unknown): v is string => typeof v === "string" && Object.prototype.hasOwnProperty.call(ICON_PATHS, v);
