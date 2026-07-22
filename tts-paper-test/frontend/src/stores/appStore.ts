/**
 * 应用全局状态管理
 * 用于记忆首页选中的TAB和模块
 */
import { create } from "zustand"

interface AppState {
  selectedModule: string | null
  activeTab: string
  setSelectedModule: (key: string | null) => void
  setActiveTab: (key: string) => void
}

const getInitial = () => {
  try {
    return {
      module: localStorage.getItem("tss-selected-module"),
      tab: localStorage.getItem("tss-active-tab") || "test-management",
    }
  } catch {
    return { module: null, tab: "test-management" }
  }
}

export const useAppStore = create<AppState>()((set) => {
  const init = getInitial()
  return {
    selectedModule: init.module,
    activeTab: init.tab,
    setSelectedModule: (key) => {
      try {
        if (key) localStorage.setItem("tss-selected-module", key)
        else localStorage.removeItem("tss-selected-module")
      } catch { /* ignore */ }
      set({ selectedModule: key })
    },
    setActiveTab: (key) => {
      try { localStorage.setItem("tss-active-tab", key) } catch { /* ignore */ }
      set({ activeTab: key })
    },
  }
})
