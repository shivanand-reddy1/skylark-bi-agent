import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        skylark: {
          blue: '#1a3a5c',
          lightblue: '#2563eb',
          accent: '#f59e0b',
          bg: '#f0f4f8',
        },
      },
    },
  },
  plugins: [],
}
export default config
