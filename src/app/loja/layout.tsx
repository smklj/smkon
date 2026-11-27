import type { Metadata } from "next";
import { getStoreSettings } from "@/lib/store/repository";
import { CartProvider } from "@/lib/store/cart-context";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { CartDrawer } from "@/components/store/CartDrawer";
import { StoreSupportBot } from "@/components/store/StoreSupportBot";
import "./store.css";

export const metadata: Metadata = {
  title: "SMKON — Loja Oficial | Achados Inteligentes, Escolhas Melhores",
  description:
    "Tecnologia, periféricos testados, achados da Shopee e soluções digitais selecionadas pela SMKON.",
};

export default async function LojaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getStoreSettings();

  return (
    <CartProvider>
      <div className="store-body">
        <StoreHeader settings={settings} />
        <main className="store-container">
          {children}
        </main>
        <CartDrawer />
        <StoreSupportBot storeName={settings.store_name} />
        <StoreFooter settings={settings} />
      </div>
    </CartProvider>
  );
}
