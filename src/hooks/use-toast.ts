import { create } from "zustand";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface ToastStore {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }],
    })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function toast(t: Omit<ToastItem, "id">) {
  const id = crypto.randomUUID();
  useToastStore.setState((state) => ({ toasts: [...state.toasts, { ...t, id }] }));
  setTimeout(() => useToastStore.getState().dismiss(id), 5000);
}
