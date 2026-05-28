/** @type {import('tailwindcss').Config} */
/** Active palette: neon-blue — see src/react-app/lib/design-palettes.ts */
export default {
  content: [
    "./index.html",
    "./src/react-app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        momentum: {
          /** Neon blue — cyan → electric blue → indigo */
          ember: "#22D3EE",
          flare: "#3B82F6",
          rose: "#6366F1",
          glacier: "#67E8F9",
          copper: "#1E3A5F",
          ink: "#030712",
          smoke: "#0F172A",
          teal: "#22D3EE",
          mint: "#3B82F6",
          /** Readable text on dark backgrounds */
          body: "#E8EDF4",
          secondary: "#C5D0DE",
          muted: "#A8B8C8",
          subtle: "#8FA3B8",
        },
        glass: {
          border: "rgba(255, 255, 255, 0.12)",
          "border-strong": "rgba(99, 102, 241, 0.38)",
          surface: "rgba(255, 255, 255, 0.05)",
          chrome: "rgba(3, 7, 18, 0.82)",
        },
      },
      backgroundImage: {
        "momentum-flow":
          "linear-gradient(to bottom left, #22d3ee 0%, #3b82f6 50%, #6366f1 100%)",
        "momentum-flow-vertical":
          "linear-gradient(to bottom, rgba(34,211,238,0.1) 0%, rgba(59,130,246,0.08) 45%, rgba(99,102,241,0.12) 100%)",
        "glass-shine":
          "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 40%, rgba(99,102,241,0.08) 100%)",
      },
      backgroundSize: {
        "200-auto": "200% auto",
      },
      boxShadow: {
        glass: "0 4px 24px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        "glass-lg": "0 8px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        "glass-glow": "0 0 32px rgba(99, 102, 241, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
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
