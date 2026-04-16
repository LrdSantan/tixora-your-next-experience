import { getSupabaseClient } from "./supabase";

const QUEUE_KEY = "tixora_sync_queue";

export interface QueuedScan {
  id: string;
  ticket_code: string;
  scanned_at: string;
}

export const SyncQueue = {
  push(scan: QueuedScan) {
    const queue = this.get();
    // Avoid duplicates
    if (!queue.find(s => s.id === scan.id)) {
      queue.push(scan);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  },

  get(): QueuedScan[] {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    } catch (e) {
      console.error("Failed to parse sync queue", e);
      return [];
    }
  },

  remove(id: string) {
    const queue = this.get().filter(s => s.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  },

  async processQueue(onSuccess?: (ticketCode: string) => void) {
    const queue = this.get();
    if (queue.length === 0) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Process items sequentially to maintain order and avoid overwhelming the connection
    for (const scan of queue) {
      try {
        console.log(`[Sync] Processing ticket ${scan.ticket_code}...`);
        
        const { error } = await supabase.rpc("mark_ticket_used", {
          p_ticket_code: scan.ticket_code,
        });

        if (error) {
          // If already used, treat as success and remove from queue
          const errorMsg = error.message?.toLowerCase() || "";
          if (errorMsg.includes("already used")) {
            console.warn(`[Sync] Ticket ${scan.ticket_code} already marked as used on server. Removing from queue.`);
            this.remove(scan.id);
            if (onSuccess) onSuccess(scan.ticket_code);
            continue;
          }
          
          // Other error (e.g., auth, network timeout), keep in queue for retry
          console.error(`[Sync] Failed to mark ${scan.ticket_code}:`, error);
          continue;
        }

        // Success! Call rotate-qr-token edge function
        try {
          await fetch("https://hxvgoavigoopcgbmvltf.supabase.co/functions/v1/rotate-qr-token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": anonKey,
              "Authorization": `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ ticketId: scan.id }),
          });
        } catch (edgeError) {
          // Edge function failure is logged but we still consider the scan synced
          // because the ticket is already marked as used in the DB.
          console.error(`[Sync] Edge function rotate-qr-token failed for ${scan.id}:`, edgeError);
        }

        this.remove(scan.id);
        if (onSuccess) onSuccess(scan.ticket_code);
        console.log(`[Sync] Successfully synced ticket ${scan.ticket_code}`);
      } catch (err) {
        console.error(`[Sync] Unexpected error processing ${scan.ticket_code}:`, err);
      }
    }
  }
};
