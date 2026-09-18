"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/hooks";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  /** When false the overlay click and Escape do nothing (a transaction in flight). */
  dismissable?: boolean;
}

/** Premium modal: graphite panel on a black scrim, no blur, no browser alert. */
export function Modal({ open, onClose, title, children, className, dismissable = true }: ModalProps) {
  const mounted = useMounted();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, dismissable, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-black/70" onClick={() => dismissable && onClose?.()} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={clsx("panel relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-b-none sm:max-w-lg sm:rounded-b-[14px]", className)}
          >
            {(title || dismissable) && (
              <div className="flex items-center justify-between border-b border-graphite px-5 py-4">
                <div className="label text-white">{title}</div>
                {dismissable && (
                  <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted transition-colors hover:bg-graphite hover:text-white">
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
            <div className="no-scrollbar overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
