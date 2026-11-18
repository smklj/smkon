"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/observability/log";

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    log("error", "auth.signOut", errorFields(error));
  }
  redirect("/login");
}
