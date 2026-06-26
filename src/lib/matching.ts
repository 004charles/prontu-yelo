export interface MatchResult {
  matched: boolean;
  type: "exact" | "fuzzy" | "none";
  score?: number;
  reason?: string;
}

export function cleanText(text?: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9\s]/g, "") // Remove caracteres especiais
    .trim();
}

export function checkNamesOverlap(nameA?: string, nameB?: string): boolean {
  const cleanA = cleanText(nameA);
  const cleanB = cleanText(nameB);
  if (!cleanA || !cleanB) return false;

  const wordsA = cleanA.split(/\s+/).filter((w) => w.length >= 3);
  const wordsB = cleanB.split(/\s+/).filter((w) => w.length >= 3);

  // Verifica se alguma palavra significativa de A está contida ou coincide com alguma em B
  return wordsA.some((w) => wordsB.some((wb) => wb.includes(w) || w.includes(wb)));
}

export function isExactMatch(payment: any, order: any): boolean {
  const pId = payment.prontu_payment_id;
  const pRef = payment.reference;
  const oRef = order.reference;
  const oPayRef = order.payment_ref;

  if (!pId) return false;

  return (
    (oPayRef && oPayRef === pId) ||
    (oRef && oRef === pId) ||
    (oPayRef && oPayRef === pRef) ||
    (oRef && oRef === pRef)
  );
}

export function reconcileMatch(payment: any, order: any): MatchResult {
  // 1. Correspondência exata por ID/Referência
  if (isExactMatch(payment, order)) {
    return { matched: true, type: "exact", score: 100, reason: "Referência/ID exata" };
  }

  // 2. Correspondência aproximada (Fuzzy)
  const pAmount = Number(payment.amount);
  const oAmount = Number(order.raw?.total_amount || order.raw?.order_amount || 0);

  // O valor tem de coincidir quase exatamente (tolerância de 1.0 AOA)
  const amountDiff = Math.abs(pAmount - oAmount);
  if (amountDiff > 1.0) {
    return { matched: false, type: "none" };
  }

  // Diferença de tempo
  const pTime = new Date(payment.paid_at).getTime();
  const oTime = new Date(order.created_at).getTime();
  const timeDiffHours = Math.abs(pTime - oTime) / (1000 * 60 * 60);

  // Regra A: Hora muito próxima (dentro de 2 horas)
  if (timeDiffHours <= 2) {
    return {
      matched: true,
      type: "fuzzy",
      score: 90,
      reason: `Valor igual e hora muito próxima (${Math.round(timeDiffHours * 60)} min)`,
    };
  }

  // Regra B: Dentro de 12 horas e há cruzamento no nome do cliente
  if (timeDiffHours <= 12) {
    const nameMatch = checkNamesOverlap(payment.customer_name, order.raw?.customer_username);
    if (nameMatch) {
      return {
        matched: true,
        type: "fuzzy",
        score: 80,
        reason: "Valor igual, hora próxima e nome do cliente semelhante",
      };
    }
  }

  return { matched: false, type: "none" };
}
