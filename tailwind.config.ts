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
        "eiq-navy-900": "#0B2239",
        "eiq-sidebar-hover": "#10283A",
        "eiq-sidebar-active": "#16364E",
        "eiq-text-primary": "#102033",
        "eiq-text-secondary": "#64748B",
        "eiq-text-muted": "#94A3B8",
        "eiq-bg": "#F5F7FA",
        "eiq-card": "#FFFFFF",
        "eiq-border": "#E5EAF0",
        "eiq-blue": "#2563EB",
        "eiq-blue-hover": "#1D4ED8",
        "eiq-blue-light": "#EFF6FF",
        "eiq-success": "#22C55E",
        "eiq-success-light": "#DCFCE7",
        "eiq-warning": "#F59E0B",
        "eiq-warning-light": "#FEF3C7",
        "eiq-critical": "#EF4444",
        "eiq-critical-light": "#FEE2E2",
        "eiq-info": "#3B82F6",
        // Public Portal design system (Screen 8) -- its own distinct
        // "pub-" prefix, since its exact values (success, text colors)
        // differ from the internal "eiq-" theme's own numbers. Two
        // different approved specs, two different token sets.
        "pub-blue": "#2563EB",
        "pub-text": "#0F1F3D",
        "pub-text-secondary": "#64748B",
        "pub-success": "#10B981",
        "pub-warning": "#F59E0B",
        "pub-critical": "#EF4444",
        "pub-bg": "#F5F8FC",
        "pub-card": "#FFFFFF",
        "pub-border": "#E4EAF2",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
