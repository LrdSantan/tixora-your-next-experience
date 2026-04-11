import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  eventId: string;
  eventTitle: string;
  tierId: string;
  tierName: string;
  quantity: number;
  unitPrice: number;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "quantity">) => void;
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
        const existing = get().items.find((i) => i.tierId === item.tierId);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.tierId === item.tierId ? { ...i, quantity: i.quantity + 1 } : i
            ),
          });
        } else {
          set({ items: [...get().items, { ...item, quantity: 1 }] });
        }
      },
      removeItem: (tierId) =>
        set({ items: get().items.filter((i) => i.tierId !== tierId) }),
      updateQuantity: (tierId, quantity) => {
        if (quantity <= 0) {
          set({ items: get().items.filter((i) => i.tierId !== tierId) });
        } else {
          set({
            items: get().items.map((i) =>
              i.tierId === tierId ? { ...i, quantity } : i
            ),
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
