import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        riskHigh: "#A32D2D",
        riskMedium: "#BA7517",
        riskLow: "#3B6D11",
        ink: "#1F2937"
      }
    }
  },
  plugins: []
};

export default config;

