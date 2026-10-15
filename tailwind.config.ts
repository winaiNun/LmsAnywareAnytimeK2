import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          DEFAULT: "#0052FF",
          dark: "#0040CC",
          soft: "#EAF0FF",
        },
      },
      keyframes: {
        "faq-panel": { from: { opacity: "0", transform: "translateY(14px) scale(0.98)" }, to: { opacity: "1", transform: "none" } },
        "faq-sheet": { from: { transform: "translateY(100%)" }, to: { transform: "none" } },
        "faq-msg": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        "faq-ping": { "0%": { transform: "scale(1)", opacity: "0.55" }, "70%, 100%": { transform: "scale(1.55)", opacity: "0" } },
      },
      animation: {
        "faq-panel": "faq-panel 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "faq-sheet": "faq-sheet 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "faq-msg": "faq-msg 260ms ease-out both",
        "faq-ping": "faq-ping 2.4s cubic-bezier(0, 0, 0.2, 1) 3",
      },
      fontFamily: {
        sans: ["Sarabun", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
export default config;
