import { useState, useEffect } from "react"
import { X } from "lucide-react"

export interface CrudField {
  key: string
  label: string
  type: "text" | "textarea" | "select" | "date" | "number" | "email" | "password"
  required?: boolean
  placeholder?: string
  options?: { label: string; value: string }[]
  default?: any
  disabled?: boolean
  helpText?: string
  validation?: (value: any) => string | null
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
        // 日期字段：将 ISO 格式字符串转换为 YYYY-MM-DD 格式
        if (f.type === "date" && value && typeof value === "string") {
          // 处理 "2026-07-29T00:00:00" 或 "2026-07-29T00:00:00.000000" 格式
          const dateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/)
          if (dateMatch) {
            value = dateMatch[1]
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
    onSubmit?.(formData)
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