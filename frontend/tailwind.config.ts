import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0b0e1a',
          panel: '#0f1325',
          neonGreen: '#39ff14',
          neonCyan: '#22d3ee',
          neonPink: '#ff3caa',
          neonYellow: '#f5f749',
        },
      },
      boxShadow: {
        neonCyan: '0 0 10px rgba(34, 211, 238, 0.35), 0 0 20px rgba(34, 211, 238, 0.15)',
        neonPink: '0 0 10px rgba(255, 60, 170, 0.35), 0 0 20px rgba(255, 60, 170, 0.15)',
        neonGreen: '0 0 10px rgba(57, 255, 20, 0.35), 0 0 20px rgba(57, 255, 20, 0.15)',
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config 