import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["Georgia", "Libre Baskerville", "serif"],
      },
      colors: {
        macos: {
          bg:             "rgb(var(--macos-bg) / <alpha-value>)",
          surface:        "rgb(var(--macos-surface) / <alpha-value>)",
          elevated:       "rgb(var(--macos-elevated) / <alpha-value>)",
          border:         "rgb(var(--macos-border) / <alpha-value>)",
          text:           "rgb(var(--macos-text) / <alpha-value>)",
          "text-secondary": "rgb(var(--macos-text-secondary) / <alpha-value>)",
          accent:         "rgb(var(--macos-accent) / <alpha-value>)",
          "accent-hover": "rgb(var(--macos-accent-hover) / <alpha-value>)",
          success:        "rgb(var(--macos-success) / <alpha-value>)",
          error:          "rgb(var(--macos-error) / <alpha-value>)",
          warning:        "rgb(var(--macos-warning) / <alpha-value>)",
        },
      },
      boxShadow: {
        macos:    "0 2px 8px rgb(var(--shadow-color) / 0.08), 0 0 1px rgb(var(--shadow-color) / 0.12)",
        "macos-lg": "0 10px 40px rgb(var(--shadow-color) / 0.12), 0 0 1px rgb(var(--shadow-color) / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
