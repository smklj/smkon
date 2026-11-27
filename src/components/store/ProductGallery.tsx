"use client";

import React, { useState } from "react";

export function ProductGallery({
  images,
  productName,
}: {
  images: string[];
  productName: string;
}) {
  const safeImages = images.length > 0 ? images : ["/brand/brand-identity-board.jpg"];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeImage = safeImages[selectedIndex] || safeImages[0];

  return (
    <div>
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: "14px",
          overflow: "hidden",
          background: "#090a0f",
          border: "1px solid var(--store-border-strong)",
          marginBottom: "14px",
          position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeImage}
          alt={productName}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transition: "transform 0.35s ease",
          }}
        />
      </div>

      {safeImages.length > 1 && (
        <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
          {safeImages.map((url, i) => {
            const isActive = i === selectedIndex;
            return (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setSelectedIndex(i)}
                aria-label={`Ver imagem ${i + 1} de ${productName}`}
                style={{
                  padding: 0,
                  background: "none",
                  borderRadius: "8px",
                  border: isActive
                    ? "2px solid var(--store-accent)"
                    : "1px solid var(--store-border)",
                  overflow: "hidden",
                  cursor: "pointer",
                  flexShrink: 0,
                  opacity: isActive ? 1 : 0.72,
                  transition: "all 0.18s ease",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${productName} miniatura ${i + 1}`}
                  style={{
                    width: "68px",
                    height: "68px",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
