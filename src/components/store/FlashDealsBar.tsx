"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { IconArrowUpRight, IconZap } from "./StoreIcons";

function computeRemainingToMidnight() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const diff = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
  return {
    hours: String(Math.floor(diff / 3600)).padStart(2, "0"),
    minutes: String(Math.floor((diff % 3600) / 60)).padStart(2, "0"),
    seconds: String(diff % 60).padStart(2, "0"),
  };
}

export function FlashDealsBar() {
  const [time, setTime] = useState<{ hours: string; minutes: string; seconds: string } | null>(null);

  useEffect(() => {
    const sync = () => setTime(computeRemainingToMidnight());
    const initial = window.setTimeout(sync, 0);
    const interval = window.setInterval(sync, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="store-flash-bar">
      <div className="store-flash-left">
        <span className="store-flash-tag">
          <IconZap size={13} />
          <span>OFERTAS DO DIA</span>
        </span>
        <span className="store-flash-sub">Seleção com condições especiais de PIX e envio rápido</span>
      </div>

      <div className="store-flash-right">
        <span className="store-flash-label">Ciclo atual termina em</span>
        <div className="store-flash-clock" aria-label="Tempo restante das ofertas do dia">
          <span>{time ? time.hours : "--"}</span>
          <em>:</em>
          <span>{time ? time.minutes : "--"}</span>
          <em>:</em>
          <span>{time ? time.seconds : "--"}</span>
        </div>
        <Link href="/loja/produtos?ordem=price_asc" className="store-flash-link">
          <span>Ver ofertas</span>
          <IconArrowUpRight size={13} />
        </Link>
      </div>
    </div>
  );
}
