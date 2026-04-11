import { X, Plus, Minus, Trash2 } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { formatPrice } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const CartDrawer = () => {
  const { items, isOpen, setCartOpen, updateQuantity, removeItem, subtotal } = useCartStore();

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-foreground/30 z-50" onClick={() => setCartOpen(false)} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-background z-50 shadow-2xl animate-slide-in-right flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Your Cart</h2>
          <button onClick={() => setCartOpen(false)}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Your cart is empty</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {items.map((item) => (
                <div key={item.tierId} className="bg-card rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{item.eventTitle}</p>
                      <p className="text-xs text-muted-foreground">{item.tierName}</p>
                    </div>
                    <button onClick={() => removeItem(item.tierId)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.tierId, item.quantity - 1)} className="w-7 h-7 rounded-full border border-primary text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.tierId, item.quantity + 1)} className="w-7 h-7 rounded-full border border-primary text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="font-bold text-primary">{formatPrice(item.unitPrice * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-xl font-bold text-primary">{formatPrice(subtotal())}</span>
              </div>
              <Link to="/checkout" onClick={() => setCartOpen(false)}>
                <Button className="w-full bg-primary text-primary-foreground h-12 text-base font-semibold">
                  Go to Checkout
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default CartDrawer;
