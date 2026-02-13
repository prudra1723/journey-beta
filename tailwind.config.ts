import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primaryBlue: "#1a73e8",
        primaryOrange: "#ff6b35",
        highlightYellow: "#ffd166",
        accentGreen: "#06d6a0",
        textDark: "#1f2933",
        textGray: "#6b7280",
      },
      boxShadow: {
        soft: "0 10px 25px rgba(0,0,0,0.06)",
        yellow: "0 10px 30px rgba(255, 209, 102, 0.35)",
        green: "0 10px 30px rgba(6, 214, 160, 0.35)",
      },
    },
  },
  plugins: [],
} satisfies Config;
