import { NextResponse } from "next/server";
import { getUserGiveaways } from "@/lib/giveaways";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  if (!supabase || !admin) {
    return NextResponse.json({ error: "Falta configurar Supabase." }, { status: 500 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesion para ver tus sorteos." }, { status: 401 });
  }

  try {
    const giveaways = await getUserGiveaways(admin, user.id);
    return NextResponse.json({ giveaways });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar tus sorteos.", giveaways: [] },
      { status: 500 }
    );
  }
}
