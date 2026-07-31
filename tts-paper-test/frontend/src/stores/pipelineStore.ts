import { create } from "zustand"

export interface PipelineLog {
  timestamp: string
  content: string
  type: "info" | "success" | "error" | "warning"
}

export interface UploadedFile {
  id: string
  name: string
  type: string
  size: number
  content?: string
  processed: boolean
}

export interface PipelineStep {
  key: string
  label: string
  icon: string
  status: "pending" | "running" | "completed" | "failed"
  progress: number
  description: string
  logs: PipelineLog[]
  result?: any
}

export interface PipelineRecord {
  id: string
  name: string
  requirement: string
  uploadedFiles: UploadedFile[]
  project_id?: number | null
  project_name?: string
  version_id?: number | null
  version_name?: string
  status: "success" | "failed" | "running" | "partial"
  currentStepIndex: number
  startedAt: string
  completedAt?: string
  steps: PipelineStep[]
  results: {
    requirements?: any[]
    plans?: any[]
    points?: any[]
    cases?: any[]
    reviews?: { status?: string; items?: any[] }
  }
}

interface PipelineState {
  currentRecord: PipelineRecord | null
  records: PipelineRecord[]
  isRunning: boolean
  expandedStep: string | null
  
  setCurrentRecord: (record: PipelineRecord | null) => void
  startPipeline: (name: string, requirement: string, files: UploadedFile[]) => void
  continuePipeline: (recordId: string) => void
  updateStep: (stepKey: string, updates: Partial<PipelineStep>) => void
  appendStepLog: (stepKey: string, log: PipelineLog) => void
  updateStepLog: (stepKey: string, logIndex: number, content: string) => void
  batchUpdateStepLogs: (stepKey: string, updates: Array<{ logIndex: number; content: string }>) => void
  completeStep: (stepKey: string, result?: any) => void
  failStep: (stepKey: string, error: string) => void
  finishPipeline: (success: boolean) => void
  addRecord: (record: PipelineRecord) => void
  updateRecord: (id: string, updates: Partial<PipelineRecord>) => void
  deleteRecord: (id: string) => void
  getRecord: (id: string) => PipelineRecord | undefined
  setExpandedStep: (stepKey: string | null) => void
  reset: () => void
}

const createDefaultSteps = (): PipelineStep[] => [
  { key: "analyze", label: "需求分析", icon: "FileText", status: "pending", progress: 0, description: "基于 ISTQB 需求分析方法论，识别功能点、业务规则和隐含需求", logs: [] },
  { key: "plan", label: "测试方案", icon: "ClipboardList", status: "pending", progress: 0, description: "基于风险驱动测试制定测试策略、范围、资源与里程碑", logs: [] },
  { key: "point", label: "提取测试点", icon: "Target", status: "pending", progress: 0, description: "按功能模块提取正常/异常/边界/状态转换测试点", logs: [] },
  { key: "case", label: "生成用例", icon: "FlaskConical", status: "pending", progress: 0, description: "基于测试点生成 Gherkin Given-When-Then 格式用例", logs: [] },
  { key: "review", label: "用例评审", icon: "CheckCircle", status: "pending", progress: 0, description: "基于 RTM 矩阵多维度评审用例质量并给出改进建议", logs: [] },
]

const generateId = () => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `pipeline_${timestamp}_${random}`
}

const loadRecordsFromStorage = (): PipelineRecord[] => {
  try {
    const stored = localStorage.getItem("pipeline_records")
    if (stored) return JSON.parse(stored)
  } catch {}
  return []
}

const loadCurrentRecordFromStorage = (): PipelineRecord | null => {
  try {
    const stored = localStorage.getItem("pipeline_current_record")
    if (stored) return JSON.parse(stored)
  } catch {}
  return null
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingRecords: PipelineRecord[] | null = null

const saveRecordsToStorage = (records: PipelineRecord[]) => {
  pendingRecords = records
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    if (pendingRecords) {
      try {
        localStorage.setItem("pipeline_records", JSON.stringify(pendingRecords))
      } catch {}
      pendingRecords = null
    }
    saveTimer = null
  }, 300)
}

