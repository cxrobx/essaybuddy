"use client";

import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "zora-theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    } else if (document.documentElement.classList.contains("dark")) {
      setTheme("dark");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem(STORAGE_KEY, next);
  }, [theme]);

  return { theme, toggleTheme };
}
