import { create } from "zustand"

interface ConfirmState {
  open: boolean
  title: string
  message: string
  itemName: string
  confirmText: string
  cancelText: string
  danger: boolean
  loading: boolean
  resolver: ((value: boolean) => void) | null
}

interface ConfirmActions {
  confirm: (opts: {
    title?: string
    message: string
    itemName?: string
    confirmText?: string
    cancelText?: string
    danger?: boolean
  }) => Promise<boolean>
  _resolve: (value: boolean) => void
  setLoading: (loading: boolean) => void
}

const initial: ConfirmState = {
  open: false,
  title: "",
  message: "",
  itemName: "",
  confirmText: "",
  cancelText: "",
  danger: false,
  loading: false,
  resolver: null,
}

export const useConfirmStore = create<ConfirmState & ConfirmActions>()((set, get) => ({
  ...initial,
  confirm: (opts) => {
    return new Promise<boolean>((resolve) => {
      set({
        ...initial,
        open: true,
        title: opts.title || "确认操作",
        message: opts.message,
        itemName: opts.itemName || "",
        confirmText: opts.confirmText || "确认",
        cancelText: opts.cancelText || "取消",
        danger: opts.danger ?? false,
        resolver: resolve,
      })
    })
  },
  _resolve: (value) => {
    const resolver = get().resolver
    set({ ...initial })
    resolver?.(value)
  },
  setLoading: (loading) => set({ loading }),
}))
