import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProcurementItem {
  id: string; // temp UUID
  category: string;
  type: string;
  brand: string;
  name: string;
  unit_price: number;
  quantity: number;
}

interface ProcurementState {
  items: ProcurementItem[];
  addItem: (item: ProcurementItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
}

export const useProcurementStore = create<ProcurementState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => ({
          items: [...state.items, item],
        })),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'procurement-cart-storage',
    }
  )
);
