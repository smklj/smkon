"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/http/errors";
import { errorFields, log } from "@/lib/observability/log";
import { updateProductStatus } from "@/lib/products/repository";
import { isProductStatus } from "@/lib/products/schema";
import { canAddEvidence, canEditProducts, decideEvidence, registerProduct, submitEvidence } from "@/lib/products/service";
import { findWorkspace } from "@/lib/tenancy/workspace";
import { formDataToRaw as fields, isUuid } from "@/lib/validation/fields";

export type FormState = { error?: string; ok?: string; at?: number } | null;

async function workspaceContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/produtos");
  const workspace = await findWorkspace(supabase, user.id);
  return { supabase, workspace };
}

export async function createProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, workspace } = await workspaceContext();
  if (!workspace || !canEditProducts(workspace.role)) return { error: "Apenas owner ou admin cadastram produtos." };
  let id: string;
  try {
    id = await registerProduct(supabase, workspace.organizationId, fields(formData));
  } catch (error) {
    log("warn", "products.create", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível salvar o produto.") };
  }
  revalidatePath("/produtos");
  redirect(`/produtos/${id}`);
}

export async function addEvidenceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const productId = String(formData.get("product_id") ?? "");
  if (!isUuid(productId)) return { error: "Produto inválido." };
  const { supabase, workspace } = await workspaceContext();
  if (!workspace || !canAddEvidence(workspace.role)) return { error: "Seu papel não permite adicionar evidências." };
  try {
    await submitEvidence(supabase, workspace.organizationId, productId, fields(formData));
  } catch (error) {
    log("warn", "products.evidence.add", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível registrar a evidência.") };
  }
  revalidatePath(`/produtos/${productId}`);
  return { ok: "Evidência registrada como pendente. Um owner ou admin precisa verificá-la.", at: Date.now() };
}

export async function reviewEvidenceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const productId = String(formData.get("product_id") ?? "");
  const { supabase, workspace } = await workspaceContext();
  if (!workspace || !canEditProducts(workspace.role)) return { error: "Apenas owner ou admin revisam evidências." };
  try {
    await decideEvidence(supabase, fields(formData));
  } catch (error) {
    log("warn", "products.evidence.review", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível revisar a evidência.") };
  }
  if (isUuid(productId)) revalidatePath(`/produtos/${productId}`);
  revalidatePath("/produtos");
  return { ok: "Revisão registrada e score recalculado." };
}

export async function setProductStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const productId = String(formData.get("product_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!isUuid(productId) || !isProductStatus(status)) return { error: "Dados inválidos." };
  const { supabase, workspace } = await workspaceContext();
  if (!workspace || !canEditProducts(workspace.role)) return { error: "Apenas owner ou admin alteram o status." };
  try {
    await updateProductStatus(supabase, workspace.organizationId, productId, status);
  } catch (error) {
    log("warn", "products.status", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível alterar o status.") };
  }
  revalidatePath(`/produtos/${productId}`);
  revalidatePath("/produtos");
  return { ok: "Status atualizado." };
}
