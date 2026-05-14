/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "var(--accent)",
          light: "var(--accent-light)",
          strong: "var(--accent-strong, #8b5cf6)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          1: "var(--surface)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
        bg: "var(--bg)",
        text: {
          DEFAULT: "var(--text)",
          2: "var(--text-2)",
        },
        muted: "var(--muted)",
        danger: "var(--red)",
        success: "var(--green)",
        warning: "var(--yellow)",
      },
      borderRadius: {
        xl: "var(--radius-xl, 16px)",
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
  safelist: [
    'group',
  ],
}
