/**
 * AI自动化全局状态管理
 * 用于存储流程记录数据，支持跨页面数据回显
 */
import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface AutomationRecord {
  id: number
  name: string
  description: string
  requirementContent: string
  status: string
  stagesCompleted: number
  totalStages: number
}

interface AutomationState {
  // 当前活动的流程记录
  currentRecord: AutomationRecord | null
  // 所有流程记录（用于回显）
  records: Record<number, AutomationRecord>
  // 设置当前活动记录
  setCurrentRecord: (record: AutomationRecord) => void
  // 清除当前活动记录
  clearCurrentRecord: () => void
  // 保存记录
  saveRecord: (record: AutomationRecord) => void
}

export const useAutomationStore = create<AutomationState>()(
  persist(
    (set) => ({
      currentRecord: null,
      records: {},
      setCurrentRecord: (record) => set({ currentRecord: record }),
      clearCurrentRecord: () => set({ currentRecord: null }),
      saveRecord: (record) => set((state) => ({
        records: { ...state.records, [record.id]: record },
        currentRecord: record,
      })),
    }),
    {
      name: "tss-automation-store",
    }
  )
)
