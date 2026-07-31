/**
 * StreamingOutput — 右侧焦点输出区域（固定宽高，内容滚动）
 *
 * 外框带 border，内容区固定宽高不随内容拉伸，
 * 所有状态（空/等待/加载/错误/正常）均保持相同容器尺寸。
 *
 * 根据选择步骤的状态，展示：
 *   waiting  → 占位提示
 *   running  → 流式 Markdown 渲染 + 闪烁光标
 *   completed → 完整 Markdown 渲染
 *   failed    → 错误信息
 */
import { memo, useRef, useEffect, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import {
  Loader2, AlertCircle, ChevronLeft, ChevronRight,
  FileText, Search, Route, TestTubes, ClipboardCheck,
  Clock, BarChart3, CheckCircle2,
} from "lucide-react"
type StepStatus = "waiting" | "running" | "completed" | "failed"

interface StepOutput {
  key: string
  status: StepStatus
  content: string
  error?: string
}

interface PipelineStats {
  totalDuration: number
  totalWords: number
  completedCount: number
  totalCount: number
}

interface StreamingOutputProps {
  step: StepOutput | null
  stepIndex: number
  totalSteps: number
  onPrev: () => void
  onNext: () => void
  stats?: PipelineStats
}

const STEP_ICONS: Record<string, typeof FileText> = {
  requirement_analysis: FileText,
  requirements: FileText,
  test_planning: Search,
  "test-plans": Search,
  test_point_extraction: Route,
  "test-points": Route,
  test_case_generation: TestTubes,
  "test-cases": TestTubes,
  test_case_review: ClipboardCheck,
  "test-review": ClipboardCheck,
}

const STEP_COLORS: Record<string, string> = {
  requirement_analysis: "bg-blue-100 text-blue-600",
  requirements: "bg-blue-100 text-blue-600",
  test_planning: "bg-purple-100 text-purple-600",
  "test-plans": "bg-purple-100 text-purple-600",
  test_point_extraction: "bg-amber-100 text-amber-700",
  "test-points": "bg-amber-100 text-amber-700",
  test_case_generation: "bg-emerald-100 text-emerald-600",
  "test-cases": "bg-emerald-100 text-emerald-600",
  test_case_review: "bg-rose-100 text-rose-600",
  "test-review": "bg-rose-100 text-rose-600",
}

/* ─── 未闭合 Markdown 预处理 ────────────────────────────── */
function preprocessPartialMarkdown(text: string): string {
  let processed = text
  const codeBlockCount = (processed.match(/```/g) || []).length
  if (codeBlockCount % 2 !== 0) processed += "\n```"
  const boldCount = (processed.match(/\*\*/g) || []).length
  if (boldCount % 2 !== 0) processed += "**"
  const italicCount = (processed.match(/(?<!\*)\*(?!\*)/g) || []).length
  if (italicCount % 2 !== 0) processed += "*"
  return processed
}

/* ─── 闪烁光标 ──────────────────────────────────────── */
function BlinkingCursor() {
  return (
    <span className="inline-block w-[2px] h-[1em] bg-amber ml-0.5 animate-blink-cursor align-middle" />
  )
}

/** 所有分支共用的外部容器：使用 relative + 固定高度，内容用 absolute 穿透显示
 *  关键：使用 h-full 确保占满父级高度，overflow-hidden 防止内容撑大
 *  边框加粗加明显，使右侧区域有清晰边界
 */
function OuterBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-streaming-output
      className="flex-1 h-full w-full min-w-0 flex flex-col overflow-hidden border-[3px] border-amber-300/80 rounded-xl m-3 bg-white shadow-lg relative"
    >
      {children}
    </div>
  )
}

/**
 * 内容区域包装器：使用 flex-1 + min-h-0 + overflow-y-auto
 * 关键点：
 *   - flex-1 + min-h-0 确保在 flex 容器中不撑大父级
 *   - overflow-y-auto 让内容滚动而不撑大容器
 *   - 使用 absolute 定位让内容"穿透"显示
 */
function ContentArea({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden scrollbar-thin ${className}`}
      style={{ position: "relative" }}
    >
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
  )
}

/* ─── 底部导航栏 + 统计信息 ────────────────────────────────────────── */
interface StreamNavProps {
  stepIndex: number
  totalSteps: number
  onPrev: () => void
  onNext: () => void
  stats?: PipelineStats
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0s"
  const rounded = Math.round(ms)
  if (rounded < 1000) return `${rounded}ms`
  const s = Math.round(rounded / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  return sec > 0 ? `${m}m${sec}s` : `${m}m`
}

function StreamNav({ stepIndex, totalSteps, onPrev, onNext, stats }: StreamNavProps) {
  // 默认统计数据，即使无数据也显示
  const displayStats = stats || {
    totalDuration: 0,
    totalWords: 0,
    completedCount: 0,
    totalCount: totalSteps,
  }
  
  return (
    <div className="flex-shrink-0 flex flex-col border-t-2 border-amber-200 bg-gradient-to-r from-cream-light via-white to-cream-light">
      {/* 统计信息横向展示 - 始终显示 */}
      <div className="flex items-center justify-center gap-4 py-2 bg-white/90 border-b border-amber-100">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cream to-cream-light rounded-lg border border-border min-w-[110px]">
          <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-xs text-muted font-medium">总耗时</span>
          <span className="text-xs font-bold text-ink font-mono ml-auto">
            {formatDuration(displayStats.totalDuration)}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cream to-cream-light rounded-lg border border-border min-w-[110px]">
          <BarChart3 className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-xs text-muted font-medium">总产出</span>
          <span className="text-xs font-bold text-ink font-mono ml-auto">
            {displayStats.totalWords > 0 ? `${displayStats.totalWords} 字` : "0 字"}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cream to-cream-light rounded-lg border border-border min-w-[110px]">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="text-xs text-muted font-medium">完成进度</span>
          <span className="text-xs font-bold text-ink font-mono ml-auto">
            {displayStats.completedCount}/{displayStats.totalCount} 步
          </span>
        </div>
      </div>
      
      {/* 导航按钮 - 始终显示 */}
      <div className="flex items-center justify-between px-6 py-2.5">
        <button
          onClick={onPrev}
          disabled={stepIndex <= 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs
                     text-muted hover:text-ink hover:bg-cream transition-all
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          上一步
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-light">
            {stepIndex + 1} / {totalSteps}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === stepIndex ? "bg-amber w-3" : "bg-cream-dark"}`}
              />
            ))}
          </div>
        </div>
        <button
          onClick={onNext}
          disabled={stepIndex >= totalSteps - 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs
                     text-muted hover:text-ink hover:bg-cream transition-all
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          下一步
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ─── 步骤徽标 + 状态标签 ──────────────────────────── */
function StepBadge({ stepKey, status }: { stepKey: string; status: StepStatus }) {
  const Icon = STEP_ICONS[stepKey] || FileText
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${STEP_COLORS[stepKey] || "bg-cream text-muted"}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {stepKey.replace(/_/g, " · ")}
      </span>
      {status === "running" && (
        <span className="flex items-center gap-1 text-[11px] text-amber font-medium">
          <Loader2 className="w-3 h-3 animate-spin" />
          生成中...
        </span>
      )}
    </div>
  )
}

