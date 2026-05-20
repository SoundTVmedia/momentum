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
          teal: "#02AAB0",
          mint: "#00CDAC",
        },
        glass: {
          border: "rgba(255, 255, 255, 0.14)",
          "border-strong": "rgba(2, 170, 176, 0.35)",
          surface: "rgba(255, 255, 255, 0.06)",
          chrome: "rgba(6, 10, 14, 0.75)",
        },
      },
      backgroundImage: {
        "momentum-flow":
          "linear-gradient(to right, #02AAB0 0%, #00CDAC 51%, #02AAB0 100%)",
        "momentum-flow-vertical":
          "linear-gradient(to bottom, rgba(2,170,176,0.14) 0%, rgba(0,205,172,0.06) 45%, rgba(2,170,176,0.1) 100%)",
        "glass-shine":
          "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 40%, rgba(2,170,176,0.08) 100%)",
      },
      backgroundSize: {
        "200-auto": "200% auto",
      },
      boxShadow: {
        glass: "0 4px 24px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        "glass-lg": "0 8px 40px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        "glass-glow": "0 0 32px rgba(2, 170, 176, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
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
