import { exportFileName } from "./types.ts";

/**
 * Resposta de download do JSON do titular. Sem cache em nenhum nível (dado pessoal)
 * e nome de arquivo sem dado pessoal.
 */
export function contactExportResponse(contactId: string, data: unknown, now: Date = new Date()): Response {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(contactId, now)}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
