import { Suspense } from "react";
import { AlertBuilder } from "@/components/AlertBuilder";

export default function AlertsPage() {
  return (
    <Suspense fallback={<p className="loading-line">Cargando alertas...</p>}>
      <AlertBuilder />
    </Suspense>
  );
}
