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
        bg: "#F4F1EA",
        ink: "#1A1A1A",
        accent: {
          DEFAULT: "#D14B2D",
          soft: "#E26A4F",
        },
        border: "#E8E3D8",
        muted: {
          DEFAULT: "#8A8578",
          foreground: "#5C584F",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#1A1A1A",
        },
      },
      fontFamily: {
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px",
      },
      boxShadow: {
        card: "0 1px 0 rgba(26,26,26,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
