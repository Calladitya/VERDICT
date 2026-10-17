/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Verdict navy — primary brand
        brand: {
          50: "#eef2f8",
          100: "#d9e1ee",
          200: "#b7c5dd",
          300: "#8ba1c4",
          400: "#5c78a3",
          500: "#3a5583",
          600: "#274169",
          700: "#1d3157",
          800: "#182948",
          900: "#141f38",
          950: "#0d1526",
        },
        // Verdict green — accent
        accent: {
          50: "#eaf7ee",
          100: "#cceed6",
          200: "#9fdfb1",
          300: "#6bcc86",
          400: "#45b45c",
          500: "#2e9f43",
          600: "#248537",
          700: "#1e6c2e",
          800: "#1a5527",
          900: "#154321",
        },
        ink: {
          DEFAULT: "#0f172a",
          soft: "#334155",
          muted: "#64748b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        serif: ["Georgia", "Times New Roman", "serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.06)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};
