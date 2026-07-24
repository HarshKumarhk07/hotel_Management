'use client';

import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

/** Lightweight centered modal dialog. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  widthClass = 'max-w-md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClass?: string;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`relative z-10 w-full ${widthClass} m-4 overflow-hidden rounded-2xl bg-white shadow-xl`}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
          >
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="font-bold text-zinc-900">{title}</h2>
              <button onClick={onClose} aria-label="Close">
                <X className="h-5 w-5 text-zinc-500" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
