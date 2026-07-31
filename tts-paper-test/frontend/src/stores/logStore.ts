import { create } from "zustand"
import type { LogEntry } from "@/components/log-panel/LogPanel"

type LogAddFn = (entry: { level: string; message: string; stage: string; detail?: string }) => void

interface LogStoreState {
  logAddFn: LogAddFn | null
  setLogAddFn: (fn: LogAddFn | null) => void
  pushLog: (entry: { level: string; message: string; stage: string; detail?: string }) => void
}

export const useLogStore = create<LogStoreState>()((set, get) => ({
  logAddFn: null,
  setLogAddFn: (fn) => set({ logAddFn: fn }),
  pushLog: (entry) => {
    const fn = get().logAddFn
    if (fn) fn(entry)
  },
}))
