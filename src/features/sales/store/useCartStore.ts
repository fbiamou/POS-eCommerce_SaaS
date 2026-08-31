import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  productId: string;
  quantity: number;
};

interface CartState {
  cart: CartItem[];
  selectedClientId: string;
  paidAmount: string;
  isCreatingClient: boolean;
  newClientName: string;
  newClientPhone: string;
  addToCart: (productId: string, maxStock: number) => void;
  updateQuantity: (productId: string, delta: number, maxStock: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  setSelectedClientId: (id: string) => void;
  setPaidAmount: (amount: string) => void;
  setIsCreatingClient: (isCreating: boolean) => void;
  setNewClientName: (name: string) => void;
  setNewClientPhone: (phone: string) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      cart: [],
      selectedClientId: '',
      paidAmount: '',
      isCreatingClient: false,
      newClientName: '',
      newClientPhone: '',

      addToCart: (productId, maxStock) => set((state) => {
        const existing = state.cart.find((item) => item.productId === productId);
        if (existing) {
          if (existing.quantity >= maxStock) return state;
          return {
            cart: state.cart.map((item) =>
              item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
            )
          };
        }
        return { cart: [...state.cart, { productId, quantity: 1 }] };
      }),

      updateQuantity: (productId, delta, maxStock) => set((state) => ({
        cart: state.cart.map((item) => {
          if (item.productId === productId) {
            const newQuantity = item.quantity + delta;
            if (newQuantity < 1 || newQuantity > maxStock) return item;
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
      })),

      removeFromCart: (productId) => set((state) => ({
        cart: state.cart.filter((item) => item.productId !== productId)
      })),

      clearCart: () => set({ 
        cart: [], 
        selectedClientId: '', 
        paidAmount: '',
        isCreatingClient: false,
        newClientName: '',
        newClientPhone: ''
      }),

      setSelectedClientId: (id) => set({ selectedClientId: id }),
      setPaidAmount: (amount) => set({ paidAmount: amount }),
      setIsCreatingClient: (isCreating) => set({ isCreatingClient: isCreating }),
      setNewClientName: (name) => set({ newClientName: name }),
      setNewClientPhone: (phone) => set({ newClientPhone: phone }),
    }),
    {
      name: 'pos-cart-storage',
    }
  )
);
