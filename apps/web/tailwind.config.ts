import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#ffffff",
        workspace: "#d8dee6",
        ink: "#1c1f24",
        accent: "#1d4ed8"
      },
      boxShadow: {
        page: "0 1px 2px rgb(16 24 40 / 8%), 0 18px 40px rgb(16 24 40 / 12%)"
      }
    }
  },
  plugins: []
} satisfies Config;
