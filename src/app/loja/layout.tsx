import type { Metadata } from "next";
import { Suspense } from "react";
import { getStoreSettings } from "@/lib/store/repository";
import { CartProvider } from "@/lib/store/cart-context";
import { WishlistProvider } from "@/lib/store/wishlist-context";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { CartDrawer } from "@/components/store/CartDrawer";
import { WishlistDrawer } from "@/components/store/WishlistDrawer";
import { StoreSupportBot } from "@/components/store/StoreSupportBot";
import { StoreShell } from "@/components/store/StoreShell";
import "./store.css";

export const metadata: Metadata = {
  title: "SMKON — Loja Oficial | Tecnologia, Infoprodutos & Engenharia",
  description:
    "Tecnologia, periféricos testados, achados da Shopee, infoprodutos digitais e soluções sob medida pela SMKON.",
};

export default async function LojaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getStoreSettings();

  return (
    <CartProvider>
      <WishlistProvider>
        <Suspense fallback={<div style={{ minHeight: "100vh", background: "#050507" }} />}>
          <StoreShell
            settings={settings}
            header={<StoreHeader settings={settings} />}
            overlays={
              <>
                <CartDrawer />
                <WishlistDrawer />
                <StoreSupportBot storeName={settings.store_name} />
              </>
            }
            footer={<StoreFooter settings={settings} />}
          >
            {children}
          </StoreShell>
        </Suspense>
      </WishlistProvider>
    </CartProvider>
  );
}
