import React from "react";
import { IconCheck, IconShield, IconTruck, IconZap } from "./StoreIcons";

export function TrustFeatures() {
  const features = [
    {
      icon: <IconZap size={20} />,
      title: "PIX Instantâneo",
      desc: "Confirmação automática em segundos e liberação imediata.",
    },
    {
      icon: <IconTruck size={20} />,
      title: "Logística Rastrada",
      desc: "Envio integrado Correios e transportadoras para todo o Brasil.",
    },
    {
      icon: <IconCheck size={20} />,
      title: "Curadoria Verificada",
      desc: "Produtos físicos, sistemas e ofertas avaliadas tecnicamente.",
    },
    {
      icon: <IconShield size={20} />,
      title: "Ambiente Blindado",
      desc: "Criptografia SSL, proteção anti-fraude e respeito à LGPD.",
    },
  ];

  return (
    <div className="store-trust-grid">
      {features.map((f, i) => (
        <div key={i} className="store-trust-card">
          <div className="store-trust-icon">{f.icon}</div>
          <div className="store-trust-info">
            <h4>{f.title}</h4>
            <p>{f.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
