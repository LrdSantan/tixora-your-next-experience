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
        if (item.eventDate) {
          const today = new Date().toISOString().split("T")[0];
          const eDate = item.eventDate.includes("T") ? item.eventDate.split("T")[0] : item.eventDate;
          if (eDate < today) return; // Guard against past events
        }
        const addedQty = item.initialQuantity || 1;
        const existing = get().items.find((i) => i.tierId === item.tierId);
        if (existing) {
          if (existing.quantity >= existing.maxQuantity) return; // Guard
          set({
            items: get().items.map((i) =>
              i.tierId === item.tierId ? { ...i, quantity: Math.min(i.quantity + addedQty, i.maxQuantity) } : i
            ),
          });
        } else {
          if (item.maxQuantity <= 0) return; // Guard
          set({ items: [...get().items, { ...item, quantity: Math.min(addedQty, item.maxQuantity) }] });
        }
      },
      removeItem: (tierId) =>
        set({ items: get().items.filter((i) => i.tierId !== tierId) }),
      updateQuantity: (tierId, quantity) => {
        if (quantity <= 0) {
          set({ items: get().items.filter((i) => i.tierId !== tierId) });
        } else {
          set({
            items: get().items.map((i) => {
              if (i.tierId === tierId) {
                return { ...i, quantity: Math.min(quantity, i.maxQuantity) };
              }
              return i;
            }),
          });
        }
      },
      clearCart: () => set({ items: [] }),
      toggleCart: () => set({ isOpen: !get().isOpen }),
      setCartOpen: (open) => set({ isOpen: open }),
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
    }),
    { name: "tixora-cart", partialize: (state) => ({ items: state.items }) }
  )
);