/* ─── 主组件 ───────────────────────────────────────────── */
function StreamingOutputInner({
  step,
  stepIndex,
  totalSteps,
  onPrev,
  onNext,
  stats,
}: StreamingOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevContentRef = useRef<string>("")
  // 缓存各步骤的内容，切换步骤时确保不回显丢失
  const contentCache = useRef<Record<string, string>>({})

  /* 自动滚动到底部 */
  useEffect(() => {
    if (scrollRef.current && step?.content) {
      const prevLen = prevContentRef.current?.length || 0
      if (step.content.length !== prevLen) {
        const el = scrollRef.current
        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
        if (isAtBottom || step?.status === "running") {
          requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
        }
      }
    }
    if (step?.content) {
      contentCache.current[step.key] = step.content
    }
    prevContentRef.current = step?.content || ""
  }, [step?.content, step?.status, step?.key])

  /* 确保内容不丢失：缓存回退 */
  const safeContent = useMemo(() => {
    if (!step) return ""
    if (step.content) return step.content
    // 如果 step 是 completed/failed 但 content 为空，从缓存恢复
    if ((step.status === "completed" || step.status === "failed") && contentCache.current[step.key]) {
      return contentCache.current[step.key]
    }
    return step.content
  }, [step])

  /* 预处理 Markdown */
  const displayContent = useMemo(() => {
    if (!safeContent) return ""
    return preprocessPartialMarkdown(safeContent)
  }, [safeContent])

  /* ─── 占位（无步骤选中） ─── */
  if (!step) {
    return (
      <OuterBox>
        <ContentArea className="flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cream flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-light" />
            </div>
            <p className="text-sm text-muted font-medium">等待执行</p>
            <p className="text-xs text-muted-light mt-1">点击「开始全流程」启动自动流水线</p>
          </div>
        </ContentArea>
        <StreamNav stepIndex={0} totalSteps={totalSteps} onPrev={onPrev} onNext={onNext} stats={stats} />
      </OuterBox>
    )
  }

  /* ─── waiting ─────── */
  if (step.status === "waiting") {
    return (
      <OuterBox>
        <ContentArea className="flex items-center justify-center">
          <p className="text-sm text-muted">{step.key.replace(/_/g, " · ")} 等待执行</p>
        </ContentArea>
        <StreamNav stepIndex={stepIndex} totalSteps={totalSteps} onPrev={onPrev} onNext={onNext} stats={stats} />
      </OuterBox>
    )
  }

  /* ─── 加载中（running 无内容） ─── */
  if (step.status === "running" && !safeContent) {
    return (
      <OuterBox>
        <ContentArea className="flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-amber animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted font-medium">AI 正在生成...</p>
            <p className="text-xs text-muted-light mt-1">等待内容输出</p>
          </div>
        </ContentArea>
        <StreamNav stepIndex={stepIndex} totalSteps={totalSteps} onPrev={onPrev} onNext={onNext} stats={stats} />
      </OuterBox>
    )
  }

  /* ─── 错误 ─────────── */
  if (step.status === "failed") {
    return (
      <OuterBox>
        <ContentArea className="flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-fail/10 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-fail" />
            </div>
            <p className="text-sm font-semibold text-fail mb-2">
              {step.key.replace(/_/g, " · ")} 执行出错
            </p>
            <p className="text-xs text-muted text-center max-w-md bg-white rounded-lg p-3 border border-fail/20">
              {step.error || "未知错误"}
            </p>
          </div>
        </ContentArea>
        <StreamNav stepIndex={stepIndex} totalSteps={totalSteps} onPrev={onPrev} onNext={onNext} stats={stats} />
      </OuterBox>
    )
  }

  /* ─── 正常内容渲染（running / completed） ──────────── */
  return (
    <OuterBox>
      {/* 滚动内容区：使用 ContentArea 确保固定高度约束，内容穿透显示 */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden scrollbar-thin"
      >
        <div className="px-5 py-4">
          {/* 步骤徽标 */}
          <StepBadge stepKey={step.key} status={step.status} />

          {/* 内容渲染 - 根据状态选择渲染方式 */}
          {safeContent ? (
            step.status === "running" ? (
              /* 打字机效果：流式输出时使用纯文本 + whitespace-pre-wrap */
              <div className="pipeline-markdown text-sm leading-relaxed break-words w-full">
                <span
                  className="whitespace-pre-wrap break-words"
                  style={{ fontFamily: 'inherit', wordBreak: 'break-word' }}
                >
                  {safeContent}
                </span>
                <BlinkingCursor />
              </div>
            ) : (
              /* 完成状态：使用 Markdown 完整渲染 */
              <div className="pipeline-markdown text-sm leading-relaxed break-words w-full">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {displayContent}
                </ReactMarkdown>
              </div>
            )
          ) : (
            <p className="text-muted italic">内容为空</p>
          )}
        </div>
      </div>

      {/* 底部导航 */}
      <StreamNav stepIndex={stepIndex} totalSteps={totalSteps} onPrev={onPrev} onNext={onNext} stats={stats} />
    </OuterBox>
  )
}

export default memo(StreamingOutputInner)
