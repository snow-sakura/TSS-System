/**
 * InputSection — 智能折叠输入区
 *
 * 三种模式：
 *   idle      → 完整输入框（项目/版本下拉 + 需求名称 + 上传按钮 + 内容框）
 *   running   → 折叠为一行紧凑状态（只读，显示项目/版本/需求名）
 *   completed → 收起显示，可选择「重新执行」
 */
import { memo, useRef, useState } from "react"
import { Upload, Loader2, AlertCircle, ChevronDown, ChevronRight, FileText, Folder, GitBranch, Play, RotateCcw } from "lucide-react"
import type { PipelineStatus } from "./PipelineHeader"

interface InputSectionProps {
  requirementName: string
  requirementContent: string
  pipelineStatus: PipelineStatus
  uploading: boolean
  uploadError: string | null
  onNameChange: (name: string) => void
  onContentChange: (content: string) => void
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  // 项目/版本选择
  projectId?: number
  versionId?: number
  projects: any[]
  versions: any[]
  onProjectChange: (id: number | undefined) => void
  onVersionChange: (id: number | undefined) => void
  // 控制按钮
  onStart: () => void
  canStart: boolean
  continueMode?: boolean
}

function InputSectionInner({
  requirementName,
  requirementContent,
  pipelineStatus,
  uploading,
  uploadError,
  onNameChange,
  onContentChange,
  onFileUpload,
  projectId,
  versionId,
  projects,
  versions,
  onProjectChange,
  onVersionChange,
  onStart,
  canStart,
  continueMode,
}: InputSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  const isRunning = pipelineStatus === "running"
  const isCompleted = pipelineStatus === "completed"
  const hasContent = requirementContent.trim().length > 0

  // 项目-版本联动过滤：选择项目后，版本下拉只显示该项目的版本
  const filteredVersions = projectId
    ? versions.filter((v: any) => v.project_id === projectId)
    : versions

  // 当前选中的项目名/版本名（用于折叠模式回显）
  const projectName = projects.find((p: any) => p.id === projectId)?.name || ""
  const versionName = filteredVersions.find((v: any) => v.id === versionId)?.name || ""

  // 运行中/完成时自动折叠
  const showCompact = isRunning || (isCompleted && collapsed)

  if (showCompact) {
    return (
      <div className="flex-shrink-0 bg-white border-b border-border px-5 py-2">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center gap-3 text-xs text-muted hover:text-ink transition-colors"
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 text-amber animate-spin" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          <FileText className="w-3.5 h-3.5 text-ink-light" />
          <span className="font-medium text-ink truncate">
            {requirementName || "未命名需求"}
          </span>
          {/* 项目/版本回显 */}
          {projectName && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cream text-muted border border-border">
              <Folder className="w-3 h-3" />
              {projectName}
            </span>
          )}
          {versionName && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cream text-muted border border-border">
              <GitBranch className="w-3 h-3" />
              {versionName}
            </span>
          )}
          <span className="text-muted-light">
            {requirementContent.length} 字符
          </span>
          <span className="flex-1 text-right text-muted-light">
            {isRunning ? "运行中 — 点击展开查看输入" : "点击展开"}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 bg-white border-b border-border px-5 py-3">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          {/* 第一行：项目 + 版本选择（前置必选） */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <Folder className="w-3.5 h-3.5 text-muted flex-shrink-0" />
              <select
                value={projectId || ""}
                onChange={(e) => {
                  const v = e.target.value
                  onProjectChange(v ? Number(v) : undefined)
                  // 切换项目时重置版本
                  onVersionChange(undefined)
                }}
                disabled={isRunning}
                className="flex-1 h-8 px-2 rounded-lg border border-border text-xs text-ink bg-white
                           focus:border-amber focus:ring-1 focus:ring-amber outline-none
                           transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">请选择项目 *</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <GitBranch className="w-3.5 h-3.5 text-muted flex-shrink-0" />
              <select
                value={versionId || ""}
                onChange={(e) => onVersionChange(e.target.value ? Number(e.target.value) : undefined)}
                disabled={isRunning || !projectId}
                className="flex-1 h-8 px-2 rounded-lg border border-border text-xs text-ink bg-white
                           focus:border-amber focus:ring-1 focus:ring-amber outline-none
                           transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{projectId ? "请选择版本" : "请先选择项目"}</option>
                {filteredVersions.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
          {/* 第二行：需求名称 + 上传 */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="需求名称（可选）"
              value={requirementName}
              onChange={(e) => onNameChange(e.target.value)}
              disabled={isRunning}
              className="flex-1 h-9 px-3 rounded-lg border border-border text-sm text-ink bg-white
                         focus:border-amber focus:ring-1 focus:ring-amber outline-none
                         transition-all disabled:opacity-50"
            />
            <label
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all flex-shrink-0 ${
                uploading
                  ? "bg-amber-light text-amber border border-amber/30"
                  : "bg-cream text-muted hover:text-ink hover:bg-cream-dark border border-border"
              }`}
            >
              {uploading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 解析中...</>
              ) : (
                <><Upload className="w-3.5 h-3.5" /> 上传文档</>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".docx,.doc,.pdf,.xlsx,.xls,.pptx,.ppt,.md,.txt,.csv,.xmind"
                disabled={isRunning || uploading}
                onChange={onFileUpload}
              />
            </label>
            {/* 开始执行按钮：紧跟「上传文档」按钮后面 */}
            {!isRunning && (
              <button
                onClick={onStart}
                disabled={!canStart}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
                  !canStart
                    ? "bg-muted-light text-white opacity-50 cursor-not-allowed"
                    : "gradient-amber text-white hover:opacity-90 shadow-sm"
                }`}
              >
                {continueMode ? (
                  <><RotateCcw className="w-3.5 h-3.5" /> 继续执行</>
                ) : isCompleted ? (
                  <><Play className="w-3.5 h-3.5" /> 重新执行</>
                ) : (
                  <><Play className="w-3.5 h-3.5" /> 开始执行</>
                )}
              </button>
            )}
            {/* 完成时折叠按钮 */}
            {isCompleted && hasContent && (
              <button
                onClick={() => setCollapsed(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-ink hover:bg-cream border border-border transition-all"
                title="收起输入区"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                收起
              </button>
            )}
          </div>
          {/* 第三行：内容输入框 */}
          <textarea
            placeholder="请输入需求文档内容，或粘贴需求描述..."
            value={requirementContent}
            onChange={(e) => onContentChange(e.target.value)}
            disabled={isRunning}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm text-ink bg-white
                       focus:border-amber focus:ring-1 focus:ring-amber outline-none
                       resize-none transition-all disabled:opacity-50"
          />
          {uploadError && (
            <p className="text-[11px] text-fail flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {uploadError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(InputSectionInner)
