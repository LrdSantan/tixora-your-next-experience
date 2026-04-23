/**
 * Unified ticket token extraction logic.
 * Handles various formats:
 * - Full URL: https://tixoraafrica.com.ng/verify/TOKEN
 * - Full URL with query: https://tixoraafrica.com.ng/verify?token=TOKEN
 * - Raw token: TOKEN
 * - Any format with trailing slashes, newlines, or extra whitespace
 */
export function extractTicketToken(raw: string): string {
  if (!raw) return "";

  // 1. Basic cleaning: trim and remove newlines/tabs
  let cleaned = raw.trim().replace(/[\n\r\t]/g, "");

  // 2. Handle URL formats with query parameters (e.g., from email/PDF)
  if (cleaned.includes("?token=")) {
    try {
      // Use a fake base if the URL is relative (though unlikely here)
      const url = new URL(cleaned, "https://tixoraafrica.com.ng");
      const t = url.searchParams.get("token");
      if (t) return t.trim().replace(/\/+$/, "");
    } catch (e) {
      // Manual fallback for malformed URLs
      const match = cleaned.match(/\?token=([^&#\s]+)/);
      if (match) return match[1].replace(/\/+$/, "").trim();
    }
  }

  // 3. Handle path-based URLs (e.g., from native camera)
  if (cleaned.includes("/verify/")) {
    const parts = cleaned.split("/verify/");
    let t = parts[parts.length - 1];
    // Strip any remaining query params or hashes from this segment
    t = t.split("?")[0].split("#")[0];
    return t.replace(/\/+$/, "").trim();
  }

  // 4. Handle cases like site.com/verify?token=TOKEN but without the / before ?
  // or site.com/verifyTOKEN (if it ever happened)
  if (cleaned.includes("/verify")) {
     // If it contains /verify but wasn't caught by the above, it might be /verify?token=...
     // but the above check for ?token= already covers most of these.
  }

  // 5. Raw token or unrecognized format: strip trailing slashes and return
  return cleaned.replace(/\/+$/, "");
}
