/* Refined line icons (24px grid, round caps) shared by the public site. */
const PATHS = {
  home: "M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V21h3.5a1 1 0 0 0 1-1V9.5",
  library: "M4 4.5A1.5 1.5 0 0 1 5.5 3H10v18H5.5A1.5 1.5 0 0 1 4 19.5v-15zM10 3h4v18h-4zM14 5.2l4.1-1.1a1.2 1.2 0 0 1 1.5.9l1.9 14.4a1.2 1.2 0 0 1-1 1.3L15 21.5",
  course: "M3 8.5 12 4l9 4.5-9 4.5-9-4.5zM7 11v4.2c0 1.2 2.2 2.8 5 2.8s5-1.6 5-2.8V11M21 8.5V14",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.6v.1",
  shield: "M12 3 4.5 6v5.5c0 4.4 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5.1 7.5-9.5V6L12 3zM8.8 12.2l2.4 2.4 4.2-4.6",
  user: "M12 12.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM4 21c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5",
  userCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 12.2a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6.2 18.2c.9-2.2 3.1-3.4 5.8-3.4s4.9 1.2 5.8 3.4",
  userPlus: "M10 12.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM2.5 21c0-3.7 3.4-6 7.5-6 1.6 0 3 .3 4.2.9M19 14v6M16 17h6",
  login: "M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16.5 14.5 12 10 7.5M14.5 12H3.5",
  logout: "M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M16 16.5l4.5-4.5L16 7.5M20.5 12H9.5",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  mail: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11zM4.5 7.5 12 13l7.5-5.5",
  lock: "M6.5 10.5h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5zM8 10.5V8a4 4 0 0 1 8 0v2.5M12 15v2",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7",
  school: "M3 10.2 12 4l9 6.2M5 10v9.5a.5.5 0 0 0 .5.5H9v-5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V20h3.5a.5.5 0 0 0 .5-.5V10M12 4V2M12 2h3M12.8 8.9h-1.6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5", strokeWidth = 1.7 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Animated loading ring for busy buttons. */
export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
