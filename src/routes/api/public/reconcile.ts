import { eventHandler, getHeader, getQuery, getMethod, setResponseStatus } from "h3";
import { runReconciliation } from "../../../lib/reconcile.server";

export default eventHandler(async (event) => {
  const authHeader = getHeader(event, "Authorization");
  const method = getMethod(event);
  const cronSecret = process.env.CRON_SECRET || "default_cron_secret";

  if (method === "POST") {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      setResponseStatus(event, 401);
      return { error: "Unauthorized" };
    }

    try {
      const result = await runReconciliation();
      return { success: true, result };
    } catch (error: any) {
      console.error("Reconciliation endpoint error:", error);
      setResponseStatus(event, 500);
      return { error: error.message };
    }
  } else if (method === "GET") {
    const query = getQuery(event);
    const key = query.secret;

    if (!key || key !== cronSecret) {
      setResponseStatus(event, 401);
      return { error: "Unauthorized" };
    }

    try {
      const result = await runReconciliation();
      return { success: true, result };
    } catch (error: any) {
      console.error("Reconciliation endpoint error:", error);
      setResponseStatus(event, 500);
      return { error: error.message };
    }
  }

  setResponseStatus(event, 405);
  return { error: "Method Not Allowed" };
});
