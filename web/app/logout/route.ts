import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}
