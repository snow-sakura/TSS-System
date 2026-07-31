import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 格式化时间为 yyyy-MM-dd HH:mm 或 yyyy-MM-dd HH:mm:ss
 *  - 空值/无效值返回 "—"
 *  - withSeconds=true 时包含秒
 */
export function formatDateTime(value?: string | null, withSeconds = false): string {
  if (!value) return "—"
  const d = new Date(value)
  if (isNaN(d.getTime())) return "—"
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  }
  return d.toLocaleString("zh-CN", options)
}

/** 格式化时间为相对时间（如「3分钟前」），超过7天回退为绝对时间 */
export function formatRelativeTime(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (isNaN(d.getTime())) return "—"
  const diff = Date.now() - d.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return "刚刚"
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`
  if (diff < day) return `${Math.floor(diff / hour)}小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`
  return formatDateTime(value)
}
