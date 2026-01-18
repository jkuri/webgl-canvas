import { createContext } from "react";

export type Theme = "dark" | "light" | "system";

export type ThemeProviderState = {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
};

export const initialState: ThemeProviderState = {
  theme: "system",
  isDark: false,
  setTheme: () => null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);
