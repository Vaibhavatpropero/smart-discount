/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // Add paths to your .tsx, .jsx, .ts, and .js files
    "./app/**/*.{ts,tsx,js,jsx}",
    "./app/components/**/*.{ts,tsx,js,jsx}",
    "./app/routes/**/*.{ts,tsx,js,jsx}",
    // Add other routes according to the structure of your project
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

