/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/react-app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        momentum: {
          /** Spotlight palette — warm stage lights (not teal/cyan or blue/purple) */
          ember: "#FF5349",
          flare: "#FFB020",
          rose: "#C73E6D",
          copper: "#B86B4D",
          ink: "#0C0A0B",
          smoke: "#1A1517",
          /** Legacy class names → new palette values */
          teal: "#FF5349",
          mint: "#FFB020",
        },
        glass: {
          border: "rgba(255, 255, 255, 0.14)",
          "border-strong": "rgba(255, 83, 73, 0.35)",
          surface: "rgba(255, 255, 255, 0.06)",
          chrome: "rgba(18, 14, 16, 0.78)",
        },
      },
      backgroundImage: {
        "momentum-flow":
          "linear-gradient(to right, #FF5349 0%, #FFB020 51%, #FF5349 100%)",
        "momentum-flow-vertical":
          "linear-gradient(to bottom, rgba(255,83,73,0.14) 0%, rgba(255,176,32,0.08) 45%, rgba(255,83,73,0.12) 100%)",
        "glass-shine":
          "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 40%, rgba(255,83,73,0.08) 100%)",
      },
      backgroundSize: {
        "200-auto": "200% auto",
      },
      boxShadow: {
        glass: "0 4px 24px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        "glass-lg": "0 8px 40px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        "glass-glow": "0 0 32px rgba(255, 83, 73, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        "glass-chrome": "0 1px 0 rgba(255, 255, 255, 0.08) inset, 0 -1px 0 rgba(0, 0, 0, 0.2)",
      },
      backdropBlur: {
        glass: "24px",
        "glass-lg": "32px",
      },
      borderRadius: {
        glass: "1rem",
        "glass-lg": "1.25rem",
      },
    },
  },
  plugins: [],
};
