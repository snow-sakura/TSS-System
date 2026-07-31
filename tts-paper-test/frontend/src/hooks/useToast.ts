/**
 * 简单的 Toast Hook - 使用 sonner（项目已安装）
 */
import { useMemo } from "react"
import { toast } from "sonner"

export function useToast() {
  return useMemo(() => ({
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    info: (message: string) => toast.info(message),
    warning: (message: string) => toast.warning(message),
  }), [])
}
