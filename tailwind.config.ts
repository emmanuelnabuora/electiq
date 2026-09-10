import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "navy-primary": "#07111F",
        "navy-secondary": "#0D1B2A",
        panel: "#111F30",
        light: "#F7F9FC",
        accent: "#2F80ED",
        success: "#22C55E",
        warning: "#F59E0B",
        critical: "#EF4444",
        neutral: "#64748B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
