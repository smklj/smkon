import React from "react";

export function TrustFeatures() {
  const features = [
    {
      icon: "⚡",
      title: "PIX Instantâneo",
      desc: "Confirmação imediata e processamento no mesmo instante.",
    },
    {
      icon: "📦",
      title: "Envio para todo Brasil",
      desc: "Rastreio integrado Correios e Jadlog com seguro total.",
    },
    {
      icon: "⭐",
      title: "Achados Verificados",
      desc: "Produtos testados pela equipe e pelo mascote oficial SMKON.",
    },
    {
      icon: "🔒",
      title: "Compra 100% Protegida",
      desc: "Infraestrutura segura, RLS e privacidade de dados.",
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
