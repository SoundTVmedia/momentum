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
          /** Verdant flow — citron → lime → grove */
          ember: "#FEF08A",
          flare: "#84CC16",
          rose: "#16A34A",
          glacier: "#A3E635",
          copper: "#3F6212",
          ink: "#060A08",
          smoke: "#0C140C",
          /** Legacy class names */
          teal: "#FEF08A",
          mint: "#84CC16",
        },
        glass: {
          border: "rgba(255, 255, 255, 0.12)",
          "border-strong": "rgba(132, 204, 22, 0.35)",
          surface: "rgba(255, 255, 255, 0.05)",
          chrome: "rgba(6, 12, 8, 0.82)",
        },
      },
      backgroundImage: {
        "momentum-flow":
          "linear-gradient(to right, #fef08a 0%, #84cc16 50%, #16a34a 100%)",
        "momentum-flow-vertical":
          "linear-gradient(to bottom, rgba(254,240,138,0.1) 0%, rgba(132,204,22,0.08) 45%, rgba(22,163,74,0.1) 100%)",
        "glass-shine":
          "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 40%, rgba(132,204,22,0.08) 100%)",
      },
      backgroundSize: {
        "200-auto": "200% auto",
      },
      boxShadow: {
        glass: "0 4px 24px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        "glass-lg": "0 8px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        "glass-glow": "0 0 32px rgba(132, 204, 22, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
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
