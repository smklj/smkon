"use client";

import { useRef, useState } from "react";
import { registerMediaAction } from "@/app/(app)/midia/actions";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_ACCEPT, MEDIA_BUCKET, mediaStoragePath, validateMediaFile } from "@/lib/media/types";

/** Upload direto do navegador ao Storage (o bucket recusa tipos e tamanhos fora do permitido). */
export function MediaUpload({ organizationId }: { organizationId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    const file = input.current?.files?.[0];
    if (!file) {
      setError("Escolha um arquivo.");
      return;
    }
    setBusy(true);
    try {
      const { ext } = validateMediaFile(file);
      const path = mediaStoragePath(organizationId, crypto.randomUUID(), ext);
      const { error: uploadError } = await createClient()
        .storage.from(MEDIA_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error("O Storage recusou o arquivo. Confira formato, tamanho e seu papel no workspace.");
      const result = await registerMediaAction(path, file.name);
      if (result?.error) throw new Error(result.error);
      setNotice(result?.ok ?? "Arquivo enviado.");
      if (input.current) input.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="invitations" onSubmit={upload}>
      <div className="inline-form">
        <label className="sr-only" htmlFor="media-file">Arquivo de mídia</label>
        <input id="media-file" ref={input} type="file" accept={MEDIA_ACCEPT} disabled={busy} />
        <button type="submit" className="button button-primary" disabled={busy}>{busy ? "Enviando…" : "Enviar arquivo"}</button>
      </div>
      <p className="muted">MP4, MOV, JPG, PNG ou WebP, até 50 MB. O arquivo fica privado no workspace.</p>
      {error ? <p className="feedback feedback-error" role="alert">{error}</p> : null}
      {notice ? <p className="feedback feedback-ok" role="status">{notice}</p> : null}
    </form>
  );
}
