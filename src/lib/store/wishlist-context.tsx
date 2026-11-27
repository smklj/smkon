"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type WishlistContextValue = {
  favorites: string[];
  recentIds: string[];
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => void;
  trackView: (productId: string) => void;
  clearRecent: () => void;
  isWishlistOpen: boolean;
  openWishlist: () => void;
  closeWishlist: () => void;
};

const FAVORITES_KEY = "smkon_wishlist_v1";
const RECENT_KEY = "smkon_recent_v1";

function readStoredList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeStoredList(key: string, values: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Ignora erro de storage
  }
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);

  // Hidrata listas salvas apenas no cliente após montagem para evitar hydration mismatch SSR
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFavorites(readStoredList(FAVORITES_KEY));
      setRecentIds(readStoredList(RECENT_KEY));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      writeStoredList(FAVORITES_KEY, next);
      return next;
    });
  };

  const trackView = (productId: string) => {
    if (!productId) return;
    setRecentIds((prev) => {
      const filtered = prev.filter((id) => id !== productId);
      const next = [productId, ...filtered].slice(0, 8);
      writeStoredList(RECENT_KEY, next);
      return next;
    });
  };

  const clearRecent = () => {
    setRecentIds([]);
    writeStoredList(RECENT_KEY, []);
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  return (
    <WishlistContext.Provider
      value={{
        favorites,
        recentIds,
        isFavorite,
        toggleFavorite,
        trackView,
        clearRecent,
        isWishlistOpen,
        openWishlist: () => setIsWishlistOpen(true),
        closeWishlist: () => setIsWishlistOpen(false),
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    return {
      favorites: [],
      recentIds: [],
      isFavorite: () => false,
      toggleFavorite: () => {},
      trackView: () => {},
      clearRecent: () => {},
      isWishlistOpen: false,
      openWishlist: () => {},
      closeWishlist: () => {},
    };
  }
  return ctx;
}
