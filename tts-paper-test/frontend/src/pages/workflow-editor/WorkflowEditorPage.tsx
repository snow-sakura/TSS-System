/**
 * 工作流编排可视化编辑器 — SVG DAG 画布
 *
 * 功能：
 * - 左侧工作流列表 + 节点模板面板
 * - 中央 SVG 画布：拖拽移动节点、连线、选中
 * - 右侧节点配置面板
 * - 执行记录
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { workflowApi } from "@/lib/api"
import {
  Plus, Play, Save, Trash2, ChevronLeft, ChevronRight,
  Loader2, Settings, History, X, Circle, ArrowRight,
  Terminal, Brain, Database, MessageSquare, GitFork,
  Clock, FileCode, Cpu, Zap, Search, Square, CircleDot,
  Layers, Maximize2, Minimize2, GripVertical, Globe,
} from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

// ── 节点类型定义 ──
const NODE_TYPES: Record<string, { label: string; color: string; icon: any; defaultConfig: any }> = {
  start:         { label: "开始",       color: "#10b981", icon: Circle,      defaultConfig: {} },
  end:           { label: "结束",       color: "#ef4444", icon: Square,      defaultConfig: {} },
  engine_task:   { label: "AI 引擎",    color: "#8b5cf6", icon: Cpu,         defaultConfig: { engine_type: "mock", url: "", instruction: "" } },
  mcp_tool:      { label: "MCP 工具",   color: "#f59e0b", icon: Zap,         defaultConfig: { service_id: "", tool_name: "", params: {} } },
  knowledge_query: { label: "知识库",    color: "#06b6d4", icon: Database,    defaultConfig: { query_template: "", limit: 5 } },
  llm_chat:      { label: "LLM 对话",   color: "#3b82f6", icon: MessageSquare, defaultConfig: { prompt_template: "", model: "" } },
  condition:     { label: "条件分支",    color: "#f97316", icon: GitFork,     defaultConfig: { expression: "true" } },
  delay:         { label: "延时",       color: "#6b7280", icon: Clock,        defaultConfig: { seconds: 1 } },
  script:        { label: "脚本",       color: "#14b8a6", icon: FileCode,     defaultConfig: { language: "python", code: "" } },
  web_automation:{ label: "Web自动化",  color: "#0ea5e9", icon: Globe,        defaultConfig: { action: "explore", project_id: "" } },
}

interface CanvasNode {
  id: number
  type: string
  label: string
  description?: string
  config: any
  position_x: number
  position_y: number
}

interface CanvasEdge {
  id?: number
  source_node_id: number
  target_node_id: number
  label?: string
}

export default function WorkflowEditorPage() {
  const navigate = useNavigate()

  // ── 状态 ──
  const [workflows, setWorkflows] = useState<any[]>([])
  const [activeWfId, setActiveWfId] = useState<number | null>(null)
  const [wfName, setWfName] = useState("")
  const [wfDescription, setWfDescription] = useState("")
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [edges, setEdges] = useState<CanvasEdge[]>([])
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null)
  const [connecting, setConnecting] = useState<number | null>(null) // source id when drawing edge
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showExecutions, setShowExecutions] = useState(false)
  const [executions, setExecutions] = useState<any[]>([])
  const [showConfig, setShowConfig] = useState(false)
  const [configForm, setConfigForm] = useState<any>({})
  const [showNewWf, setShowNewWf] = useState(false)
  const [newWfName, setNewWfName] = useState("")
  const [showPalette, setShowPalette] = useState(true)
  const [nextTempId, setNextTempId] = useState(-1)
  const [webProjects, setWebProjects] = useState<any[]>([])

  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ nodeId: number; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null)

  // ── 加载 ──
  const loadWorkflows = useCallback(async () => {
    try {
      const res: any = await workflowApi.listWorkflows({ page_size: 100 })
      setWorkflows(res?.data || [])
    } catch { /* ignore */ }
  }, [])

  const loadWorkflow = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const res: any = await workflowApi.getWorkflow(id)
      setWfName(res.name || "")
      setWfDescription(res.description || "")
      setNodes(res.nodes || [])
      setEdges(res.edges || [])
      setActiveWfId(id)
      setSelectedNode(null)
      setShowExecutions(false)
    } catch (e: any) {
      toast.error("加载工作流失败: " + (e?.message || ""))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadExecutions = useCallback(async (wfId: number) => {
    try {
      const res: any = await workflowApi.listExecutions(wfId, { page_size: 20 })
      setExecutions(res?.data || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadWorkflows() }, [loadWorkflows])

  useEffect(() => {
    if (activeWfId && showExecutions) loadExecutions(activeWfId)
  }, [activeWfId, showExecutions, loadExecutions])

  // 加载 Web 自动化项目列表（供节点配置选择）
  useEffect(() => {
    if (selectedNode?.type === "web_automation" && webProjects.length === 0) {
      import("@/lib/api").then(({ webApi }) => {
        webApi.listProjectsForWorkflow().then((res: any) => {
          setWebProjects(res?.data || [])
        }).catch(() => {})
      })
    }
  }, [selectedNode?.type])

  // ── 操作 ──
  const createWorkflow = async () => {
    if (!newWfName.trim()) return
    setCreating(true)
    try {
      const res: any = await workflowApi.createWorkflow({ name: newWfName.trim() })
      toast.success("工作流创建成功")
      setNewWfName("")
      setShowNewWf(false)
      await loadWorkflows()
      await loadWorkflow(res.id)
    } catch (e: any) {
      toast.error("创建失败: " + (e?.message || ""))
    } finally {
      setCreating(false)
    }
  }

  const saveCanvas = async () => {
    if (!activeWfId) return
    setSaving(true)
    try {
      await workflowApi.saveCanvas(activeWfId, { nodes, edges })
      await workflowApi.updateWorkflow(activeWfId, { name: wfName, description: wfDescription })
      toast.success("保存成功")
      await loadWorkflows()
    } catch (e: any) {
      toast.error("保存失败: " + (e?.message || ""))
    } finally {
      setSaving(false)
    }
  }

  const executeWorkflow = async () => {
    if (!activeWfId) return
    setExecuting(true)
    try {
      await saveCanvas()
      const res: any = await workflowApi.executeWorkflow(activeWfId)
      toast.success("执行完成，状态: " + (res.status || "unknown"))
      if (showExecutions) loadExecutions(activeWfId)
    } catch (e: any) {
      toast.error("执行失败: " + (e?.message || ""))
    } finally {
      setExecuting(false)
    }
  }

  const deleteWorkflow = async (id: number) => {
    try {
      await workflowApi.deleteWorkflow(id)
      toast.success("已删除")
      if (activeWfId === id) {
        setActiveWfId(null)
        setNodes([])
        setEdges([])
        setWfName("")
      }
      await loadWorkflows()
    } catch { /* ignore */ }
  }

  // ── 节点操作 ──
  const addNode = (type: string) => {
    const nt = NODE_TYPES[type]
    if (!nt) return
    const tempId = nextTempId
    setNextTempId(prev => prev - 1)
    const newNode: CanvasNode = {
      id: tempId,
      type,
      label: nt.label,
      config: { ...nt.defaultConfig },
      position_x: 100 + (nodes.length * 30) % 300,
      position_y: 100 + Math.floor(nodes.length / 5) * 120,
    }
    setNodes(prev => [...prev, newNode])
  }

  const removeNode = (id: number) => {
    if (id > 0) return // 只允许删除临时节点（已保存的由全量覆盖）
    setNodes(prev => prev.filter(n => n.id !== id))
    setEdges(prev => prev.filter(e => e.source_node_id !== id && e.target_node_id !== id))
    if (selectedNode?.id === id) { setSelectedNode(null); setShowConfig(false) }
  }

  const updateNodeConfig = (id: number, field: string, value: any) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, config: { ...n.config, [field]: value } } : n))
    if (selectedNode?.id === id) {
      setSelectedNode(prev => prev ? { ...prev, config: { ...prev.config, [field]: value } } : null)
      setConfigForm((prev: any) => ({ ...prev, [field]: value }))
    }
  }

  // ── 边操作 ──
  const addEdge = (source: number, target: number) => {
    // 避免重复
    if (edges.some(e => e.source_node_id === source && e.target_node_id === target)) return
    // 避免自环
    if (source === target) return
    setEdges(prev => [...prev, { source_node_id: source, target_node_id: target }])
  }

  // ── SVG 事件 ──
  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const target = e.target as SVGElement
    // 点击空白取消选中
    if (target === svgRef.current || target.classList.contains("canvas-bg")) {
      setSelectedNode(null)
      setShowConfig(false)
      setConnecting(null)
    }
  }

  const handleNodeMouseDown = (e: React.MouseEvent, node: CanvasNode) => {
    if (e.button !== 0) return
    const svg = svgRef.current!
    const rect = svg.getBoundingClientRect()
    dragRef.current = {
      nodeId: node.id,
      startX: e.clientX,
      startY: e.clientY,
      nodeX: node.position_x,
      nodeY: node.position_y,
    }
    setSelectedNode(node)
    setConfigForm({ ...node.config })
    setShowConfig(true)
  }

  const handleNodeMouseUp = (e: React.MouseEvent, node: CanvasNode) => {
    if (connecting !== null && connecting !== node.id) {
      addEdge(connecting, node.id)
      setConnecting(null)
    }
  }

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    const svg = svgRef.current!
    const rect = svg.getBoundingClientRect()
    const dx = (e.clientX - dragRef.current.startX)
    const dy = (e.clientY - dragRef.current.startY)
    const newX = Math.max(0, Math.min(2000, dragRef.current.nodeX + dx))
    const newY = Math.max(0, Math.min(2000, dragRef.current.nodeY + dy))
    setNodes(prev => prev.map(n =>
      n.id === dragRef.current!.nodeId ? { ...n, position_x: newX, position_y: newY } : n
    ))
  }

  const handleSvgMouseUp = () => {
    dragRef.current = null
  }

  const handlePortMouseDown = (e: React.MouseEvent, nodeId: number, port: "input" | "output") => {
    e.stopPropagation()
    if (port === "output") {
      setConnecting(nodeId)
    }
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as SVGElement).classList.contains("canvas-bg") && connecting !== null) {
      setConnecting(null)
    }
  }

  // ── 渲染 ──
  const W = 2000, H = 2000
  const NODE_W = 160, NODE_H = 56

  const nodePositions = useMemo(() => {
    const map: Record<number, { x: number; y: number; w: number; h: number }> = {}
    nodes.forEach(n => {
      map[n.id] = { x: n.position_x, y: n.position_y, w: NODE_W, h: NODE_H }
    })
    return map
  }, [nodes])

  // 计算箭头路径
  const getEdgePath = (source: number, target: number) => {
    const s = nodePositions[source]
    const t = nodePositions[target]
    if (!s || !t) return ""
    const x1 = s.x + s.w, y1 = s.y + s.h / 2
    const x2 = t.x, y2 = t.y + t.h / 2
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f0f1a] text-white overflow-hidden">
      {/* ── 顶部栏 ── */}
      <header className="h-12 shrink-0 flex items-center px-4 bg-[#1a1a2e] border-b border-white/10 gap-3">
        <button onClick={() => navigate("/")} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          <span className="text-xs font-medium">返回</span>
        </button>
        <div className="w-px h-6 bg-white/10" />
        <Cpu className="w-4 h-4 text-amber" />
        <span className="text-sm font-bold tracking-wide" style={{ fontFamily: "Georgia, serif" }}>Agent 工作流</span>

        {activeWfId && (
          <>
            <div className="w-px h-6 bg-white/10" />
            <input
              value={wfName}
              onChange={e => setWfName(e.target.value)}
              className="bg-transparent text-sm font-medium border-none outline-none focus:bg-white/5 px-2 py-0.5 rounded w-48"
              placeholder="工作流名称"
            />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40">{nodes.length} 节点 · {edges.length} 连线</span>
              <button onClick={() => setShowPalette(p => !p)} className="px-2 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> {showPalette ? "隐藏" : "模板"}
              </button>
              <button onClick={() => { setShowExecutions(s => !s); if (activeWfId && !showExecutions) loadExecutions(activeWfId) }} className="px-2 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> 历史
              </button>
              <button onClick={saveCanvas} disabled={saving} className="px-3 h-7 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                保存
              </button>
              <button onClick={executeWorkflow} disabled={executing} className="px-3 h-7 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                执行
              </button>
            </div>
          </>
        )}
      </header>

      {/* ── 主体 ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── 左侧工作流列表 ── */}
        <div className="w-56 shrink-0 bg-[#151528] border-r border-white/10 flex flex-col">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">工作流</span>
            <button onClick={() => setShowNewWf(true)} className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {workflows.map((wf: any) => (
              <div
                key={wf.id}
                onClick={() => loadWorkflow(wf.id)}
                className={`px-3 py-2 rounded-xl text-xs cursor-pointer transition-all flex items-center justify-between group ${
                  activeWfId === wf.id ? "bg-amber-600/20 text-amber border border-amber-600/30" : "hover:bg-white/5 text-white/70"
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{wf.name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-white/40 mt-0.5">
                    <span>{wf.node_count || 0} 节点</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      wf.status === "draft" ? "bg-gray-500" : wf.status === "active" ? "bg-emerald-500" : "bg-amber-500"
                    }`} />
                    {wf.status}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteWorkflow(wf.id) }}
                  className="p-1 rounded-lg hover:bg-red-500/20 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {workflows.length === 0 && (
              <div className="text-center py-8 text-white/20 text-xs">暂无工作流</div>
            )}
          </div>
        </div>

        {/* ── 节点模板面板 ── */}
        {showPalette && (
          <div className="w-44 shrink-0 bg-[#151528] border-r border-white/10 flex flex-col">
            <div className="p-3 border-b border-white/10">
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">节点模板</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {Object.entries(NODE_TYPES).map(([type, nt]) => {
                const Icon = nt.icon
                return (
                  <button
                    key={type}
                    onClick={() => addNode(type)}
                    className="w-full px-3 py-2 rounded-xl text-xs hover:bg-white/10 transition-colors flex items-center gap-2.5 text-white/70 group"
                  >
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: nt.color + "20" }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: nt.color }} />
                    </div>
                    <span className="group-hover:text-white">{nt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── SVG 画布 ── */}
        <div className="flex-1 relative overflow-hidden bg-[#0f0f1a]"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        >
          {!activeWfId ? (
            <div className="flex items-center justify-center h-full text-white/20">
              <div className="text-center">
                <Layers className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-sm">选择或创建一个工作流</p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-amber" />
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="w-full h-full cursor-grab active:cursor-grabbing"
              onMouseDown={handleSvgMouseDown}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleSvgMouseUp}
              onClick={handleCanvasClick}
            >
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.3)" />
                </marker>
                <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
                </marker>
              </defs>

              {/* 边缘（连线） */}
              {edges.map((edge, i) => {
                const path = getEdgePath(edge.source_node_id, edge.target_node_id)
                const isConnecting = connecting === edge.source_node_id
                return path ? (
                  <g key={`edge-${i}`}>
                    <path d={path} fill="none"
                      stroke={isConnecting ? "#f59e0b" : "rgba(255,255,255,0.25)"}
                      strokeWidth={isConnecting ? 2.5 : 1.5}
                      markerEnd={isConnecting ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                      className="transition-colors"
                    />
                    {edge.label && (
                      <text fontSize="9" fill="rgba(255,255,255,0.4)" textAnchor="middle">
                        <textPath href={`#edge-path-${i}`} startOffset="50%">{edge.label}</textPath>
                      </text>
                    )}
                  </g>
                ) : null
              })}

              {/* 拖拽中的连线 */}
              {connecting && nodePositions[connecting] && (
                <line
                  x1={nodePositions[connecting].x + NODE_W}
                  y1={nodePositions[connecting].y + NODE_H / 2}
                  x2={nodePositions[connecting].x + NODE_W + 100}
                  y2={nodePositions[connecting].y + NODE_H / 2 + 50}
                  stroke="#f59e0b" strokeWidth={2} strokeDasharray="6,4"
                  markerEnd="url(#arrowhead-active)"
                />
              )}

              {/* 隐藏的 textPath 定义 */}
              {edges.map((_, i) => (
                <path key={`edge-path-${i}`} id={`edge-path-${i}`} d="M0 0" />
              ))}

              {/* 节点 */}
              {nodes.map(node => {
                const nt = NODE_TYPES[node.type]
                const Icon = nt?.icon || Circle
                const color = nt?.color || "#6b7280"
                const isSelected = selectedNode?.id === node.id
                const isConnectingSrc = connecting === node.id

                return (
                  <g key={node.id}
                    onMouseDown={e => handleNodeMouseDown(e, node)}
                    onMouseUp={e => handleNodeMouseUp(e, node)}
                    className="cursor-move"
                  >
                    {/* 选中框 */}
                    {isSelected && (
                      <rect x={node.position_x - 4} y={node.position_y - 4}
                        width={NODE_W + 8} height={NODE_H + 8} rx="12" ry="12"
                        fill="none" stroke={color} strokeWidth={2} strokeDasharray="6,3"
                        opacity={0.6}
                      />
                    )}
                    {/* 节点背景 */}
                    <rect x={node.position_x} y={node.position_y}
                      width={NODE_W} height={NODE_H} rx="10" ry="10"
                      fill={isSelected ? "#1e1e3a" : "#1a1a2e"}
                      stroke={isConnectingSrc ? "#f59e0b" : isSelected ? color : "rgba(255,255,255,0.1)"}
                      strokeWidth={isConnectingSrc ? 2 : 1.5}
                      className="transition-colors"
                    />
                    {/* 图标 */}
                    <foreignObject x={node.position_x + 8} y={node.position_y + 10} width="24" height="24">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "25" }}>
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                      </div>
                    </foreignObject>
                    {/* 标签 */}
                    <text x={node.position_x + 38} y={node.position_y + 22}
                      fontSize="12" fontWeight="600" fill="rgba(255,255,255,0.9)"
                      textLength={NODE_W - 48} lengthAdjust="spacing"
                    >{node.label || node.type}</text>
                    <text x={node.position_x + 38} y={node.position_y + 40}
                      fontSize="9" fill="rgba(255,255,255,0.35)"
                    >{node.type}</text>

                    {/* 输入端口 */}
                    <circle cx={node.position_x} cy={node.position_y + NODE_H / 2} r="5"
                      fill="#151528" stroke="rgba(255,255,255,0.3)" strokeWidth={2}
                      className="cursor-crosshair hover:stroke-amber"
                      onMouseDown={e => handlePortMouseDown(e, node.id, "input")}
                    />
                    {/* 输出端口 */}
                    <circle cx={node.position_x + NODE_W} cy={node.position_y + NODE_H / 2} r="5"
                      fill="#151528" stroke={isConnectingSrc ? "#f59e0b" : "rgba(255,255,255,0.3)"} strokeWidth={2}
                      className="cursor-crosshair hover:stroke-amber"
                      onMouseDown={e => handlePortMouseDown(e, node.id, "output")}
                    />
                    {/* 删除按钮（仅临时节点） */}
                    {node.id < 0 && (
                      <foreignObject x={node.position_x + NODE_W - 28} y={node.position_y - 10} width="20" height="20">
                        <button onClick={() => removeNode(node.id)}
                          className="w-5 h-5 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors">
                          <X className="w-3 h-3 text-red-400" />
                        </button>
                      </foreignObject>
                    )}
                  </g>
                )
              })}
            </svg>
          )}
        </div>

        {/* ── 右侧面板 ── */}
        {showConfig && selectedNode && (
          <div className="w-72 shrink-0 bg-[#151528] border-l border-white/10 flex flex-col">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">节点配置</span>
              <button onClick={() => { setShowConfig(false); setSelectedNode(null) }} className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-sm">
              {/* 基本信息 */}
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">类型</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-white/70">
                  {(() => { const Icon = NODE_TYPES[selectedNode.type]?.icon || Circle; return <Icon className="w-4 h-4" style={{ color: NODE_TYPES[selectedNode.type]?.color }} />; })()}
                  <span className="text-xs">{NODE_TYPES[selectedNode.type]?.label || selectedNode.type}</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">名称</label>
                <input value={selectedNode.label} onChange={e => {
                  const v = e.target.value
                  setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, label: v } : n))
                  setSelectedNode(prev => prev ? { ...prev, label: v } : null)
                }} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-amber/50" />
              </div>
              {/* 配置字段 */}
              {selectedNode.type === "web_automation" ? (
                <>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">操作类型</label>
                    <select
                      value={configForm.action || "explore"}
                      onChange={e => updateNodeConfig(selectedNode.id, "action", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-amber/50"
                    >
                      <option value="explore">AI 探索</option>
                      <option value="generate">生成测试用例</option>
                      <option value="execute">执行测试</option>
                      <option value="list_pages">列出页面</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">目标项目</label>
                    <select
                      value={configForm.project_id || ""}
                      onChange={e => updateNodeConfig(selectedNode.id, "project_id", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-amber/50"
                    >
                      <option value="">选择项目...</option>
                      {webProjects.map((p: any) => (
                        <option key={p.id} value={String(p.id)}>{p.name} ({p.status})</option>
                      ))}
                    </select>
                    {webProjects.length === 0 && (
                      <p className="text-[10px] text-white/30 mt-1">暂无项目，请先在 AI Web自动化 中创建</p>
                    )}
                  </div>
                </>
              ) : (
                Object.entries(configForm || {}).map(([key, val]) => (
                  <div key={key}>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">{key}</label>
                    {typeof val === "string" ? (
                      <textarea
                        value={val as string}
                        onChange={e => updateNodeConfig(selectedNode.id, key, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-amber/50 resize-none font-mono"
                        rows={key.includes("prompt") || key.includes("code") || key.includes("instruction") ? 4 : 2}
                      />
                    ) : typeof val === "number" ? (
                      <input type="number" value={val as number} onChange={e => updateNodeConfig(selectedNode.id, key, parseFloat(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-amber/50" />
                    ) : (
                      <textarea
                        value={JSON.stringify(val, null, 2)}
                        onChange={e => { try { updateNodeConfig(selectedNode.id, key, JSON.parse(e.target.value)) } catch { /* ignore */ } }}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-amber/50 resize-none font-mono"
                        rows={3}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── 执行历史面板 ── */}
        {showExecutions && activeWfId && (
          <div className="w-64 shrink-0 bg-[#151528] border-l border-white/10 flex flex-col">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">执行历史</span>
              <button onClick={() => setShowExecutions(false)} className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {executions.map((ex: any) => (
                <div key={ex.id} className="px-3 py-2 rounded-xl bg-white/5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">#{ex.id}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      ex.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                      ex.status === "running" ? "bg-amber-500/20 text-amber-400" :
                      ex.status === "failed" ? "bg-red-500/20 text-red-400" :
                      "bg-white/10 text-white/40"
                    }`}>{ex.status}</span>
                  </div>
                  <div className="text-[10px] text-white/30">
                    {ex.started_at ? new Date(ex.started_at).toLocaleString() : "-"}
                  </div>
                  {ex.error && <div className="text-[10px] text-red-400 truncate">{ex.error}</div>}
                </div>
              ))}
              {executions.length === 0 && (
                <div className="text-center py-8 text-white/20 text-xs">暂无执行记录</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 新建工作流弹窗 ── */}
      {showNewWf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowNewWf(false)}>
          <div className="bg-[#1a1a2e] rounded-2xl w-96 p-6 border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-4">新建工作流</h3>
            <input value={newWfName} onChange={e => setNewWfName(e.target.value)}
              placeholder="输入工作流名称..." autoFocus
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-amber/50 mb-4"
              onKeyDown={e => e.key === "Enter" && createWorkflow()}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowNewWf(false); setNewWfName("") }}
                className="px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors">取消</button>
              <button onClick={createWorkflow} disabled={creating || !newWfName.trim()}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 flex items-center gap-1.5">
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
