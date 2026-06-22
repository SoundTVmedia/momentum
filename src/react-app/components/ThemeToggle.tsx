import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/react-app/contexts/ThemeContext';
import type { ThemePreference } from '@/react-app/lib/theme';

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export default function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[2];
  const ActiveIcon = active.Icon;

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 sm:p-2 text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors rounded-lg hover:bg-[var(--glass-bg-strong)]"
        title={`Theme: ${active.label}`}
        aria-label={`Theme: ${active.label}. Click to change.`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <ActiveIcon className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 min-w-[9.5rem] rounded-xl glass-dropdown py-1 z-[120] shadow-lg"
        >
          {OPTIONS.map(({ value, label, Icon }) => {
            const selected = preference === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setPreference(value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  selected
                    ? 'text-momentum-flare bg-[var(--glass-bg-strong)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg)] hover:text-[var(--text-body)]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
