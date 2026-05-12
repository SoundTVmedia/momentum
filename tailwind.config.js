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
      },
      backgroundImage: {
        "momentum-flow":
          "linear-gradient(to right, #02AAB0 0%, #00CDAC 51%, #02AAB0 100%)",
        "momentum-flow-vertical":
          "linear-gradient(to bottom, rgba(2,170,176,0.14) 0%, rgba(0,205,172,0.06) 45%, rgba(2,170,176,0.1) 100%)",
      },
      backgroundSize: {
        "200-auto": "200% auto",
      },
    },
  },
  plugins: [],
};
