import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'jim': ['JimCasual', '"Noto Emoji"', 'sans-serif'],
        'chakra': ['var(--font-chakra-petch)', '"Noto Emoji"', 'sans-serif'],
      },
      colors: {
        'nfl-blue': '#013369',
        'nfl-red': '#D50A0A',
        'baseball-green': '#0F5132',
        'diamond-white': '#F8F9FA',
        // Tailwind v4.2 default palettes (not in v3)
        mauve: {
          50: 'oklch(98.5% 0 0)',
          100: 'oklch(96% 0.003 325.6)',
          200: 'oklch(92.2% 0.005 325.62)',
          300: 'oklch(86.5% 0.012 325.68)',
          400: 'oklch(71.1% 0.019 323.02)',
          500: 'oklch(54.2% 0.034 322.5)',
          600: 'oklch(43.5% 0.029 321.78)',
          700: 'oklch(36.4% 0.029 323.89)',
          800: 'oklch(26.3% 0.024 320.12)',
          900: 'oklch(21.2% 0.019 322.12)',
          950: 'oklch(14.5% 0.008 326)',
        },
        olive: {
          50: 'oklch(98.8% 0.003 106.5)',
          100: 'oklch(96.6% 0.005 106.5)',
          200: 'oklch(93% 0.007 106.5)',
          300: 'oklch(88% 0.011 106.6)',
          400: 'oklch(73.7% 0.021 106.9)',
          500: 'oklch(58% 0.031 107.3)',
          600: 'oklch(46.6% 0.025 107.3)',
          700: 'oklch(39.4% 0.023 107.4)',
          800: 'oklch(28.6% 0.016 107.4)',
          900: 'oklch(22.8% 0.013 107.4)',
          950: 'oklch(15.3% 0.006 107.1)',
        },
        mist: {
          50: 'oklch(98.7% 0.002 197.1)',
          100: 'oklch(96.3% 0.002 197.1)',
          200: 'oklch(92.5% 0.005 214.3)',
          300: 'oklch(87.2% 0.007 219.6)',
          400: 'oklch(72.3% 0.014 214.4)',
          500: 'oklch(56% 0.021 213.5)',
          600: 'oklch(45% 0.017 213.2)',
          700: 'oklch(37.8% 0.015 216)',
          800: 'oklch(27.5% 0.011 216.9)',
          900: 'oklch(21.8% 0.008 223.9)',
          950: 'oklch(14.8% 0.004 228.8)',
        },
        taupe: {
          50: 'oklch(98.6% 0.002 67.8)',
          100: 'oklch(96% 0.002 17.2)',
          200: 'oklch(92.2% 0.005 34.3)',
          300: 'oklch(86.8% 0.007 39.5)',
          400: 'oklch(71.4% 0.014 41.2)',
          500: 'oklch(54.7% 0.021 43.1)',
          600: 'oklch(43.8% 0.017 39.3)',
          700: 'oklch(36.7% 0.016 35.7)',
          800: 'oklch(26.8% 0.011 36.5)',
          900: 'oklch(21.4% 0.009 43.1)',
          950: 'oklch(14.7% 0.004 49.3)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
export default config 