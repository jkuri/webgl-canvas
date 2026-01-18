import { useEffect, useState } from "react";
import { type Theme, ThemeProviderContext } from "@/contexts/theme-context";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

const IS_SERVER = typeof window === "undefined";

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "foil-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (IS_SERVER) return defaultTheme;
    return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
  });
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (IS_SERVER) return false;
    return theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  useEffect(() => {
    if (IS_SERVER) return;

    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

      root.classList.add(systemTheme);
      setIsDark(systemTheme === "dark");
      return;
    }

    root.classList.add(theme);
    setIsDark(theme === "dark");
  }, [theme]);

  const value = {
    theme,
    isDark,
    setTheme: (theme: Theme) => {
      if (!IS_SERVER) {
        localStorage.setItem(storageKey, theme);
      }
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
