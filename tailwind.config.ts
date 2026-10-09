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
      fontFamily: {
        sans: ["Sarabun", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
export default config;
