import type { UploadedFile } from "@/stores/pipelineStore"

export const SUPPORTED_FILE_TYPES = [
  "pdf", "txt", "csv", "md", "markdown", 
  "xls", "xlsx", "ppt", "pptx", "doc", "docx", 
  "xmind", "png", "jpeg", "jpg", "gif", "bmp",
  "json", "xml", "yaml", "yml", "rtf"
]

export const MAX_FILE_SIZE = 50 * 1024 * 1024

export const getFileExtension = (filename: string): string => {
  const parts = filename.split(".")
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ""
}

export const isSupportedFile = (filename: string, size?: number): boolean => {
  const ext = getFileExtension(filename)
  if (!SUPPORTED_FILE_TYPES.includes(ext)) {
    return false
  }
  if (size && size > MAX_FILE_SIZE) {
    return false
  }
  return true
}

export const getFileIcon = (filename: string): string => {
  const ext = getFileExtension(filename)
  const iconMap: Record<string, string> = {
    pdf: "FileText",
    txt: "FileText",
    csv: "Table",
    md: "FileText",
    markdown: "FileText",
    xls: "Table",
    xlsx: "Table",
    doc: "FileText",
    docx: "FileText",
    ppt: "Presentation",
    pptx: "Presentation",
    xmind: "GitBranch",
    png: "Image",
    jpeg: "Image",
    jpg: "Image",
    gif: "Image",
    json: "Code",
    xml: "Code",
    yaml: "Code",
    yml: "Code",
  }
  return iconMap[ext] || "File"
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const ext = getFileExtension(file.name)
    
    if (["png", "jpeg", "jpg", "gif", "bmp"].includes(ext)) {
      reader.onload = (e) => {
        resolve(`[图片文件: ${file.name}] 大小: ${formatFileSize(file.size)}，需要AI视觉分析`)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    } else if (["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "xmind"].includes(ext)) {
      reader.onload = (e) => {
        resolve(`[${ext.toUpperCase()}文件: ${file.name}] 大小: ${formatFileSize(file.size)}，需要AI解析`)
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    } else {
      reader.onload = (e) => {
        resolve(e.target?.result as string)
      }
      reader.onerror = reject
      reader.readAsText(file)
    }
  })
}

export const createUploadedFile = async (file: File): Promise<UploadedFile> => {
  const content = await readFileContent(file)
  return {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: file.name,
    type: getFileExtension(file.name),
    size: file.size,
    content,
    processed: false,
  }
}

export const mockAiProcessContent = (content: string, fileType: string): string => {
  const processingTemplates: Record<string, string> = {
    pdf: `📄 解析PDF文档\n\n提取到以下关键信息：\n- 文档标题已识别\n- 共解析3个主要章节\n- 提取到15个功能需求点`,
    doc: `📝 解析Word文档\n\n文档结构分析完成：\n- 标题层级清晰\n- 共识别8个功能模块\n- 提取到需求描述20条`,
    docx: `📝 解析Word文档\n\n文档结构分析完成：\n- 标题层级清晰\n- 共识别8个功能模块\n- 提取到需求描述20条`,
    xls: `📊 解析Excel表格\n\n数据统计分析：\n- 共150行数据\n- 识别12个数据列\n- 提取到关键业务指标8项`,
    xlsx: `📊 解析Excel表格\n\n数据统计分析：\n- 共150行数据\n- 识别12个数据列\n- 提取到关键业务指标8项`,
    ppt: `📽️ 解析PPT演示文稿\n\n内容概要：\n- 共25页幻灯片\n- 识别核心要点30条\n- 提取决策信息5项`,
    pptx: `📽️ 解析PPT演示文稿\n\n内容概要：\n- 共25页幻灯片\n- 识别核心要点30条\n- 提取决策信息5项`,
    csv: `📋 解析CSV数据\n\n数据分析结果：\n- 共200条记录\n- 识别10个字段\n- 数据完整性：95%`,
    md: `📖 解析Markdown文档\n\n文档结构：\n- 识别6个章节\n- 提取代码片段12处\n- 结构化程度高`,
    txt: `📄 解析文本文件\n\n内容概要：\n- 共识别核心主题3个\n- 提取关键信息25条\n- 文档长度适中`,
    image: `🖼️ 解析图片文件\n\n视觉分析结果：\n- 识别图像中的文字区域\n- 提取UI元素信息\n- 分析图表数据趋势`,
  }
  
  return processingTemplates[fileType] || `📄 解析${fileType.toUpperCase()}文件\n\nAI分析完成：\n- 文件结构已识别\n- 关键信息已提取\n- 可供后续步骤使用`
}
