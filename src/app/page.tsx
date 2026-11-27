import LojaLayout from "./loja/layout";
import LojaHomePage from "./loja/page";

export const revalidate = 60;

export default async function RootStorePage() {
  return (
    <LojaLayout>
      <LojaHomePage />
    </LojaLayout>
  );
}
