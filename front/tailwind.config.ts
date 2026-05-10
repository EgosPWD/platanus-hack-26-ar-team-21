import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        bg: {
          DEFAULT: "#FAFAF7",
          card: "#FFFFFF",
          soft: "#F4F4F0",
        },
        ink: {
          DEFAULT: "#0F172A",
          soft: "#475569",
          mute: "#94A3B8",
        },
        accent: {
          DEFAULT: "#0EA5A4",
          deep: "#0B7C7B",
          soft: "#E6F7F7",
        },
        success: "#16A34A",
        warning: "#EAB308",
        danger: "#DC2626",
        line: {
          DEFAULT: "rgba(15, 23, 42, 0.08)",
          strong: "rgba(15, 23, 42, 0.16)",
        },
        // Aliases legacy: shadcn-style components siguen usando estos nombres.
        border: "rgba(15, 23, 42, 0.08)",
        muted: {
          DEFAULT: "#94A3B8",
          foreground: "#475569",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#0F172A",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.04)",
        lift: "0 8px 24px -8px rgba(15, 23, 42, 0.12), 0 2px 6px -2px rgba(15, 23, 42, 0.06)",
        glow: "0 0 0 4px rgba(14, 165, 164, 0.15)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(14, 165, 164, 0.0)" },
          "50%": { boxShadow: "0 0 0 6px rgba(14, 165, 164, 0.18)" },
        },
        caret: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "fade-in": "fade-in 200ms ease-out",
        "fade-up": "fade-up 280ms ease-out both",
        "pulse-glow": "pulse-glow 1.6s ease-in-out infinite",
        caret: "caret 1s steps(2) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