const saveCurrentRecordToStorage = (record: PipelineRecord | null) => {
  try {
    if (record) {
      localStorage.setItem("pipeline_current_record", JSON.stringify(record))
    } else {
      localStorage.removeItem("pipeline_current_record")
    }
  } catch {}
}

const THROTTLE_MS = 50
const updateThrottleMap = new Map<string, { timer: ReturnType<typeof setTimeout> | null; pending: Array<{ logIndex: number; content: string }> }>()

const throttledUpdateLogs = (
  stepKey: string,
  updates: Array<{ logIndex: number; content: string }>,
  currentRecord: PipelineRecord,
  set: (state: Partial<PipelineState>) => void
) => {
  const mapKey = stepKey
  const existing = updateThrottleMap.get(mapKey) || { timer: null, pending: [] }
  existing.pending.push(...updates)
  updateThrottleMap.set(mapKey, existing)

  if (existing.timer) return

  existing.timer = setTimeout(() => {
    const data = updateThrottleMap.get(mapKey)
    if (data && data.pending.length > 0) {
      const steps = currentRecord.steps.map(s => {
        if (s.key === stepKey) {
          const newLogs = [...s.logs]
          for (const { logIndex, content } of data.pending) {
            if (newLogs[logIndex]) {
              newLogs[logIndex] = { ...newLogs[logIndex], content }
            }
          }
          return { ...s, logs: newLogs }
        }
        return s
      })
      set({ currentRecord: { ...currentRecord, steps } })
    }
    updateThrottleMap.delete(mapKey)
  }, THROTTLE_MS)
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  currentRecord: loadCurrentRecordFromStorage(),
  records: loadRecordsFromStorage(),
  isRunning: false,
  expandedStep: null,

  setCurrentRecord: (record) => {
    saveCurrentRecordToStorage(record)
    set({ currentRecord: record })
  },

  startPipeline: (name, requirement, files) => {
    const record: PipelineRecord = {
      id: generateId(),
      name,
      requirement,
      uploadedFiles: files,
      status: "running",
      currentStepIndex: 0,
      startedAt: new Date().toISOString(),
      steps: createDefaultSteps(),
      results: {},
    }
    saveCurrentRecordToStorage(record)
    set({ currentRecord: record, isRunning: true, expandedStep: "analyze" })
  },

  continuePipeline: (recordId) => {
    const { records } = get()
    const record = records.find(r => r.id === recordId)
    if (record) {
      set({ 
        currentRecord: { ...record, status: "running" }, 
        isRunning: true,
        expandedStep: record.steps.find(s => s.status !== "completed")?.key || null
      })
    }
  },

  updateStep: (stepKey, updates) => {
    const { currentRecord } = get()
    if (!currentRecord) return
    const steps = currentRecord.steps.map(s =>
      s.key === stepKey ? { ...s, ...updates } : s
    )
    const updatedRecord = { ...currentRecord, steps }
    saveCurrentRecordToStorage(updatedRecord)
    set({ currentRecord: updatedRecord })
  },

  appendStepLog: (stepKey, log) => {
    const { currentRecord } = get()
    if (!currentRecord) return
    const steps = currentRecord.steps.map(s =>
      s.key === stepKey ? { ...s, logs: [...s.logs, log] } : s
    )
    const updatedRecord = { ...currentRecord, steps }
    saveCurrentRecordToStorage(updatedRecord)
    set({ currentRecord: updatedRecord })
  },

  updateStepLog: (stepKey, logIndex, content) => {
    const { currentRecord } = get()
    if (!currentRecord) return
    throttledUpdateLogs(stepKey, [{ logIndex, content }], currentRecord, set)
  },

  batchUpdateStepLogs: (stepKey, updates) => {
    const { currentRecord } = get()
    if (!currentRecord || updates.length === 0) return
    throttledUpdateLogs(stepKey, updates, currentRecord, set)
  },

  completeStep: (stepKey, result) => {
    const { currentRecord } = get()
    if (!currentRecord) return
    const now = new Date()
    const log: PipelineLog = {
      timestamp: now.toTimeString().split(" ")[0],
      content: `✅ 步骤「${currentRecord.steps.find(s => s.key === stepKey)?.label}」执行完成`,
      type: "success",
    }
    const steps = currentRecord.steps.map(s =>
      s.key === stepKey 
        ? { ...s, status: "completed" as const, progress: 100, logs: [...s.logs, log], result } 
        : s
    )
    
    const stepIndex = steps.findIndex(s => s.key === stepKey)
    const nextStepIndex = stepIndex + 1
    const results = { ...currentRecord.results }
    if (result) {
      if (stepKey === "analyze") results.requirements = result
      if (stepKey === "plan") results.plans = result
      if (stepKey === "point") results.points = result
      if (stepKey === "case") results.cases = result
      if (stepKey === "review") results.reviews = result
    }
    
    const updatedRecord = { 
      ...currentRecord, 
      steps, 
      currentStepIndex: nextStepIndex < steps.length ? nextStepIndex : steps.length,
      results 
    }
    saveCurrentRecordToStorage(updatedRecord)
    set({ 
      currentRecord: updatedRecord,
      expandedStep: nextStepIndex < steps.length ? steps[nextStepIndex].key : null
    })
  },

  failStep: (stepKey, error) => {
    const { currentRecord } = get()
    if (!currentRecord) return
    const now = new Date()
    const log: PipelineLog = {
      timestamp: now.toTimeString().split(" ")[0],
      content: `❌ 步骤执行失败: ${error}`,
      type: "error",
    }
    const steps = currentRecord.steps.map(s =>
      s.key === stepKey 
        ? { ...s, status: "failed" as const, logs: [...s.logs, log] } 
        : s
    )
    const updatedRecord = { ...currentRecord, steps, status: "failed" as const }
    saveCurrentRecordToStorage(updatedRecord)
    set({ 
      currentRecord: updatedRecord,
      isRunning: false 
    })
  },

  finishPipeline: (success) => {
    const { currentRecord, records } = get()
    if (!currentRecord) return
    const updatedRecord: PipelineRecord = {
      ...currentRecord,
      status: success ? "success" : "failed",
      completedAt: new Date().toISOString(),
      currentStepIndex: currentRecord.steps.length,
    }
    const updatedRecords = [updatedRecord, ...records.filter(r => r.id !== updatedRecord.id)]
    saveCurrentRecordToStorage(updatedRecord)
    set({ 
      currentRecord: updatedRecord, 
      records: updatedRecords,
      isRunning: false,
      expandedStep: null
    })
    saveRecordsToStorage(updatedRecords)
  },

  addRecord: (record) => {
    const { records } = get()
    const updatedRecords = [record, ...records]
    set({ records: updatedRecords })
    saveRecordsToStorage(updatedRecords)
  },

  updateRecord: (id, updates) => {
    const { records } = get()
    const updatedRecords = records.map(r =>
      r.id === id ? { ...r, ...updates } : r
    )
    set({ records: updatedRecords })
    saveRecordsToStorage(updatedRecords)
  },

  deleteRecord: (id) => {
    const { records, currentRecord } = get()
    const updatedRecords = records.filter(r => r.id !== id)
    set({ 
      records: updatedRecords,
      currentRecord: currentRecord?.id === id ? null : currentRecord
    })
    saveRecordsToStorage(updatedRecords)
  },

  getRecord: (id) => {
    const { records } = get()
    return records.find(r => r.id === id)
  },

  setExpandedStep: (stepKey) => set({ expandedStep: stepKey }),

  reset: () => {
    saveCurrentRecordToStorage(null)
    set({ currentRecord: null, isRunning: false, expandedStep: null })
  },
}))
