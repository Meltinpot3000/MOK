"use client";

import { useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

export type ConfirmBeforeSubmitFormProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Wenn false, wird ohne Dialog abgeschickt (z. B. nur Verknüpfen). Standard: true */
  requireConfirm?: boolean;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
};

export function ConfirmBeforeSubmitForm({
  title,
  description,
  confirmLabel = "Endgültig löschen",
  cancelLabel = "Abbrechen",
  requireConfirm = true,
  children,
  onSubmit,
  ...formProps
}: ConfirmBeforeSubmitFormProps) {
  const bypassRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!requireConfirm) {
      onSubmit?.(e);
      return;
    }
    if (!bypassRef.current) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    bypassRef.current = false;
    onSubmit?.(e);
  };

  const handleConfirm = () => {
    bypassRef.current = true;
    setOpen(false);
    queueMicrotask(() => formRef.current?.requestSubmit());
  };

  return (
    <>
      <form ref={formRef} {...formProps} onSubmit={handleSubmit}>
        {children}
      </form>
      {open ? (
        <ConfirmDialog
          title={title}
          description={description}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          onCancel={() => setOpen(false)}
          onConfirm={handleConfirm}
        />
      ) : null}
    </>
  );
}
