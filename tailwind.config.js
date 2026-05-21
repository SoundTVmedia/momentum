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
          /** Arctic Pulse — cool frost glass + punchy bolt accents */
          ember: "#22D3EE",
          flare: "#F43F5E",
          rose: "#818CF8",
          copper: "#475569",
          ink: "#080B12",
          smoke: "#0F172A",
          glacier: "#67E8F9",
          /** Legacy class names */
          teal: "#22D3EE",
          mint: "#F43F5E",
        },
        glass: {
          border: "rgba(255, 255, 255, 0.12)",
          "border-strong": "rgba(34, 211, 238, 0.35)",
          surface: "rgba(255, 255, 255, 0.05)",
          chrome: "rgba(10, 14, 22, 0.82)",
        },
      },
      backgroundImage: {
        "momentum-flow":
          "linear-gradient(to right, #22D3EE 0%, #F43F5E 51%, #22D3EE 100%)",
        "momentum-flow-vertical":
          "linear-gradient(to bottom, rgba(34,211,238,0.12) 0%, rgba(244,63,94,0.07) 45%, rgba(34,211,238,0.1) 100%)",
        "glass-shine":
          "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 40%, rgba(34,211,238,0.08) 100%)",
      },
      backgroundSize: {
        "200-auto": "200% auto",
      },
      boxShadow: {
        glass: "0 4px 24px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        "glass-lg": "0 8px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        "glass-glow": "0 0 32px rgba(34, 211, 238, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
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
