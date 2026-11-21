import { headers } from "next/headers";
import { NONCE_HEADER } from "@/lib/http/security-headers";
import StudioClient from "./studio-client";

export const metadata = {
  title: "Content Studio",
  description: "Central de criação, adaptação e aprovação de conteúdo da SMKON.",
};

export default async function StudioPage() {
  // O nonce da CSP desta resposta vai para a prévia de infoproduto (iframe srcdoc herda a CSP).
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  return <StudioClient styleNonce={nonce} />;
}
