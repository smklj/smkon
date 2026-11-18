"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error(JSON.stringify({ level: "error", scope: "auth.signOut", message: error.message }));
  }
  redirect("/login");
}
