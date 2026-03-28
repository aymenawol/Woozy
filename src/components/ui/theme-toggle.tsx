'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  }

  return (
    <button
      onClick={toggle}
      className={`relative flex h-8 w-14 items-center rounded-full border bg-muted p-0.5 transition-colors ${className}`}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span
        className={`flex size-7 items-center justify-center rounded-full bg-background shadow-sm transition-transform duration-200 ${
          dark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {dark ? <Moon className="size-3.5 text-primary" /> : <Sun className="size-3.5 text-amber-500" />}
      </span>
    </button>
  );
}
