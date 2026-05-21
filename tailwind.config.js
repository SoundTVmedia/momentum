/** @type {import('tailwindcss').Config} */
/** Active palette: green-option-2 — see src/react-app/lib/design-palettes.ts */
export default {
  content: [
    "./index.html",
    "./src/react-app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        momentum: {
          /** Green option 2 — lime → forest → teal */
          ember: "#84CC16",
          flare: "#16A34A",
          rose: "#0F766E",
          glacier: "#2DD4BF",
          copper: "#134E4A",
          ink: "#041210",
          smoke: "#0A1F1C",
          teal: "#84CC16",
          mint: "#16A34A",
        },
        glass: {
          border: "rgba(255, 255, 255, 0.12)",
          "border-strong": "rgba(15, 118, 110, 0.38)",
          surface: "rgba(255, 255, 255, 0.05)",
          chrome: "rgba(4, 18, 16, 0.82)",
        },
      },
      backgroundImage: {
        "momentum-flow":
          "linear-gradient(to bottom left, #84cc16 0%, #16a34a 50%, #0f766e 100%)",
        "momentum-flow-vertical":
          "linear-gradient(to bottom, rgba(132,204,22,0.1) 0%, rgba(22,163,74,0.08) 45%, rgba(15,118,110,0.12) 100%)",
        "glass-shine":
          "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 40%, rgba(15,118,110,0.08) 100%)",
      },
      backgroundSize: {
        "200-auto": "200% auto",
      },
      boxShadow: {
        glass: "0 4px 24px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        "glass-lg": "0 8px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        "glass-glow": "0 0 32px rgba(15, 118, 110, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        "glass-chrome": "0 1px 0 rgba(255, 255, 255, 0.08) inset, 0 -1px 0 rgba(0, 0, 0, 0.25)",
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
