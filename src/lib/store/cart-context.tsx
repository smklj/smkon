"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { CartItem, ShippingOption, StoreCouponInfo, StoreProduct } from "./types";

type CartContextType = {
  items: CartItem[];
  addItem: (product: StoreProduct, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  coupon: StoreCouponInfo | null;
  setCoupon: (coupon: StoreCouponInfo | null) => void;
  shippingOption: ShippingOption | null;
  setShippingOption: (option: ShippingOption | null) => void;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  itemCount: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "smkon_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [coupon, setCoupon] = useState<StoreCouponInfo | null>(null);
  const [shippingOption, setShippingOption] = useState<ShippingOption | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Fallback
    }
  }, [items]);

  const addItem = (product: StoreProduct, quantity = 1) => {
    // Produtos Shopee/afiliados externos abrem direto o link oficial
    if (product.fulfillment_mode === "external_affiliate" && product.affiliate_url) {
      window.open(product.affiliate_url, "_blank", "noopener,noreferrer");
      return;
    }

    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        const newQty = existing.quantity + quantity;
        const cappedQty = product.track_inventory && product.stock_quantity < newQty
          ? product.stock_quantity
          : newQty;
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: cappedQty } : i
        );
      }

      const newItem: CartItem = {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        priceCents: product.price_cents,
        compareAtPriceCents: product.compare_at_price_cents,
        imageUrl: product.image_urls[0] || "/brand/brand-identity-board.jpg",
        quantity: Math.max(1, quantity),
        fulfillmentMode: product.fulfillment_mode,
        digitalDeliveryType: product.digital_delivery_type,
        maxStock: product.stock_quantity,
        trackInventory: product.track_inventory,
        weightGrams: product.weight_grams,
        dimensions: {
          height: product.height_cm || 5,
          width: product.width_cm || 15,
          length: product.length_cm || 20,
        },
      };

      return [...prev, newItem];
    });

    setIsCartOpen(true);
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => {
        if (i.productId !== productId) return i;
        const cappedQty = i.trackInventory && i.maxStock < quantity ? i.maxStock : quantity;
        return { ...i, quantity: cappedQty };
      })
    );
  };

  const clearCart = () => {
    setItems([]);
    setCoupon(null);
    setShippingOption(null);
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const subtotalCents = items.reduce((acc, i) => acc + i.priceCents * i.quantity, 0);

  let discountCents = 0;
  if (coupon) {
    if (coupon.discountType === "percentage") {
      discountCents = Math.round((subtotalCents * coupon.discountValue) / 100);
    } else {
      discountCents = Math.min(coupon.discountValue, subtotalCents);
    }
  }

  // Verifica se o frete é aplicável (se houver pelo menos um produto físico)
  const hasPhysical = items.some((i) => i.fulfillmentMode === "internal_physical");
  const shippingCents = hasPhysical && shippingOption ? shippingOption.priceCents : 0;

  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);
  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        coupon,
        setCoupon,
        shippingOption,
        setShippingOption,
        subtotalCents,
        discountCents,
        shippingCents,
        totalCents,
        itemCount,
        isCartOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
