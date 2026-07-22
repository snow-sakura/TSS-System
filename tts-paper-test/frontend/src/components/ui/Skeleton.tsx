/**
 * 骨架屏加载组件
 */
import { cn } from "@/lib/utils"

interface SkeletonProps {
  className?: string
  count?: number
}

export function Skeleton({ className, count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse rounded-xl bg-cream/60 border border-border/30",
            className
          )}
        />
      ))}
    </>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
      <div className="animate-pulse">
        <div className="h-10 bg-cream/50 border-b border-border" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`h-12 border-b border-border/50 ${i % 2 === 1 ? "bg-cream/20" : ""}`}>
            <div className="flex items-center h-full px-4 gap-4">
              {Array.from({ length: cols }).map((_, j) => (
                <div key={j} className="h-3 rounded bg-cream/80" style={{ width: `${60 + Math.random() * 40}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonCard({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-border shadow-card p-5 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-cream/60" />
            <div className="flex-1 space-y-2">
              <div className="h-3 rounded bg-cream/80 w-1/2" />
              <div className="h-2 rounded bg-cream/60 w-1/3" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-2 rounded bg-cream/60 w-full" />
            <div className="h-2 rounded bg-cream/60 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
