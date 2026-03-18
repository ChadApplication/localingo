"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Using mounted state to prevent hydration mismatch for the icon itself
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="p-2 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors opacity-0">
        <div className="w-5 h-5" />
      </button>
    ); // Placeholder to maintain space before hydration
  }

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light"); // if system, go back to light
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
      title="테마 변경 (밝게 / 어둡게 / 시스템)"
    >
      {theme === "light" ? (
        <Sun className="w-5 h-5 text-yellow-500" />
      ) : theme === "dark" ? (
        <Moon className="w-5 h-5 text-blue-400" />
      ) : (
        <div className="relative">
          <Sun className="w-5 h-5 absolute opacity-0 transition-opacity dark:opacity-100" />
          <Moon className="w-5 h-5 opacity-100 transition-opacity dark:opacity-0" />
          <span className="sr-only">Toggle theme</span>
        </div>
      )}
    </button>
  );
}
