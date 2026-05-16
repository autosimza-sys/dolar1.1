"use client";

import { X } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";

type AuthModalProps = {
  open: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
};

export function AuthModal({ open, title = "Creá tu cuenta gratis", message, onClose }: AuthModalProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <button className="icon-button modal__close" aria-label="Cerrar" type="button" onClick={onClose}>
          <X size={20} />
        </button>
        <h2>{title}</h2>
        <p>{message ?? "Creá tu cuenta gratis para guardar tus alertas."}</p>
        <AuthForm compact onSuccess={onClose} />
      </div>
    </div>
  );
}
