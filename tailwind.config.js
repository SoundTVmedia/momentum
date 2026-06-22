/** @type {import('tailwindcss').Config} */
/** Active palette: crimson-pulse — see src/react-app/lib/design-palettes.ts */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/react-app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        momentum: {
          ember: "var(--momentum-ember)",
          flare: "var(--momentum-flare)",
          rose: "var(--momentum-rose)",
          glacier: "var(--momentum-glacier)",
          copper: "var(--momentum-copper)",
          ink: "var(--momentum-ink)",
          smoke: "var(--momentum-smoke)",
          teal: "var(--momentum-teal)",
          mint: "var(--momentum-mint)",
          body: "var(--text-body)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          subtle: "var(--text-subtle)",
        },
        glass: {
          border: "var(--glass-border)",
          "border-strong": "var(--glass-border-accent)",
          surface: "var(--glass-bg)",
          chrome: "var(--glass-chrome-bg)",
        },
      },
      backgroundImage: {
        "momentum-flow": "var(--momentum-grad)",
        "momentum-flow-vertical":
          "linear-gradient(to bottom, rgba(255,68,68,0.1) 0%, rgba(220,38,38,0.08) 45%, rgba(153,27,27,0.12) 100%)",
        "glass-shine": "var(--glass-highlight)",
      },
      backgroundSize: {
        "200-auto": "200% auto",
      },
      boxShadow: {
        glass: "var(--glass-shadow)",
        "glass-lg": "var(--glass-shadow-lg)",
        "glass-glow": "0 0 32px rgba(220, 38, 38, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
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
