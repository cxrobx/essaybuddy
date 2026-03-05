import type { Config } from "tailwindcss";

const config: Config = {
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
          bg:             "#E8DCC8",
          surface:        "#FFFDF7",
          elevated:       "#FBF5EC",
          border:         "#D4C5A9",
          text:           "#2C1F0E",
          "text-secondary": "#8B7355",
          accent:         "#7D9B76",
          "accent-hover": "#5C7A56",
          success:        "#7D9B76",
          error:          "#C45C4A",
          warning:        "#C4923A",
        },
      },
      boxShadow: {
        macos:    "0 2px 8px rgba(44,31,14,0.08), 0 0 1px rgba(44,31,14,0.12)",
        "macos-lg": "0 10px 40px rgba(44,31,14,0.12), 0 0 1px rgba(44,31,14,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
