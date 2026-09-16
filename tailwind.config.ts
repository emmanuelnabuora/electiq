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
        // New light-theme design system (UI redesign) -- kept under an
        // "eiq-" prefix so it never collides with or overrides the
        // existing dark-navy tokens above, which the original
        // /command-center pages still depend on unchanged.
        "eiq-sidebar": "#071827",
        "eiq-sidebar-hover": "#10283A",
        "eiq-sidebar-active": "#16364E",
        "eiq-text-primary": "#102033",
        "eiq-text-secondary": "#64748B",
        "eiq-bg": "#F5F7FA",
        "eiq-card": "#FFFFFF",
        "eiq-border": "#E5EAF0",
        "eiq-blue": "#2563EB",
        "eiq-success": "#22C55E",
        "eiq-warning": "#F59E0B",
        "eiq-critical": "#EF4444",
        "eiq-info": "#3B82F6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
