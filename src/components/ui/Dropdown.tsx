"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface DropdownItem<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface DropdownProps<T extends string | number> {
  items: DropdownItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  /** Lift the icon 2 px on hover (chain selectors). */
  lift?: boolean;
  size?: "md" | "lg";
  align?: "left" | "right";
}

/** A quiet select. The glyph lifts 2 px on hover; the menu is a graphite panel. */
export function Dropdown<T extends string | number>({ items, value, onChange, ariaLabel, className, lift = true, size = "md", align = "left" }: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = items.find((i) => i.value === value) ?? items[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setCursor((c) => Math.min(items.length - 1, c + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    }
    if (e.key === "Enter" && open) {
      e.preventDefault();
      const item = items[cursor];
      if (item && !item.disabled) {
        onChange(item.value);
        setOpen(false);
      }
    }
  };

  return (
    <div ref={root} className={clsx("relative", className)} onKeyDown={onKey}>
      <button
        type="button"
        data-portal-interactive=""
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-controls={`${id}-menu`}
        onClick={() => {
          setOpen((o) => !o);
          setCursor(Math.max(0, items.findIndex((i) => i.value === value)));
        }}
        className={clsx(
          "group field flex w-full items-center gap-3 text-left transition-colors",
          size === "lg" ? "h-14 px-4" : "h-11 px-3",
        )}
      >
        {current?.icon && (
          <span className={clsx("flex shrink-0 items-center justify-center transition-transform duration-200 ease-out", lift && "group-hover:-translate-y-0.5")}>{current.icon}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className={clsx("block truncate font-medium", size === "lg" ? "text-[15px]" : "text-sm")}>{current?.label}</span>
          {current?.hint && <span className="label mt-0.5 block truncate normal-case tracking-normal text-muted">{current.hint}</span>}
        </span>
        <ChevronDown size={16} className={clsx("shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            id={`${id}-menu`}
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={clsx("panel absolute z-40 mt-2 min-w-full overflow-hidden p-1 shadow-[0_24px_60px_rgba(0,0,0,0.6)]", align === "right" ? "right-0" : "left-0")}
          >
            {items.map((item, i) => {
              const selected = item.value === value;
              return (
                <li key={String(item.value)} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    disabled={item.disabled}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    className={clsx(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      selected ? "bg-graphite-2 text-white" : "text-white/85",
                      cursor === i && !selected && "bg-graphite",
                      item.disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {item.icon && <span className="flex shrink-0 items-center justify-center">{item.icon}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.label}</span>
                      {item.hint && <span className="label mt-0.5 block truncate normal-case tracking-normal">{item.hint}</span>}
                    </span>
                    {selected && <span className="size-1.5 rounded-full bg-energy" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
