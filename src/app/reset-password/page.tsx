import { Suspense } from "react";
import { ResetPasswordScreen } from "@/components/ResetPasswordScreen";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="loading-line">Cargando recuperación...</p>}>
      <ResetPasswordScreen />
    </Suspense>
  );
}
