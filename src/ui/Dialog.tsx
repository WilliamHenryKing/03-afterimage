import { type ReactNode, useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}

/** Native modal dialog: focus trapping, Escape and the backdrop come from the platform. */
export function Dialog({ open, onClose, label, children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      className={`glass m-auto max-h-[calc(100dvh-24px)] w-[min(100vw-24px,var(--w))] overflow-y-auto rounded-2xl p-0 text-paper ${className ?? ""}`}
    >
      {open && children}
    </dialog>
  );
}
