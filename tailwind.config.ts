import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        monad: {
          purple: "#836EF9",
          dark: "#0A0A0F",
          card: "#13131A",
          border: "#2A2A3A",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "pulse-purple": "pulse-purple 2s ease-in-out infinite",
        "battle-flash": "battle-flash 0.5s ease-in-out",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        "pulse-purple": {
          "0%, 100%": { boxShadow: "0 0 10px #836EF9" },
          "50%": { boxShadow: "0 0 30px #836EF9, 0 0 60px #836EF9" },
        },
        "battle-flash": {
          "0%": { backgroundColor: "transparent" },
          "50%": { backgroundColor: "rgba(131, 110, 249, 0.3)" },
          "100%": { backgroundColor: "transparent" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
