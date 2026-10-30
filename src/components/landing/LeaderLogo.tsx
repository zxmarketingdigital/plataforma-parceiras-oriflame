"use client";

import { useState } from "react";

type LeaderLogoProps = {
  src: string;
  brand: string;
  className?: string;
};

export function LeaderLogo({ src, brand, className }: LeaderLogoProps) {
  // Guarda QUAL url falhou (não um booleano): ao navegar para outra líder o src muda e a imagem volta a tentar.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) return null;

  return <img alt={brand} className={className} decoding="async" onError={() => setFailedSrc(src)} referrerPolicy="no-referrer" src={src} />;
}
