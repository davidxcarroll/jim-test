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
        'jim': ['JimCasual', 'sans-serif'],
        'chakra': ['var(--font-chakra-petch)', 'sans-serif'],
      },
      colors: {
        'nfl-blue': '#013369',
        'nfl-red': '#D50A0A',
        'baseball-green': '#0F5132',
        'diamond-white': '#F8F9FA',
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