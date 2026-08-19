import { useState, useEffect } from "react"
import { X } from "lucide-react"
import MarkdownPreview from "@/components/markdown/MarkdownPreview"

export interface CrudField {
  key: string
  label: string
  type: "text" | "textarea" | "select" | "date" | "number" | "email" | "password" | "checklist" | "multiselect"
  required?: boolean
  placeholder?: string
  options?: { label: string; value: string }[]
  default?: any
  disabled?: boolean
  helpText?: string
  validation?: (value: any) => string | null
  /** 数组字段：编辑回显时逗号拼接，提交时按逗号拆分数组 */
  array?: boolean
  /** 检查清单字段：默认检查项模板 [{id,label,required}] */
  checklistTemplate?: { id: string; label: string; required?: boolean }[]
}

export interface CrudDialogProps {
  open: boolean
  mode: "create" | "edit" | "view"
  title?: string
  fields: CrudField[]
  initialData?: Record<string, any>
  onClose: () => void
  onSubmit?: (data: Record<string, any>) => void
  onViewEdit?: () => void
}

export default function CrudDialog({
  open,
  mode,
  title,
  fields,
  initialData = {},
  onClose,
  onSubmit,
  onViewEdit,
}: CrudDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      const defaults: Record<string, any> = {}
      fields.forEach((f) => {
        let value = initialData[f.key] ?? f.default ?? ""
        // 数组字段（如标签列表）：编辑时用逗号拼接，便于文本输入
        if (f.array && Array.isArray(value)) {
          value = value.join(", ")
        }
        // 日期字段：将 ISO 格式字符串转换为 YYYY-MM-DD 格式
        if (f.type === "date" && value && typeof value === "string") {
          // 处理 "2026-07-29T00:00:00" 或 "2026-07-29T00:00:00.000000" 格式
          const dateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/)
          if (dateMatch) {
            value = dateMatch[1]
          }
        }
        // 检查清单字段：无数据时用模板初始化（保留已存的状态）
        if (f.type === "checklist") {
          const template = f.checklistTemplate || []
          if (!Array.isArray(value) || value.length === 0) {
            value = template.map((t) => ({
              id: t.id,
              label: t.label,
              required: !!t.required,
              passed: null,
              comment: "",
            }))
          } else {
            // 合并模板与已存数据：补齐新增项，保留已勾选状态
            value = template.map((t) => {
              const saved = (value as any[]).find((v) => v.id === t.id)
              return saved
                ? { id: t.id, label: t.label, required: !!t.required, passed: saved.passed ?? null, comment: saved.comment || "" }
                : { id: t.id, label: t.label, required: !!t.required, passed: null, comment: "" }
            })
          }
        }
        defaults[f.key] = value
      })
      setFormData(defaults)
      setErrors({})
    }
  }, [open, fields, initialData])

  if (!open) return null

  const isView = mode === "view"
  const dialogTitle =
    title ||
    (mode === "create" && "新建") ||
    (mode === "edit" && "编辑") ||
    "详情"

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    fields.forEach((field) => {
      const value = formData[field.key]
      if (field.required && (!value || (typeof value === "string" && !value.trim()))) {
        newErrors[field.key] = `${field.label}不能为空`
      }
      if (field.validation) {
        const err = field.validation(value)
        if (err) newErrors[field.key] = err
      }
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (isView) {
      onClose()
      return
    }
    if (!validate()) return
    // 数组字段：提交时将逗号分隔字符串拆分为数组
    let payload = formData
    const arrayFields = fields.filter((f) => f.array)
    if (arrayFields.length > 0) {
      payload = { ...formData }
      arrayFields.forEach((f) => {
        const v = formData[f.key]
        if (typeof v === "string") {
          payload[f.key] = v
            .split(/[,，]/)
            .map((s: string) => s.trim())
            .filter(Boolean)
        }
      })
    }
    // 空字符串转为 null：避免未选中的可选字段（项目/版本等）以 "" 提交导致后端 int 校验 422
    const hasBlank = Object.values(payload).some((v) => v === "")
    if (hasBlank) {
      payload = { ...payload }
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "") payload[k] = null
      })
    }
    onSubmit?.(payload)
  }

  const renderField = (field: CrudField) => {
    const value = formData[field.key] ?? ""
    const commonClass =
      "w-full h-10 px-3 text-sm bg-cream border border-border rounded-xl input-focus disabled:opacity-50"
    const errorClass = errors[field.key]
      ? "border-fail focus:border-fail focus:ring-fail/20"
      : ""

    switch (field.type) {
      case "textarea":
        // 查看模式下以 Markdown 格式渲染内容（表格/标题/列表等），编辑/新建保持 textarea
        if (isView) {
          return (
            <div className="rounded-xl border border-border bg-cream/40 px-3 py-2.5">
              <MarkdownPreview content={String(value || "")} emptyText="暂无内容" />
            </div>
          )
        }
        return (
          <textarea
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={isView || field.disabled}
            placeholder={field.placeholder}
            rows={4}
            className={`${commonClass} resize-none ${errorClass}`}
          />
        )
      case "select":
        return (
          <select
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={isView || field.disabled}
            className={`${commonClass} appearance-none cursor-pointer ${errorClass}`}
          >
            <option value="">请选择</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )
      case "date":
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={isView || field.disabled}
            className={`${commonClass} ${errorClass}`}
          />
        )
      case "number":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={isView || field.disabled}
            placeholder={field.placeholder}
            className={`${commonClass} ${errorClass}`}
          />
        )
      case "email":
        return (
          <input
            type="email"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={isView || field.disabled}
            placeholder={field.placeholder}
            className={`${commonClass} ${errorClass}`}
          />
        )
      case "password":
        return (
          <input
            type="password"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={isView || field.disabled}
            placeholder={field.placeholder}
            className={`${commonClass} ${errorClass}`}
          />
        )
      case "multiselect": {
        const selected: string[] = Array.isArray(value) ? value : []
        return (
          <div className="rounded-xl border border-border bg-cream/40 px-3 py-2.5 space-y-1.5 max-h-44 overflow-y-auto">
            {(field.options || []).length === 0 && <p className="text-xs text-muted">暂无选项</p>}
            {(field.options || []).map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-ink cursor-pointer hover:bg-cream/60 rounded-lg px-2 py-1">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selected, opt.value]
                      : selected.filter((v) => v !== opt.value)
                    handleChange(field.key, next)
                  }}
                  className="w-4 h-4 rounded border-border text-amber focus:ring-amber cursor-pointer"
                />
                <span className="truncate">{opt.label}</span>
              </label>
            ))}
          </div>
        )
      }
      case "checklist": {
        const items: { id: string; label: string; required?: boolean; passed: boolean | null; comment?: string }[] =
          Array.isArray(value) ? value : []
        const done = items.filter((it) => it.passed !== null).length
        const passed = items.filter((it) => it.passed === true).length
        return (
          <div className="rounded-xl border border-border bg-cream/40 px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>共 {items.length} 项 · 已评审 {done} 项 · 通过 {passed} 项</span>
              {items.length > 0 && (
                <span className={passed === items.length ? "text-pass font-medium" : ""}>
                  {Math.round((done / items.length) * 100)}%
                </span>
              )}
            </div>
            {items.length === 0 && <p className="text-xs text-muted">暂无检查项</p>}
            {items.map((it, idx) => (
              <div key={it.id} className="rounded-lg bg-white border border-border p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink flex items-center gap-1.5">
                    <span className="text-xs text-muted font-mono">{idx + 1}</span>
                    {it.label}
                    {it.required && !isView && <span className="text-fail text-xs">必</span>}
                    {it.required && isView && (
                      <span className="text-fail/70 text-xs border border-fail/30 rounded px-1">必查</span>
                    )}
                  </span>
                  {!isView && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...items]
                          next[idx] = { ...it, passed: it.passed === true ? null : true }
                          handleChange(field.key, next)
                        }}
                        className={`px-2 py-0.5 rounded-md text-xs border transition-colors ${
                          it.passed === true
                            ? "bg-pass/15 text-pass border-pass/40"
                            : "text-muted border-border hover:bg-cream"
                        }`}
                      >
                        通过
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...items]
                          next[idx] = { ...it, passed: it.passed === false ? null : false }
                          handleChange(field.key, next)
                        }}
                        className={`px-2 py-0.5 rounded-md text-xs border transition-colors ${
                          it.passed === false
                            ? "bg-fail/15 text-fail border-fail/40"
                            : "text-muted border-border hover:bg-cream"
                        }`}
                      >
                        不通过
                      </button>
                    </div>
                  )}
                  {isView && (
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-md text-xs border ${
                        it.passed === true
                          ? "bg-pass/15 text-pass border-pass/40"
                          : it.passed === false
                            ? "bg-fail/15 text-fail border-fail/40"
                            : "text-muted border-border"
                      }`}
                    >
                      {it.passed === true ? "通过" : it.passed === false ? "不通过" : "未评审"}
                    </span>
                  )}
                </div>
                {!isView && (
                  <input
                    type="text"
                    value={it.comment || ""}
                    onChange={(e) => {
                      const next = [...items]
                      next[idx] = { ...it, comment: e.target.value }
                      handleChange(field.key, next)
                    }}
                    placeholder="备注（可选）"
                    className="w-full h-7 px-2 text-xs bg-cream border border-border rounded-lg input-focus"
                  />
                )}
                {isView && it.comment && (
                  <p className="text-xs text-muted pl-4">备注：{it.comment}</p>
                )}
              </div>
            ))}
          </div>
        )
      }
      case "text":
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={isView || field.disabled}
            placeholder={field.placeholder}
            className={`${commonClass} ${errorClass}`}
          />
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-elevated animate-scale-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-ink">{dialogTitle}</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-cream">
              <X className="w-5 h-5 text-muted" />
            </button>
          </div>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="text-sm font-medium text-ink mb-1.5 block">
                  {field.label}
                  {field.required && !isView && (
                    <span className="text-fail ml-1">*</span>
                  )}
                </label>
                {renderField(field)}
                {errors[field.key] && (
                  <p className="text-xs text-fail mt-1">{errors[field.key]}</p>
                )}
                {field.helpText && !errors[field.key] && (
                  <p className="text-xs text-muted mt-1">{field.helpText}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-border text-ink-light text-sm hover:bg-cream transition-colors"
            >
              {isView ? "关闭" : "取消"}
            </button>
            {mode !== "view" && (
              <button
                onClick={handleSubmit}
                className="h-9 px-4 rounded-xl gradient-amber text-white text-sm font-medium shadow-sm hover:shadow-md transition-all"
              >
                {mode === "create" ? "创建" : "保存"}
              </button>
            )}
            {mode === "view" && onViewEdit && (
              <button
                onClick={() => {
                  onViewEdit()
                }}
                className="h-9 px-4 rounded-xl bg-info text-white text-sm font-medium shadow-sm hover:shadow-md transition-all"
              >
                编辑
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}