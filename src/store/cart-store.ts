import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  eventId: string;
  eventTitle: string;
  eventDate?: string;
  tierId: string;
  tierName: string;
  quantity: number;
  unitPrice: number;
  maxQuantity: number;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "quantity"> & { initialQuantity?: number }) => void;
  removeItem: (tierId: string) => void;
  updateQuantity: (tierId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  setCartOpen: (open: boolean) => void;
  totalItems: () => number;
  subtotal: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        // Guard against past events
        if (item.eventDate) {
          const today = new Date().toISOString().split("T")[0];
          const eDate = item.eventDate.includes("T") ? item.eventDate.split("T")[0] : item.eventDate;
          if (eDate < today) return;
        }

        // FORCE CASTING: Ensure price, maxQty, and addedQty are clean numbers
        const unitPrice = Number(item.unitPrice) || 0;
        const maxQuantity = Number(item.maxQuantity) || 0;
        const addedQty = Math.floor(Number(item.initialQuantity || 1)) || 0;

        const existing = get().items.find((i) => i.tierId === item.tierId);

        if (existing) {
          // If already at max, do nothing
          if (existing.quantity >= maxQuantity) return;

          set({
            items: get().items.map((i) =>
              i.tierId === item.tierId
                ? {
                  ...i,
                  quantity: Math.min(i.quantity + addedQty, maxQuantity),
                  unitPrice, // Keep price updated
                  maxQuantity // Keep stock updated
                }
                : i
            ),
          });
        } else {
          // Don't add if no stock
          if (maxQuantity <= 0 && addedQty <= 0) return;

          set({
            items: [
              ...get().items,
              {
                ...item,
                unitPrice,
                maxQuantity,
                quantity: Math.min(addedQty, maxQuantity),
              },
            ],
          });
        }
      },

      removeItem: (tierId) =>
        set({ items: get().items.filter((i) => i.tierId !== tierId) }),

      updateQuantity: (tierId, quantity) => {
        const cleanQty = Math.floor(Number(quantity)); // Sanitize input to integer

        if (isNaN(cleanQty) || cleanQty <= 0) {
          set({ items: get().items.filter((i) => i.tierId !== tierId) });
        } else {
          set({
            items: get().items.map((i) => {
              if (i.tierId === tierId) {
                // Respect stock limits stored in the item
                return { ...i, quantity: Math.min(cleanQty, Number(i.maxQuantity) || 0) };
              }
              return i;
            }),
          });
        }
      },

      clearCart: () => set({ items: [] }),

      toggleCart: () => set({ isOpen: !get().isOpen }),

      setCartOpen: (open) => set({ isOpen: open }),

      totalItems: () =>
        get().items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0),

      subtotal: () =>
        get().items.reduce((sum, i) => {
          const price = Number(i.unitPrice) || 0;
          const qty = Number(i.quantity) || 0;
          return sum + (qty * price);
        }, 0),
    }),
    {
      name: "tixora-cart",
      partialize: (state) => ({ items: state.items })
    }
  )
);