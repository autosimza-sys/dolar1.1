"use client";

import { FormEvent, useEffect, useState } from "react";
import { Send, ShieldAlert } from "lucide-react";
import type { CommunityReport } from "@/lib/types";

const departments = [
  "Capital",
  "Godoy Cruz",
  "Guaymallén",
  "Las Heras",
  "Maipú",
  "Luján de Cuyo",
  "San Martín",
  "San Rafael",
  "Tunuyán",
  "Otro"
];

const currencies = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "Euro" },
  { value: "BRL", label: "Real" },
  { value: "CLP", label: "Peso chileno" }
];

function formatReport(report: CommunityReport) {
  const verb = report.operation_type === "buy" ? "Compré" : "Vendí";
  return `${verb} ${report.currency} ${Number(report.amount).toLocaleString("es-AR")} a $${Number(report.rate).toLocaleString("es-AR")} en ${report.department}.`;
}

export function CommunityReports() {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadReports() {
    const response = await fetch("/api/community/reports", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({ reports: [] }))) as { reports?: CommunityReport[] };
    setReports(payload.reports ?? []);
  }

  useEffect(() => {
    void loadReports();
  }, []);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/community/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation_type: formData.get("operation_type"),
        currency: formData.get("currency"),
        amount: formData.get("amount"),
        rate: formData.get("rate"),
        department: formData.get("department"),
        comment: formData.get("comment")
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    setMessage(payload.error ?? payload.message ?? "Listo.");
    setIsSubmitting(false);

    if (response.ok) {
      event.currentTarget.reset();
      await loadReports();
    }
  }

  return (
    <section className="section community-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Comunidad mendocina</p>
          <h2>Operaciones informadas</h2>
        </div>
      </div>

      <div className="community-panel">
        <p className="legal-note">
          Los valores publicados por usuarios corresponden a operaciones informadas de manera independiente y no representan una
          cotización oficial ni fijan precios de mercado.
        </p>

        <form className="community-form" onSubmit={submitReport}>
          <div className="admin-fields">
            <label className="field field--tight">
              <span>Operacion</span>
              <select name="operation_type" required>
                <option value="buy">Compra</option>
                <option value="sell">Venta</option>
              </select>
            </label>
            <label className="field field--tight">
              <span>Moneda</span>
              <select name="currency" required>
                {currencies.map((currency) => (
                  <option key={currency.value} value={currency.value}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field--tight">
              <span>Departamento</span>
              <select name="department" required>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-fields">
            <label className="field field--tight">
              <span>Monto</span>
              <input min="1" name="amount" required step="0.01" type="number" />
            </label>
            <label className="field field--tight">
              <span>Cotizacion</span>
              <input min="0.01" name="rate" required step="0.01" type="number" />
            </label>
            <label className="field field--tight">
              <span>Comentario opcional</span>
              <input maxLength={240} name="comment" placeholder="Sin datos de contacto" />
            </label>
          </div>

          <button className="button button--full" disabled={isSubmitting} type="submit">
            <Send size={17} />
            {isSubmitting ? "Enviando..." : "Informar operacion"}
          </button>
        </form>

        {message ? (
          <p className="notice">
            <ShieldAlert size={16} />
            {message}
          </p>
        ) : null}

        <div className="community-list">
          {reports.map((report) => (
            <article key={report.id}>
              <strong>{formatReport(report)}</strong>
              {report.comment ? <span>{report.comment}</span> : null}
            </article>
          ))}
          {!reports.length ? <div className="empty-state">Todavía no hay operaciones informadas.</div> : null}
        </div>
      </div>
    </section>
  );
}
