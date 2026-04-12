/** Parse error message/details from a failed supabase.functions.invoke call. */
export async function readFunctionsInvokeFailure(
  error: unknown,
  data: unknown,
): Promise<{ message: string; details?: unknown }> {
  if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
    const d = data as { error: string; details?: unknown };
    return { message: d.error, details: d.details };
  }

  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const j = (await ctx.json()) as { error?: string; details?: unknown };
      if (typeof j.error === "string") {
        return { message: j.error, details: j.details };
      }
    } catch {
      /* body already read or not JSON */
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return { message };
}
