import Dexie, { type Table } from 'dexie';
import { getSupabaseClient } from './supabase';

export interface LocalTicket {
  id?: number;
  ticket_id: string;
  event_id: string;
  status: 'active' | 'used';
  synced: boolean;
}

export class TixoraDB extends Dexie {
  tickets!: Table<LocalTicket>;

  constructor() {
    super('TixoraDB');
    this.version(3).stores({
      tickets: '++id, ticket_id, event_id, status, synced'
    });
  }
}

export const db = new TixoraDB();

export async function syncTicketsToLocal(eventId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client not initialized');

  // Fetch active tickets for the event from Supabase
  const { data: remoteTickets, error } = await supabase
    .from('tickets')
    .select('id, qr_token, status')
    .eq('event_id', eventId)
    .eq('status', 'active');

  if (error) throw error;

  // Clear existing local tickets and populate with new ones
  await db.tickets.clear();

  if (remoteTickets && remoteTickets.length > 0) {
    const localTickets: LocalTicket[] = remoteTickets.map(t => ({
      ticket_id: t.qr_token || t.id, // qr_token is what scanners read
      event_id: eventId,
      status: 'active',
      synced: true
    }));
    await db.tickets.bulkAdd(localTickets);
  }
}

export async function validateTicketOffline(ticketId: string) {
  let cleanId = ticketId.trim();
  if (cleanId.includes('/verify/')) {
    cleanId = cleanId.split('/verify/').pop() || cleanId;
  }
  const ticket = await db.tickets.where('ticket_id').equals(cleanId).first();

  if (!ticket) {
    if (navigator.onLine) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("tickets")
          .select("id, is_used, ticket_code")
          .eq("qr_token", cleanId)
          .single();

        if (!error && data) {
          if (data.is_used) {
            return { success: false, message: "Ticket already used" };
          }
          // Mark used online
          const { error: markErr } = await supabase.rpc("mark_ticket_used", {
            p_ticket_code: data.ticket_code
          });
          
          if (!markErr) {
            return { success: true, message: "Checked in online!" };
          }
        }
      }
    }
    return { success: false, message: "Invalid ticket" };
  }

  if (ticket.status === 'used') {
    return { success: false, message: "Ticket already used" };
  }

  if (ticket.status === 'active') {
    // Update local status to used and mark as unsynced
    await db.tickets.update(ticket.id!, {
      status: 'used',
      synced: false
    });
    return { success: true, message: "Checked in successfully!" };
  }

  return { success: false, message: "Invalid ticket status" };
}

export async function getUnsyncedCount(): Promise<number> {
  return await db.tickets.where('synced').equals('false').count();
}

/**
 * Pushes unsynced offline scans to the Supabase backend.
 */
export async function pushOfflineScans(sessionToken: string) {
  if (!navigator.onLine) return; // Skip if offline

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const unsyncedTickets = await db.tickets.where('synced').equals('false').toArray();
  // Depending on how Dexie stores booleans and versions, we might need to query for boolean false
  const unsyncedTicketsReal = await db.tickets.filter(t => t.synced === false).toArray();
  
  const ticketsToSync = unsyncedTickets.length > 0 ? unsyncedTickets : unsyncedTicketsReal;

  if (ticketsToSync.length === 0) return;

  console.log(`Attempting to sync ${ticketsToSync.length} offline scans...`);

  for (const ticket of ticketsToSync) {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-ticket-checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ qr_token: ticket.ticket_id }),
      });

      if (response.ok) {
        // Mark as synced locally
        await db.tickets.update(ticket.id!, { synced: true });
        console.log(`Synced ticket: ${ticket.ticket_id}`);
      } else {
        const errorData = await response.json();
        console.warn(`Failed to sync ticket ${ticket.ticket_id}:`, errorData);
      }
    } catch (error) {
      console.error(`Error syncing ticket ${ticket.ticket_id}:`, error);
    }
  }
}
