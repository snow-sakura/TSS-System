/**
 * 工作流编排可视化编辑器 — SVG DAG 画布（功能完整版）
 *
 * 设计：Polaroid 暖白主题 — 浅色柔和、温暖专业
 * 功能：缩放/平移、连线、节点拖拽、键盘快捷键、小地图
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { workflowApi } from "@/lib/api"
import {
  Plus, Play, Save, Trash2, ChevronLeft,
  Loader2, X, Circle,
  Cpu, Zap, Database, MessageSquare, GitFork,
  Clock, FileCode, Globe, Square,
  Layers, Undo2, Redo2, ZoomIn, ZoomOut, Maximize,
  Info,
} from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

// ── 节点类型定义（浅色调柔色方案） ──
const NODE_TYPES: Record<string, { label: string; color: string; bg: string; icon: any; defaultConfig: any; fields?: { key: string; label: string; type: "text" | "textarea" | "number" | "select"; options?: string[]; placeholder?: string }[] }> = {
  start:          { label: "开始",       color: "#4A7C59", bg: "#E8F5E9", icon: Circle,        defaultConfig: {}, fields: [] },
  end:            { label: "结束",       color: "#C75050", bg: "#FDECEA", icon: Square,        defaultConfig: {}, fields: [] },
  engine_task:    { label: "AI 引擎",    color: "#7C5CBF", bg: "#F3EDFF", icon: Cpu,           defaultConfig: { engine_type: "mock", url: "", instruction: "" }, fields: [
    { key: "engine_type", label: "引擎类型", type: "select", options: ["mock", "openai", "custom"] },
    { key: "url", label: "服务地址", type: "text", placeholder: "http://..." },
    { key: "instruction", label: "指令", type: "textarea", placeholder: "输入 AI 指令..." },
  ] },
  mcp_tool:       { label: "MCP 工具",   color: "#C4872F", bg: "#FFF3E0", icon: Zap,           defaultConfig: { service_id: "", tool_name: "", params: "{}" }, fields: [
    { key: "service_id", label: "服务 ID", type: "text", placeholder: "服务标识" },
    { key: "tool_name", label: "工具名称", type: "text", placeholder: "工具名" },
    { key: "params", label: "参数 (JSON)", type: "textarea", placeholder: "{}" },
  ] },
  knowledge_query:{ label: "知识库",     color: "#2E97A7", bg: "#E6F7FA", icon: Database,      defaultConfig: { query_template: "", limit: 5 }, fields: [
    { key: "query_template", label: "查询模板", type: "textarea", placeholder: "输入查询模板..." },
    { key: "limit", label: "返回数量", type: "number" },
  ] },
  llm_chat:       { label: "LLM 对话",   color: "#5B7FA5", bg: "#E8F0F8", icon: MessageSquare, defaultConfig: { prompt_template: "", model: "" }, fields: [
    { key: "prompt_template", label: "提示词模板", type: "textarea", placeholder: "输入提示词..." },
    { key: "model", label: "模型", type: "text", placeholder: "gpt-4o" },
  ] },
  condition:      { label: "条件分支",    color: "#D48A3C", bg: "#FFF3E0", icon: GitFork,       defaultConfig: { expression: "true" }, fields: [
    { key: "expression", label: "条件表达式", type: "textarea", placeholder: "例: output.score > 0.8" },
  ] },
  delay:          { label: "延时",       color: "#8A7C70", bg: "#F3EDE4", icon: Clock,         defaultConfig: { seconds: 1 }, fields: [
    { key: "seconds", label: "秒数", type: "number" },
  ] },
  script:         { label: "脚本",       color: "#3B9B7A", bg: "#E8F5E9", icon: FileCode,      defaultConfig: { language: "python", code: "" }, fields: [
    { key: "language", label: "语言", type: "select", options: ["python", "javascript", "shell"] },
    { key: "code", label: "代码", type: "textarea", placeholder: "输入脚本代码..." },
  ] },
  web_automation: { label: "Web自动化",  color: "#3580C4", bg: "#E3F2FD", icon: Globe,         defaultConfig: { action: "explore", project_id: "" }, fields: [
    { key: "action", label: "操作", type: "select", options: ["explore", "generate", "execute", "list_pages"] },
    { key: "project_id", label: "项目 ID", type: "text", placeholder: "项目标识" },
  ] },
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

interface Transform {
  x: number
  y: number
  scale: number
}

// ── 小地图常量 ──
const MINIMAP_W = 180
const MINIMAP_H = 120
const MINIMAP_PADDING = 20

export default function WorkflowEditorPage() {
  const navigate = useNavigate()

  // ── 核心状态 ──
  const [workflows, setWorkflows] = useState<any[]>([])
  const [activeWfId, setActiveWfId] = useState<number | null>(null)
  const [wfName, setWfName] = useState("")
  const [wfDescription, setWfDescription] = useState("")
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [edges, setEdges] = useState<CanvasEdge[]>([])
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null) // edge index
  const [connecting, setConnecting] = useState<{ sourceId: number; mouseX: number; mouseY: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showExecutions, setShowExecutions] = useState(false)
  const [executions, setExecutions] = useState<any[]>([])
  const [showConfig, setShowConfig] = useState(false)
  const [showNewWf, setShowNewWf] = useState(false)
  const [newWfName, setNewWfName] = useState("")
  const [showPalette, setShowPalette] = useState(true)
  const [showDescription, setShowDescription] = useState(false)
  const [webProjects, setWebProjects] = useState<any[]>([])

  // ── 画布变换 ──
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, tx: 0, ty: 0 })
  const [spaceHeld, setSpaceHeld] = useState(false)

  // ── 历史记录（撤销/重做） ──
  const [history, setHistory] = useState<{ nodes: CanvasNode[]; edges: CanvasEdge[] }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const historyIndexRef = useRef(-1)

  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ nodeId: number; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null)

  const NODE_W = 160, NODE_H = 56

  // ── 历史管理 ──
  const pushHistory = useCallback((ns: CanvasNode[], es: CanvasEdge[]) => {
    setHistory(prev => {
      const idx = historyIndexRef.current
      const trimmed = prev.slice(0, idx + 1)
      return [...trimmed, { nodes: JSON.parse(JSON.stringify(ns)), edges: JSON.parse(JSON.stringify(es)) }].slice(-50)
    })
    setHistoryIndex(prev => {
      const next = Math.min(prev + 1, 49)
      historyIndexRef.current = next
      return next
    })
  }, [])

  const undo = useCallback(() => {
    const idx = historyIndexRef.current
    if (idx <= 0) return
    // 用 history state 的 functional updater 来读取正确的 prev 值
    const prevEntry = history[idx - 1]
    if (!prevEntry) return
    setNodes(prevEntry.nodes)
    setEdges(prevEntry.edges)
    const nextIdx = idx - 1
    historyIndexRef.current = nextIdx
    setHistoryIndex(nextIdx)
    toast.info("已撤销")
  }, [history])

  const redo = useCallback(() => {
    const idx = historyIndexRef.current
    if (idx >= history.length - 1) return
    const nextEntry = history[idx + 1]
    if (!nextEntry) return
    setNodes(nextEntry.nodes)
    setEdges(nextEntry.edges)
    const nextIdx = idx + 1
    historyIndexRef.current = nextIdx
    setHistoryIndex(nextIdx)
    toast.info("已重做")
  }, [history])

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
      const loadedNodes = res.nodes || []
      const loadedEdges = res.edges || []
      setNodes(loadedNodes)
      setEdges(loadedEdges)
      setActiveWfId(id)
      setSelectedNode(null)
      setSelectedEdge(null)
      setShowExecutions(false)
      const initialSnapshot = { nodes: JSON.parse(JSON.stringify(loadedNodes)), edges: JSON.parse(JSON.stringify(loadedEdges)) }
      setHistory([initialSnapshot])
      setHistoryIndex(0)
      historyIndexRef.current = 0
      // 自动适配视图
      setTimeout(() => fitView(loadedNodes), 100)
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

  useEffect(() => {
    if (selectedNode?.type === "web_automation" && webProjects.length === 0) {
      import("@/lib/api").then(({ webApi }) => {
        webApi.listProjectsForWorkflow().then((res: any) => {
          setWebProjects(res?.data || [])
        }).catch(() => {})
      })
    }
  }, [selectedNode?.type])

  // ── 键盘快捷键 ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space 键切换平移模式
      if (e.code === "Space" && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault()
        setSpaceHeld(true)
      }
      // Delete / Backspace 删除选中元素
      if ((e.key === "Delete" || e.key === "Backspace") && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        if (selectedNode) {
          e.preventDefault()
          removeNode(selectedNode.id)
        } else if (selectedEdge !== null) {
          e.preventDefault()
          removeEdge(selectedEdge)
        }
      }
      // Escape 取消连线 / 取消选择
      if (e.key === "Escape") {
        if (connecting) {
          setConnecting(null)
        } else {
          setSelectedNode(null)
          setSelectedEdge(null)
          setShowConfig(false)
        }
      }
      // Ctrl+Z / Cmd+Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z 重做
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
        e.preventDefault()
        redo()
      }
      // Ctrl+S / Cmd+S 保存
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        saveCanvas()
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [selectedNode, selectedEdge, connecting, undo, redo])

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
        setSelectedNode(null)
        setSelectedEdge(null)
      }
      await loadWorkflows()
    } catch { /* ignore */ }
  }

  // ── 节点操作 ──
  const addNode = (type: string) => {
    const nt = NODE_TYPES[type]
    if (!nt) return
    // 用负数 ID 作为临时节点标识（基于当前节点数计算，避免闭包过期）
    const newId = -(nodes.length + 1)
    // 放在画布中心，按已有节点数量自动偏移避免重叠
    const centerX = (window.innerWidth / 2 - transform.x) / transform.scale
    const centerY = (window.innerHeight / 2 - transform.y) / transform.scale
    const count = nodes.length
    const col = count % 4
    const row = Math.floor(count / 4)
    const newNode: CanvasNode = {
      id: newId,
      type,
      label: nt.label,
      config: { ...nt.defaultConfig },
      position_x: centerX - NODE_W / 2 + col * (NODE_W + 40),
      position_y: centerY - NODE_H / 2 + row * (NODE_H + 40),
    }
    const newNodes = [...nodes, newNode]
    setNodes(newNodes)
    pushHistory(newNodes, edges)
  }

  const removeNode = (id: number) => {
    const newNodes = nodes.filter(n => n.id !== id)
    const newEdges = edges.filter(e => e.source_node_id !== id && e.target_node_id !== id)
    setNodes(newNodes)
    setEdges(newEdges)
    if (selectedNode?.id === id) { setSelectedNode(null); setShowConfig(false) }
    pushHistory(newNodes, newEdges)
  }

  const updateNodeConfig = (id: number, field: string, value: any) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, config: { ...n.config, [field]: value } } : n))
    if (selectedNode?.id === id) {
      setSelectedNode(prev => prev ? { ...prev, config: { ...prev.config, [field]: value } } : null)
    }
  }

  const updateNodeLabel = (id: number, label: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, label } : n))
    if (selectedNode?.id === id) {
      setSelectedNode(prev => prev ? { ...prev, label } : null)
    }
  }

  // ── 边操作 ──
  const addEdge = (source: number, target: number) => {
    if (edges.some(e => e.source_node_id === source && e.target_node_id === target)) return
    if (source === target) return
    // 条件分支自动添加 true/false 标签
    const sourceNode = nodes.find(n => n.id === source)
    const label = sourceNode?.type === "condition" ? (edges.filter(e => e.source_node_id === source).length === 0 ? "true" : "false") : undefined
    const newEdges = [...edges, { source_node_id: source, target_node_id: target, label }]
    setEdges(newEdges)
    pushHistory(nodes, newEdges)
  }

  const removeEdge = (index: number) => {
    const newEdges = edges.filter((_, i) => i !== index)
    setEdges(newEdges)
    setSelectedEdge(null)
    pushHistory(nodes, newEdges)
  }

  // ── 画布缩放/平移 ──
  const fitView = (ns?: CanvasNode[]) => {
    const nodeList = ns || nodes
    if (nodeList.length === 0) {
      setTransform({ x: 0, y: 0, scale: 1 })
      return
    }
    const minX = Math.min(...nodeList.map(n => n.position_x)) - 80
    const minY = Math.min(...nodeList.map(n => n.position_y)) - 80
    const maxX = Math.max(...nodeList.map(n => n.position_x + NODE_W)) + 80
    const maxY = Math.max(...nodeList.map(n => n.position_y + NODE_H)) + 80
    const svgEl = svgRef.current
    if (!svgEl) return
    const svgRect = svgEl.getBoundingClientRect()
    const scaleX = svgRect.width / (maxX - minX)
    const scaleY = svgRect.height / (maxY - minY)
    const scale = Math.min(scaleX, scaleY, 1.5)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    setTransform({
      x: svgRect.width / 2 - centerX * scale,
      y: svgRect.height / 2 - centerY * scale,
      scale,
    })
  }

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const svgEl = svgRef.current
    if (!svgEl) return
    const rect = svgEl.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    if (e.ctrlKey || e.metaKey) {
      // 缩放
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setTransform(prev => {
        const newScale = Math.min(3, Math.max(0.15, prev.scale * delta))
        const ratio = newScale / prev.scale
        return {
          scale: newScale,
          x: mouseX - (mouseX - prev.x) * ratio,
          y: mouseY - (mouseY - prev.y) * ratio,
        }
      })
    } else {
      // 平移
      setTransform(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }))
    }
  }, [])

  // ── SVG 坐标转换 ──
  const svgPoint = useCallback((clientX: number, clientY: number) => {
    const svgEl = svgRef.current
    if (!svgEl) return { x: 0, y: 0 }
    const rect = svgEl.getBoundingClientRect()
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale,
    }
  }, [transform])

  // ── 鼠标事件 ──
  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      // 中键或 Space+左键 → 平移
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y })
      return
    }
    if (e.button !== 0) return
    const target = e.target as SVGElement
    if (target === svgRef.current || target.classList.contains("canvas-bg")) {
      setSelectedNode(null)
      setSelectedEdge(null)
      setShowConfig(false)
      setConnecting(null)
    }
  }

  const handleNodeMouseDown = (e: React.MouseEvent, node: CanvasNode) => {
    if (e.button !== 0 || spaceHeld) return
    e.stopPropagation()
    dragRef.current = {
      nodeId: node.id,
      startX: e.clientX,
      startY: e.clientY,
      nodeX: node.position_x,
      nodeY: node.position_y,
    }
    setSelectedNode(node)
    setSelectedEdge(null)
    setShowConfig(true)
  }

  const handleNodeMouseUp = (e: React.MouseEvent, node: CanvasNode) => {
    if (connecting && connecting.sourceId !== node.id) {
      addEdge(connecting.sourceId, node.id)
      setConnecting(null)
    }
  }

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    // 平移
    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: panStart.tx + (e.clientX - panStart.x),
        y: panStart.ty + (e.clientY - panStart.y),
      }))
      return
    }
    // 拖拽节点
    if (dragRef.current) {
      const dx = (e.clientX - dragRef.current.startX) / transform.scale
      const dy = (e.clientY - dragRef.current.startY) / transform.scale
      const newX = Math.max(0, Math.min(4000, dragRef.current.nodeX + dx))
      const newY = Math.max(0, Math.min(4000, dragRef.current.nodeY + dy))
      setNodes(prev => prev.map(n =>
        n.id === dragRef.current!.nodeId ? { ...n, position_x: newX, position_y: newY } : n
      ))
    }
    // 连线跟随鼠标
    if (connecting) {
      setConnecting(prev => prev ? { ...prev, mouseX: e.clientX, mouseY: e.clientY } : null)
    }
  }

  const handleSvgMouseUp = () => {
    if (isPanning) setIsPanning(false)
    if (dragRef.current) {
      // 记录历史
      pushHistory(nodes, edges)
      dragRef.current = null
    }
  }

  const handlePortMouseDown = (e: React.MouseEvent, nodeId: number, port: "input" | "output") => {
    e.stopPropagation()
    if (port === "output") {
      const pt = svgPoint(e.clientX, e.clientY)
      setConnecting({ sourceId: nodeId, mouseX: e.clientX, mouseY: e.clientY })
    }
  }

  const handleEdgeClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    setSelectedEdge(index)
    setSelectedNode(null)
    setShowConfig(false)
  }

  // ── 小地图数据 ──
  const minimapData = useMemo(() => {
    if (nodes.length === 0) return null
    const minX = Math.min(...nodes.map(n => n.position_x)) - MINIMAP_PADDING
    const minY = Math.min(...nodes.map(n => n.position_y)) - MINIMAP_PADDING
    const maxX = Math.max(...nodes.map(n => n.position_x + NODE_W)) + MINIMAP_PADDING
    const maxY = Math.max(...nodes.map(n => n.position_y + NODE_H)) + MINIMAP_PADDING
    const contentW = maxX - minX
    const contentH = maxY - minY
    const scale = Math.min(MINIMAP_W / contentW, MINIMAP_H / contentH)
    return { minX, minY, contentW, contentH, scale }
  }, [nodes])

  // ── 渲染常量 ──
  const nodePositions = useMemo(() => {
    const map: Record<number, { x: number; y: number; w: number; h: number }> = {}
    nodes.forEach(n => {
      map[n.id] = { x: n.position_x, y: n.position_y, w: NODE_W, h: NODE_H }
    })
    return map
  }, [nodes])

  const getEdgePath = (source: number, target: number) => {
    const s = nodePositions[source]
    const t = nodePositions[target]
    if (!s || !t) return ""
    const x1 = s.x + s.w, y1 = s.y + s.h / 2
    const x2 = t.x, y2 = t.y + t.h / 2
    const dx = Math.abs(x2 - x1)
    const cp = Math.max(60, dx * 0.4)
    return `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`
  }

  // 连线跟随鼠标的临时路径
  const getConnectingPath = () => {
    if (!connecting) return ""
    const s = nodePositions[connecting.sourceId]
    if (!s) return ""
    const x1 = s.x + s.w, y1 = s.y + s.h / 2
    const pt = svgPoint(connecting.mouseX, connecting.mouseY)
    const dx = Math.abs(pt.x - x1)
    const cp = Math.max(40, dx * 0.3)
    return `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${pt.x - cp} ${pt.y}, ${pt.x} ${pt.y}`
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden select-none">
      {/* ── 顶部工具栏 ── */}
      <header className="h-12 shrink-0 flex items-center px-4 bg-card border-b border-border gap-3 z-10">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-xs font-medium">返回</span>
        </button>
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-light flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-amber" />
          </div>
          <span className="text-sm font-bold text-foreground" style={{ fontFamily: "Georgia, serif" }}>Agent 工作流</span>
        </div>

        {activeWfId && (
          <>
            <div className="w-px h-6 bg-border" />
            <input
              value={wfName}
              onChange={e => setWfName(e.target.value)}
              className="bg-transparent text-sm font-medium border-none outline-none focus:bg-accent/50 px-2 py-0.5 rounded w-48 text-foreground placeholder:text-muted-light"
              placeholder="工作流名称"
            />
            <button
              onClick={() => setShowDescription(d => !d)}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-light hover:text-foreground transition-colors"
              title="编辑描述"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            {showDescription && (
              <input
                value={wfDescription}
                onChange={e => setWfDescription(e.target.value)}
                className="bg-transparent text-xs border-none outline-none focus:bg-accent/50 px-2 py-0.5 rounded w-64 text-muted-foreground placeholder:text-muted-light"
                placeholder="添加描述..."
              />
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-light mr-1">{nodes.length} 节点 · {edges.length} 连线</span>

              {/* 缩放控制 */}
              <div className="flex items-center gap-0.5 bg-paper rounded-lg border border-border px-1">
                <button onClick={() => setTransform(p => ({ ...p, scale: Math.min(3, p.scale * 1.2) }))} className="p-1 rounded hover:bg-accent text-muted-light hover:text-foreground transition-colors"><ZoomIn className="w-3 h-3" /></button>
                <span className="text-[10px] text-muted-light w-8 text-center">{Math.round(transform.scale * 100)}%</span>
                <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.15, p.scale * 0.8) }))} className="p-1 rounded hover:bg-accent text-muted-light hover:text-foreground transition-colors"><ZoomOut className="w-3 h-3" /></button>
                <div className="w-px h-3 bg-border" />
                <button onClick={() => fitView()} className="p-1 rounded hover:bg-accent text-muted-light hover:text-foreground transition-colors" title="适配视图"><Maximize className="w-3 h-3" /></button>
              </div>

              <div className="w-px h-5 bg-border mx-0.5" />

              {/* 撤销/重做 */}
              <button onClick={undo} disabled={historyIndex <= 0} className="p-1.5 rounded-lg text-muted-light hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30" title="撤销 (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /></button>
              <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-1.5 rounded-lg text-muted-light hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30" title="重做 (Ctrl+Shift+Z)"><Redo2 className="w-3.5 h-3.5" /></button>

              <div className="w-px h-5 bg-border mx-0.5" />

              <button
                onClick={() => setShowPalette(p => !p)}
                className="px-2.5 py-1.5 rounded-lg text-xs text-muted-light hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1"
              >
                <Layers className="w-3.5 h-3.5" /> {showPalette ? "隐藏" : "模板"}
              </button>
              <button
                onClick={() => { setShowExecutions(s => !s); if (activeWfId && !showExecutions) loadExecutions(activeWfId) }}
                className="px-2.5 py-1.5 rounded-lg text-xs text-muted-light hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1"
              >
                历史
              </button>
              <div className="w-px h-5 bg-border mx-0.5" />
              <button
                onClick={saveCanvas}
                disabled={saving}
                className="px-3 h-7 rounded-lg text-xs font-medium bg-pass hover:bg-pass/90 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                保存
              </button>
              <button
                onClick={executeWorkflow}
                disabled={executing}
                className="px-3 h-7 rounded-lg text-xs font-medium gradient-amber text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                执行
              </button>
            </div>
          </>
        )}
      </header>

      {/* ── 主体 ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── 左侧面板：工作流列表 ── */}
        <div className="w-52 shrink-0 bg-card border-r border-border flex flex-col">
          <div className="p-3 border-b border-border-light flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-light uppercase tracking-wider">工作流列表</span>
            <button
              onClick={() => setShowNewWf(true)}
              className="p-1 rounded-lg hover:bg-accent text-muted-light hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {workflows.map((wf: any) => (
              <div
                key={wf.id}
                onClick={() => loadWorkflow(wf.id)}
                className={`px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all flex items-center justify-between group ${
                  activeWfId === wf.id
                    ? "bg-amber-light border border-amber/30 text-foreground"
                    : "hover:bg-accent text-muted-foreground"
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{wf.name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-light mt-0.5">
                    <span>{wf.node_count || 0} 节点</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      wf.status === "draft" ? "bg-muted-light" : wf.status === "active" ? "bg-pass" : "bg-amber"
                    }`} />
                    <span>{wf.status}</span>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); if (confirm("确认删除工作流？")) deleteWorkflow(wf.id) }}
                  className="p-1 rounded-lg hover:bg-fail-light text-muted-light hover:text-fail opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {workflows.length === 0 && (
              <div className="text-center py-8 text-muted-light text-xs">暂无工作流</div>
            )}
          </div>
        </div>

        {/* ── 节点模板面板 ── */}
        {showPalette && (
          <div className="w-40 shrink-0 bg-cream/50 border-r border-border flex flex-col">
            <div className="p-3 border-b border-border-light">
              <span className="text-[10px] font-semibold text-muted-light uppercase tracking-wider">节点模板</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {Object.entries(NODE_TYPES).map(([type, nt]) => {
                const Icon = nt.icon
                return (
                  <button
                    key={type}
                    onClick={() => addNode(type)}
                    className="w-full px-2.5 py-2 rounded-xl text-xs hover:bg-card transition-colors flex items-center gap-2.5 text-muted-foreground group shadow-sm"
                  >
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: nt.bg }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: nt.color }} />
                    </div>
                    <span className="group-hover:text-foreground truncate">{nt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── SVG 画布（浅色网格背景） ── */}
        <div
          className="flex-1 relative overflow-hidden"
          style={{
            background: "#FAF5F0",
            backgroundImage: "radial-gradient(circle, #D4C8BC33 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            cursor: spaceHeld || isPanning ? "grab" : "default",
          }}
        >
          {!activeWfId ? (
            <div className="flex items-center justify-center h-full text-muted-light">
              <div className="text-center animate-fade-in-up">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cream flex items-center justify-center">
                  <Layers className="w-8 h-8 text-amber/50" />
                </div>
                <p className="text-sm font-medium text-muted">选择或创建一个工作流</p>
                <p className="text-xs text-muted-light mt-1">从左侧列表选择，或点击 + 创建新工作流</p>
                <p className="text-[10px] text-muted-light mt-3">快捷键：Ctrl+S 保存 · Delete 删除 · Ctrl+Z 撤销 · 滚轮缩放</p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-amber" />
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="w-full h-full"
              style={{ cursor: spaceHeld || isPanning ? (isPanning ? "grabbing" : "grab") : "default" }}
              onMouseDown={handleSvgMouseDown}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleSvgMouseUp}
              onWheel={handleWheel}
            >
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#9C8E82" />
                </marker>
                <marker id="arrowhead-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#D4A574" />
                </marker>
                <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#4A3828" floodOpacity="0.08" />
                </filter>
                <filter id="card-shadow-hover" x="-10%" y="-10%" width="120%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="#4A3828" floodOpacity="0.12" />
                </filter>
              </defs>

              {/* 可缩放/平移的内容组 */}
              <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
                {/* 网格背景 */}
                <rect className="canvas-bg" x="-5000" y="-5000" width="15000" height="15000" fill="transparent" />

                {/* 连线 */}
                {edges.map((edge, i) => {
                  const path = getEdgePath(edge.source_node_id, edge.target_node_id)
                  const isSel = selectedEdge === i
                  return path ? (
                    <g key={`edge-${i}`} onClick={e => handleEdgeClick(e, i)} style={{ cursor: "pointer" }}>
                      {/* 宽点击区域 */}
                      <path d={path} fill="none" stroke="transparent" strokeWidth={12} />
                      <path
                        d={path}
                        fill="none"
                        stroke={isSel ? "#D4A574" : "#C4B8A8"}
                        strokeWidth={isSel ? 2.5 : 1.5}
                        markerEnd={isSel ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                        strokeLinecap="round"
                      />
                      {edge.label && (
                        <text
                          x={(nodePositions[edge.source_node_id]?.x + NODE_W + nodePositions[edge.target_node_id]?.x) / 2}
                          y={(nodePositions[edge.source_node_id]?.y + NODE_H / 2 + nodePositions[edge.target_node_id]?.y + NODE_H / 2) / 2 - 6}
                          fontSize="10"
                          fontWeight="500"
                          fill={edge.label === "true" ? "#4A7C59" : edge.label === "false" ? "#C75050" : "#9C8E82"}
                          textAnchor="middle"
                        >{edge.label}</text>
                      )}
                    </g>
                  ) : null
                })}

                {/* 连线中的临时线 */}
                {connecting && (() => {
                  const path = getConnectingPath()
                  return path ? (
                    <path d={path} fill="none" stroke="#D4A574" strokeWidth={2} strokeDasharray="6,4" markerEnd="url(#arrowhead-active)" />
                  ) : null
                })()}

                {/* 节点卡片 */}
                {nodes.map(node => {
                  const nt = NODE_TYPES[node.type]
                  const Icon = nt?.icon || Circle
                  const color = nt?.color || "#8A7C70"
                  const bgColor = nt?.bg || "#F3EDE4"
                  const isSelected = selectedNode?.id === node.id
                  const isConnectingSrc = connecting?.sourceId === node.id

                  return (
                    <g
                      key={node.id}
                      onMouseDown={e => handleNodeMouseDown(e, node)}
                      onMouseUp={e => handleNodeMouseUp(e, node)}
                      className="cursor-move"
                    >
                      {/* 选中高亮环 */}
                      {isSelected && (
                        <rect
                          x={node.position_x - 5}
                          y={node.position_y - 5}
                          width={NODE_W + 10}
                          height={NODE_H + 10}
                          rx="13" ry="13"
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          strokeDasharray="6,3"
                          opacity={0.5}
                        />
                      )}
                      {/* 卡片背景 */}
                      <rect
                        x={node.position_x}
                        y={node.position_y}
                        width={NODE_W}
                        height={NODE_H}
                        rx="10" ry="10"
                        fill="#FFFFFF"
                        stroke={isConnectingSrc ? "#D4A574" : isSelected ? color : "#E8DDD0"}
                        strokeWidth={isConnectingSrc ? 2 : 1}
                        filter={isSelected ? "url(#card-shadow-hover)" : "url(#card-shadow)"}
                      />
                      {/* 左侧色条 */}
                      <rect
                        x={node.position_x}
                        y={node.position_y}
                        width="4"
                        height={NODE_H}
                        rx="2"
                        fill={color}
                      />
                      {/* 图标 */}
                      <foreignObject x={node.position_x + 12} y={node.position_y + 12} width="24" height="24">
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: bgColor }}
                        >
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                      </foreignObject>
                      {/* 标签 */}
                      <text
                        x={node.position_x + 42}
                        y={node.position_y + 24}
                        fontSize="12"
                        fontWeight="600"
                        fill="#2C1810"
                        textLength={NODE_W - 52}
                        lengthAdjust="spacing"
                      >{node.label || node.type}</text>
                      <text
                        x={node.position_x + 42}
                        y={node.position_y + 40}
                        fontSize="9"
                        fill="#9C8E82"
                      >{node.type}</text>

                      {/* 输入端口 */}
                      <circle
                        cx={node.position_x}
                        cy={node.position_y + NODE_H / 2}
                        r="5"
                        fill="#FFFFFF"
                        stroke={isConnectingSrc ? "#D4A574" : "#C4B8A8"}
                        strokeWidth={2}
                        className="cursor-crosshair"
                        data-testid={`port-${node.label}-input`}
                        id={`port-${node.label}-input-${node.position_x}`}
                        onMouseDown={e => handlePortMouseDown(e, node.id, "input")}
                      />
                      {/* 输出端口 */}
                      <circle
                        cx={node.position_x + NODE_W}
                        cy={node.position_y + NODE_H / 2}
                        r="5"
                        fill="#FFFFFF"
                        stroke={isConnectingSrc ? "#D4A574" : "#C4B8A8"}
                        strokeWidth={2}
                        className="cursor-crosshair"
                        data-testid={`port-${node.label}-output`}
                        id={`port-${node.label}-output-${node.position_x + NODE_W}`}
                        onMouseDown={e => handlePortMouseDown(e, node.id, "output")}
                      />
                      {/* 删除按钮（仅临时节点） */}
                      {node.id < 0 && (
                        <foreignObject x={node.position_x + NODE_W - 26} y={node.position_y - 10} width="20" height="20">
                          <button
                            onClick={() => removeNode(node.id)}
                            className="w-5 h-5 rounded-full bg-fail-light hover:bg-fail/20 flex items-center justify-center transition-colors"
                          >
                            <X className="w-3 h-3 text-fail" />
                          </button>
                        </foreignObject>
                      )}
                    </g>
                  )
                })}
              </g>
            </svg>
          )}

          {/* ── 小地图 ── */}
          {activeWfId && nodes.length > 0 && minimapData && (
            <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm border border-border rounded-xl shadow-elevated overflow-hidden" style={{ width: MINIMAP_W, height: MINIMAP_H }}>
              <svg width={MINIMAP_W} height={MINIMAP_H}>
                {edges.map((edge, i) => {
                  const s = nodePositions[edge.source_node_id]
                  const t = nodePositions[edge.target_node_id]
                  if (!s || !t) return null
                  const sx = (s.x + s.w - minimapData.minX) * minimapData.scale
                  const sy = (s.y + s.h / 2 - minimapData.minY) * minimapData.scale
                  const tx = (t.x - minimapData.minX) * minimapData.scale
                  const ty = (t.y + t.h / 2 - minimapData.minY) * minimapData.scale
                  return <line key={i} x1={sx} y1={sy} x2={tx} y2={ty} stroke="#C4B8A8" strokeWidth={0.5} />
                })}
                {nodes.map(node => {
                  const nt = NODE_TYPES[node.type]
                  const x = (node.position_x - minimapData.minX) * minimapData.scale
                  const y = (node.position_y - minimapData.minY) * minimapData.scale
                  const w = NODE_W * minimapData.scale
                  const h = NODE_H * minimapData.scale
                  return (
                    <rect key={node.id} x={x} y={y} width={w} height={h} rx={2} fill={nt?.color || "#8A7C70"} opacity={selectedNode?.id === node.id ? 1 : 0.6} />
                  )
                })}
                {/* 视口框 */}
                {svgRef.current && (() => {
                  const svgRect = svgRef.current!.getBoundingClientRect()
                  const vx = (-transform.x / transform.scale - minimapData.minX) * minimapData.scale
                  const vy = (-transform.y / transform.scale - minimapData.minY) * minimapData.scale
                  const vw = (svgRect.width / transform.scale) * minimapData.scale
                  const vh = (svgRect.height / transform.scale) * minimapData.scale
                  return <rect x={vx} y={vy} width={vw} height={vh} fill="none" stroke="#D4A574" strokeWidth={1} strokeDasharray="2,2" />
                })()}
              </svg>
            </div>
          )}

          {/* ── 提示信息 ── */}
          {activeWfId && !loading && (
            <div className="absolute bottom-3 left-3 text-[10px] text-muted-light/60 space-x-3">
              <span>滚轮: 平移</span>
              <span>Ctrl+滚轮: 缩放</span>
              <span>空格+拖拽: 平移</span>
              <span>Delete: 删除</span>
            </div>
          )}
        </div>

        {/* ── 右侧：节点配置面板 ── */}
        {showConfig && selectedNode && (
          <div className="w-72 shrink-0 bg-card border-l border-border flex flex-col">
            <div className="p-3 border-b border-border-light flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => {
                  const nt = NODE_TYPES[selectedNode.type]
                  const Icon = nt?.icon || Circle
                  return (
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: nt?.bg || "#F3EDE4" }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: nt?.color || "#8A7C70" }} />
                    </div>
                  )
                })()}
                <span className="text-xs font-semibold text-foreground">节点配置</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { if (confirm("确认删除该节点？")) removeNode(selectedNode.id) }}
                  className="p-1 rounded-lg hover:bg-fail-light text-muted-light hover:text-fail transition-colors"
                  title="删除节点 (Delete)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setShowConfig(false); setSelectedNode(null) }}
                  className="p-1 rounded-lg hover:bg-accent text-muted-light hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-sm">
              {/* 类型标签 */}
              <div>
                <label className="text-[10px] text-muted-light uppercase tracking-wider block mb-1.5">类型</label>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-foreground text-xs"
                  style={{ backgroundColor: NODE_TYPES[selectedNode.type]?.bg || "#F3EDE4" }}
                >
                  {(() => {
                    const Icon = NODE_TYPES[selectedNode.type]?.icon || Circle
                    return <Icon className="w-4 h-4" style={{ color: NODE_TYPES[selectedNode.type]?.color }} />
                  })()}
                  <span>{NODE_TYPES[selectedNode.type]?.label || selectedNode.type}</span>
                </div>
              </div>
              {/* 模块跳转链接 */}
              {(selectedNode.type === "knowledge_query" || selectedNode.type === "web_automation") && (
                <div className="p-2 rounded-lg bg-info/5 border border-info/20">
                  <p className="text-[10px] text-info font-medium mb-1.5">关联模块</p>
                  <button
                    onClick={() => navigate(selectedNode.type === "knowledge_query" ? "/knowledge-base" : "/ai-web-automation")}
                    className="w-full text-left px-2 py-1.5 rounded-md text-xs text-info hover:bg-info/10 transition-colors flex items-center gap-1.5"
                  >
                    {selectedNode.type === "knowledge_query" ? (
                      <><Database className="w-3 h-3" /> 打开知识库 →</>
                    ) : (
                      <><Globe className="w-3 h-3" /> 打开 Web 自动化 →</>
                    )}
                  </button>
                </div>
              )}
              {/* 名称 */}
              <div>
                <label className="text-[10px] text-muted-light uppercase tracking-wider block mb-1.5">名称</label>
                <input
                  value={selectedNode.label}
                  onChange={e => updateNodeLabel(selectedNode.id, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-paper border border-border text-xs text-foreground outline-none input-focus"
                />
              </div>
              {/* 类型化配置字段 */}
              {(NODE_TYPES[selectedNode.type]?.fields || []).map(field => {
                const val = selectedNode.config?.[field.key] ?? ""
                return (
                  <div key={field.key}>
                    <label className="text-[10px] text-muted-light uppercase tracking-wider block mb-1.5">{field.label}</label>
                    {field.type === "select" ? (
                      <select
                        value={val}
                        onChange={e => updateNodeConfig(selectedNode.id, field.key, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-paper border border-border text-xs text-foreground outline-none input-focus"
                      >
                        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        value={val}
                        onChange={e => updateNodeConfig(selectedNode.id, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 rounded-lg bg-paper border border-border text-xs text-foreground outline-none input-focus resize-none font-mono"
                        rows={3}
                      />
                    ) : field.type === "number" ? (
                      <input
                        type="number"
                        value={val}
                        onChange={e => updateNodeConfig(selectedNode.id, field.key, parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-lg bg-paper border border-border text-xs text-foreground outline-none input-focus"
                      />
                    ) : (
                      <input
                        value={val}
                        onChange={e => updateNodeConfig(selectedNode.id, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 rounded-lg bg-paper border border-border text-xs text-foreground outline-none input-focus"
                      />
                    )}
                  </div>
                )
              })}
              {/* 无字段时显示 JSON 编辑 */}
              {(!NODE_TYPES[selectedNode.type]?.fields || NODE_TYPES[selectedNode.type]?.fields!.length === 0) && Object.keys(selectedNode.config || {}).length > 0 && (
                <div>
                  <label className="text-[10px] text-muted-light uppercase tracking-wider block mb-1.5">配置 (JSON)</label>
                  <textarea
                    value={JSON.stringify(selectedNode.config, null, 2)}
                    onChange={e => { try { const parsed = JSON.parse(e.target.value); setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, config: parsed } : n)); setSelectedNode(prev => prev ? { ...prev, config: parsed } : null) } catch {} }}
                    className="w-full px-3 py-2 rounded-lg bg-paper border border-border text-xs text-foreground outline-none input-focus resize-none font-mono"
                    rows={4}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 右侧：执行历史面板 ── */}
        {showExecutions && activeWfId && !showConfig && (
          <div className="w-64 shrink-0 bg-card border-l border-border flex flex-col">
            <div className="p-3 border-b border-border-light flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">执行历史</span>
              <button
                onClick={() => setShowExecutions(false)}
                className="p-1 rounded-lg hover:bg-accent text-muted-light hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {executions.map((ex: any) => (
                <div key={ex.id} className="px-3 py-2.5 rounded-xl bg-paper border border-border-light text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-light">#{ex.id}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      ex.status === "completed" ? "bg-pass-light text-pass" :
                      ex.status === "running" ? "bg-warn-light text-warn" :
                      ex.status === "failed" ? "bg-fail-light text-fail" :
                      "bg-cream text-muted-light"
                    }`}>{ex.status}</span>
                  </div>
                  <div className="text-[10px] text-muted-light">
                    {ex.started_at ? new Date(ex.started_at).toLocaleString() : "-"}
                  </div>
                  {ex.error && <div className="text-[10px] text-fail truncate">{ex.error}</div>}
                </div>
              ))}
              {executions.length === 0 && (
                <div className="text-center py-8 text-muted-light text-xs">暂无执行记录</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 新建工作流弹窗 ── */}
      {showNewWf && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
          onClick={() => setShowNewWf(false)}
        >
          <div
            className="bg-card rounded-2xl w-96 p-6 border border-border shadow-elevated animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-foreground mb-4">新建工作流</h3>
            <input
              value={newWfName}
              onChange={e => setNewWfName(e.target.value)}
              placeholder="输入工作流名称..."
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl bg-paper border border-border text-sm text-foreground outline-none input-focus mb-4"
              onKeyDown={e => e.key === "Enter" && createWorkflow()}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowNewWf(false); setNewWfName("") }}
                className="px-4 py-2 rounded-xl text-xs text-muted-light hover:text-foreground hover:bg-accent transition-colors"
              >取消</button>
              <button
                onClick={createWorkflow}
                disabled={creating || !newWfName.trim()}
                className="px-4 py-2 rounded-xl text-xs font-medium gradient-amber text-white disabled:opacity-50 flex items-center gap-1.5 btn-click"
              >
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
