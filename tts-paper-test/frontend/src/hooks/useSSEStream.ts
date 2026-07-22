/**
 * useSSEStream — 通用 SSE 流式解析 Hook
 *
 * 从 fetch Response 中解析 Server-Sent Events 协议，
 * 支持 event: / data: 双行格式和纯 data: 格式。
 *
 * 用法:
 *   const { isConnected, error } = useSSEStream(response, onEvent, onComplete, onError)
 *
 *   - response: fetch Response 对象，设为 null 可停止/重置
 *   - onEvent(eventType, data): 每次收到完整事件时调用
 *   - onComplete(): 流正常结束时调用
 *   - onError(err): 解析出错时调用
 */
import { useEffect, useRef, useState } from "react"

export type SSEEventHandler = (eventType: string, data: any) => void

export interface UseSSEStreamOptions {
  response: Response | null
  onEvent: SSEEventHandler
  onComplete?: () => void
  onError?: (error: Error) => void
}

export function useSSEStream({
  response,
  onEvent,
  onComplete,
  onError,
}: UseSSEStreamOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const onEventRef = useRef(onEvent)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  // 保持回调引用最新
  onEventRef.current = onEvent
  onCompleteRef.current = onComplete
  onErrorRef.current = onError

  useEffect(() => {
    if (!response) {
      setIsConnected(false)
      setError(null)
      return
    }
    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}`)
      setError(err)
      onErrorRef.current?.(err)
      return
    }

    let cancelled = false
    const reader = response.body?.getReader()
    if (!reader) {
      const err = new Error("无法获取响应流")
      setError(err)
      onErrorRef.current?.(err)
      return
    }

    setIsConnected(true)

    const decoder = new TextDecoder()
    let buffer = ""
    let currentEvent = ""
    let currentData = ""

    const processLine = (line: string) => {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim()
      } else if (line.startsWith("data: ")) {
        currentData = line.slice(6).trim()
      } else if (line === "" && currentData) {
        // 空行 = 事件结束
        try {
          const parsed = JSON.parse(currentData)
          onEventRef.current(currentEvent || "message", parsed)
        } catch (e: any) {
          console.warn("SSE parse error:", e, currentData)
        }
        currentEvent = ""
        currentData = ""
      }
    }

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader!.read()
          if (cancelled || done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            processLine(line)
          }
        }

        // 处理缓冲区剩余内容
        if (buffer.trim()) {
          processLine(buffer)
        }

        if (!cancelled) {
          setIsConnected(false)
          onCompleteRef.current?.()
        }
      } catch (err: any) {
        if (!cancelled && err.name !== "AbortError") {
          setError(err)
          onErrorRef.current?.(err)
          setIsConnected(false)
        }
      }
    }

    pump()

    return () => {
      cancelled = true
      reader.cancel().catch(() => {})
      setIsConnected(false)
    }
  }, [response])

  return { isConnected, error }
}
