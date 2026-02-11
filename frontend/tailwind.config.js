/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary - Orange (Cloudflare-inspired)
        primary: {
          DEFAULT: '#f6821f',
          dark: '#e5731a',
          light: '#ff9f47',
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f6821f',
          600: '#e5731a',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Secondary - Navy
        secondary: {
          DEFAULT: '#1e3a5f',
          light: '#2d4a6f',
          dark: '#0f172a',
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#1e3a5f',
          700: '#1a365d',
          800: '#153e75',
          900: '#0f172a',
        },
        // Accent - Blue
        accent: {
          DEFAULT: '#0051c3',
          light: '#3b82f6',
          dark: '#1e40af',
        },
        // Status colors
        success: {
          DEFAULT: '#059669',
          light: '#10b981',
          bg: '#d1fae5',
        },
        danger: {
          DEFAULT: '#dc2626',
          light: '#ef4444',
          bg: '#fee2e2',
        },
        warning: {
          DEFAULT: '#d97706',
          light: '#f59e0b',
          bg: '#fef3c7',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
    },
  },
  plugins: [],
}
