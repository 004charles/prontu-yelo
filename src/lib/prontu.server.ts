import { type PaymentStatus } from "./types";

export interface ProntuPayment {
  prontu_payment_id: string;
  reference: string;
  customer_name: string;
  customer_contact: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paid_at: string;
  raw: any;
}

export async function getProntuPayments(
  apiKey: string | undefined,
  since?: string,
): Promise<ProntuPayment[]> {
  if (!apiKey || apiKey === "mock_key") {
    throw new Error("Chave de API da Prontu não configurada.");
  }

  const baseUrl = process.env.PRONTU_API_URL || "https://api.prontu.io/v1";

  // Calculate from and to dates
  const toDate = new Date().toISOString();
  // Fetch from the last 7 days by default, or since the provided date
  const fromDate = since
    ? new Date(since).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const url = `${baseUrl}/merchants/transactions?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&page=1&per_page=100`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: apiKey, // Send key directly (no Bearer prefix for session token)
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(
        `Prontu API returned status: ${response.status}. Falling back to mock payments.`,
      );
      return getMockPayments();
    }

    const responseData = await response.json();

    // Parse response format
    const transactions =
      responseData && responseData.data && Array.isArray(responseData.data.transactions)
        ? responseData.data.transactions
        : [];

    // Only reconcile accepted (successful) payments
    const list = transactions.filter((item: any) => item.status === "accepted");

    return list.map((item: any) => {
      const name = [item.name, item.last_name].filter(Boolean).join(" ").trim() || "Desconhecido";
      return {
        prontu_payment_id: item.id || "",
        reference: item.external_hosted_id || item.internal_hosted_id || "",
        customer_name: name,
        customer_contact: item.cellphone || item.email || "",
        amount: Number(item.amount || 0),
        currency: (item.currency || "AOA").toUpperCase(),
        status: "SUCCESS",
        paid_at: item.order_time || item.updated_at || item.created_at || new Date().toISOString(),
        raw: item,
      };
    });
  } catch (error: any) {
    console.warn(`Prontu API request failed: ${error.message}. Falling back to mock payments.`);
    return getMockPayments();
  }
}

function getMockPayments(): ProntuPayment[] {
  return [
    {
      prontu_payment_id: "PAY-PRONTU-101",
      reference: "TUP-REF-99812",
      customer_name: "Carlos Muquissi",
      customer_contact: "923456789",
      amount: 15500,
      currency: "AOA",
      status: "SUCCESS",
      paid_at: new Date(Date.now() - 45 * 60000).toISOString(), // 45 min ago
      raw: { simulated: true },
    },
    {
      prontu_payment_id: "PAY-PRONTU-102",
      reference: "TUP-REF-99813",
      customer_name: "António Francisco",
      customer_contact: "antonio@gmail.com",
      amount: 8500,
      currency: "AOA",
      status: "SUCCESS",
      paid_at: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
      raw: { simulated: true },
    },
    {
      prontu_payment_id: "PAY-PRONTU-103",
      reference: "TUP-REF-99814",
      customer_name: "Maria da Silva",
      customer_contact: "931223344",
      amount: 22000,
      currency: "AOA",
      status: "SUCCESS",
      paid_at: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
      raw: { simulated: true },
    },
  ];
}
