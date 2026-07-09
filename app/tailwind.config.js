/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        clinical: {
          primary: "#1E3A5F",   // navy - trust, clinical
          accent: "#2E7D6B",    // teal-green - metabolic/health cue
          warn: "#C9A227",      // gold/amber - caution, alerts
          danger: "#B3261E",
          bg: "#F7F9FA",
          card: "#FFFFFF",
        },
      },
    },
  },
  plugins: [],
};
