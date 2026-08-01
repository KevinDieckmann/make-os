import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        /* Design tokens */
        zinc: {
          950: "#09090b",
          925: "#0e0e10",
          900: "#111113",
          875: "#18181b",
          800: "#27272a",
          700: "#3f3f46",
          600: "#52525b",
          500: "#71717a",
          400: "#a1a1aa",
          300: "#d4d4d8",
          200: "#e4e4e7",
          100: "#f4f4f5",
        },

        /* Neon accents */
        violet: {
          DEFAULT: "#8b5cf6",
          light: "#a78bfa",
          dark: "#7c3aed",
          glow: "rgba(139,92,246,0.15)",
        },
        emerald: {
          DEFAULT: "#10b981",
          light: "#34d399",
          glow: "rgba(16,185,129,0.12)",
        },
        rose: {
          DEFAULT: "#f43f5e",
          glow: "rgba(244,63,94,0.12)",
        },
        amber: {
          DEFAULT: "#f59e0b",
          glow: "rgba(245,158,11,0.12)",
        },

        /* Owner colors */
        malin: "#ec4899",
        kevin: "#3b82f6",
        joint: "#8b5cf6",
      },

      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },

      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem", letterSpacing: "0.02em" }],
        xs:   ["0.72rem",  { lineHeight: "1rem",      letterSpacing: "0.01em" }],
        sm:   ["0.8125rem",{ lineHeight: "1.25rem",   letterSpacing: "0.01em" }],
        base: ["0.9375rem",{ lineHeight: "1.5rem" }],
      },

      letterSpacing: {
        tight:   "-0.025em",
        tighter: "-0.04em",
        wide:    "0.04em",
        wider:   "0.08em",
      },

      borderRadius: {
        "4xl": "2rem",
        "3xl": "1.5rem",
        "2xl": "1rem",
        xl:    "0.75rem",
        lg:    "0.5rem",
        md:    "0.375rem",
        sm:    "0.25rem",
      },

      boxShadow: {
        "glow-violet": "0 0 40px rgba(139,92,246,0.14), 0 0 80px rgba(139,92,246,0.06)",
        "glow-emerald": "0 0 40px rgba(16,185,129,0.12), 0 0 80px rgba(16,185,129,0.05)",
        "glow-pink":   "0 0 40px rgba(236,72,153,0.12)",
        "glow-sm":     "0 0 16px rgba(139,92,246,0.1)",
        "card":        "0 1px 3px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.25)",
        "card-hover":  "0 4px 12px rgba(0,0,0,0.5), 0 16px 48px rgba(0,0,0,0.35)",
        "inner-border":"inset 0 1px 0 rgba(255,255,255,0.06)",
      },

      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":  "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "glass-gradient":  "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)",
        "violet-glow":     "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.15) 0%, transparent 70%)",
        "emerald-glow":    "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.12) 0%, transparent 70%)",
        "noise":           "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
      },

      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4,0,0.6,1) infinite",
        "shimmer": "shimmer 2s linear infinite",
        "float": "float 6s ease-in-out infinite",
        "gradient": "gradient 8s ease infinite",
        "fade-in": "fadeIn 0.4s ease forwards",
        "slide-up": "slideUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards",
      },

      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-6px)" },
        },
        gradient: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%":      { backgroundPosition: "100% 50%" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
      },

      spacing: {
        sidebar: "64px",
        "sidebar-expanded": "240px",
      },

      transitionTimingFunction: {
        spring: "cubic-bezier(0.22, 1, 0.36, 1)",
        bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
