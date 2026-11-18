import StudioClient from "./studio-client";

export const metadata = {
  title: "Content Studio",
  description: "Central de criação, adaptação e aprovação de conteúdo da SMKON.",
};

export default function StudioPage() {
  return <StudioClient />;
}
