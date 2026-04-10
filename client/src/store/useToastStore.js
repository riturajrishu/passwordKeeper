import { create } from 'zustand';

let toastId = 0;

const useToastStore = create((set) => ({
  toasts: [],
  addToast: (message, type = 'info', duration = 3500) => {
    const id = ++toastId;
    set((state) => ({
      // Keep at most 3 toasts visible
      toasts: [...state.toasts.slice(-2), { id, message, type, duration }]
    }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export default useToastStore;
