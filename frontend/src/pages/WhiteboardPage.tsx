import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Stage, Layer, Group, Rect, Ellipse, Line, Arrow, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import {
  ArrowLeft, Clock, Eraser, Hand, Info, Maximize2, Minus, MousePointer2,
  PenLine, Plus, Redo2, Save, ScanEye, Trash2, Undo2,
  RectangleHorizontal, TriangleRight, Circle, PenTool, PencilLine, ArrowDownRight, CaseUpper,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useListWhiteboardsQuery,
  useCreateWhiteboardMutation,
  useUpdateWhiteboardMutation,
  useDeleteWhiteboardMutation,
  type Whiteboard,
  type WbShape,
} from '@/features/whiteboards/whiteboardsApi'
import { useGetCustomersQuery, useGetProjectsQuery } from '@/features/customers/customerApi'
import { useGetContractsQuery } from '@/features/contracts/contractApi'
import { Switch } from '@/components/ui/switch'

type DrawTool = 'select' | 'pan' | 'rect' | 'triangle' | 'circle' | 'freehand' | 'line' | 'arrow' | 'text'

interface StyleState {
  fill: string
  stroke: string
  strokeWidth: number
  fontColor: string
  fontSize: number
}

const DEFAULT_STYLE: StyleState = {
  fill: '#dbeafe',
  stroke: '#2563eb',
  strokeWidth: 2,
  fontColor: '#0f172a',
  fontSize: 18,
}

const MIN_SIZE = 12
const DEFAULT_TEXT_BOX = { width: 220, height: 72 }
const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 1.15

const TOOL_GROUPS: { id: DrawTool; label: string; title: string, icon: React.ReactNode }[] = [
  { id: 'rect', label: 'Rect', title: 'Rectangle', icon: <RectangleHorizontal size={16} /> },
  { id: 'triangle', label: 'Triang', title: 'Triangle' ,icon: <TriangleRight size={16} />},
  { id: 'circle', label: 'Circle', title: 'Circle', icon: <Circle size={16} /> },
  { id: 'freehand', label: 'Handdraw', title: 'Freehand drawing', icon: <PenTool size={16} /> },
  { id: 'line', label: 'Line', title: 'Straight line', icon: <PencilLine size={16} /> },
  { id: 'arrow', label: 'Arrow', title: 'Arrow', icon: <ArrowDownRight size={16} /> },
  { id: 'text', label: 'Text', title: 'Text box', icon: <CaseUpper size={20} /> },
]

let shapeSequence = 1
function newShapeId() {
  return `wb-shape-${shapeSequence++}`
}

function fmtTs(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function cloneShapes(shapes: WbShape[]) {
  return shapes.map((shape) => ({
    ...shape,
    points: shape.points ? [...shape.points] : undefined,
  }))
}

function getBounds(startX: number, startY: number, endX: number, endY: number) {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  }
}

function normalizeShape(shape: WbShape): WbShape {
  if (shape.type === 'line' || shape.type === 'arrow') {
    const width = shape.x2 != null ? shape.x2 - shape.x : shape.width
    const height = shape.y2 != null ? shape.y2 - shape.y : shape.height
    return {
      ...shape,
      width,
      height,
      x2: shape.x + width,
      y2: shape.y + height,
      fill: shape.type === 'arrow' ? (shape.fill || shape.stroke || DEFAULT_STYLE.stroke) : 'transparent',
      stroke: shape.stroke || DEFAULT_STYLE.stroke,
      strokeWidth: shape.strokeWidth ?? DEFAULT_STYLE.strokeWidth,
      rotation: shape.rotation ?? 0,
      opacity: shape.opacity ?? 1,
      fontSize: shape.fontSize ?? DEFAULT_STYLE.fontSize,
      fontColor: shape.fontColor || DEFAULT_STYLE.fontColor,
    }
  }

  if (shape.type === 'freehand') {
    const points = shape.points ? [...shape.points] : [0, 0]
    if (shape.x === 0 && shape.y === 0 && points.length >= 4) {
      const xs = points.filter((_, index) => index % 2 === 0)
      const ys = points.filter((_, index) => index % 2 === 1)
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      return {
        ...shape,
        x: minX,
        y: minY,
        points: points.map((value, index) => index % 2 === 0 ? value - minX : value - minY),
        fill: 'transparent',
        stroke: shape.stroke || DEFAULT_STYLE.stroke,
        strokeWidth: shape.strokeWidth ?? DEFAULT_STYLE.strokeWidth,
        rotation: shape.rotation ?? 0,
        opacity: shape.opacity ?? 1,
      }
    }

    return {
      ...shape,
      points,
      fill: 'transparent',
      stroke: shape.stroke || DEFAULT_STYLE.stroke,
      strokeWidth: shape.strokeWidth ?? DEFAULT_STYLE.strokeWidth,
      rotation: shape.rotation ?? 0,
      opacity: shape.opacity ?? 1,
    }
  }

  return {
    ...shape,
    fill:
      shape.type === 'text'
        ? 'transparent'
        : shape.type === 'note'
          ? (shape.fill || '#fef08a')
          : (shape.fill || DEFAULT_STYLE.fill),
    stroke: shape.type === 'text' ? 'transparent' : (shape.stroke || DEFAULT_STYLE.stroke),
    strokeWidth: shape.type === 'text' ? 0 : (shape.strokeWidth ?? DEFAULT_STYLE.strokeWidth),
    rotation: shape.rotation ?? 0,
    opacity: shape.opacity ?? 1,
    fontSize: shape.fontSize ?? DEFAULT_STYLE.fontSize,
    fontColor: shape.fontColor || DEFAULT_STYLE.fontColor,
  }
}

function normalizeShapes(shapes: WbShape[]) {
  return cloneShapes(shapes).map(normalizeShape)
}

function createShape(tool: Exclude<DrawTool, 'select' | 'pan' | 'freehand'>, startX: number, startY: number, endX: number, endY: number, style: StyleState): WbShape {
  if (tool === 'line' || tool === 'arrow') {
    const width = endX - startX
    const height = endY - startY
    return {
      id: newShapeId(),
      type: tool,
      x: startX,
      y: startY,
      x2: endX,
      y2: endY,
      width,
      height,
      fill: tool === 'arrow' ? style.stroke : 'transparent',
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      opacity: 1,
      rotation: 0,
      fontSize: style.fontSize,
      fontColor: style.fontColor,
    }
  }

  const bounds = getBounds(startX, startY, endX, endY)
  const width = bounds.width || DEFAULT_TEXT_BOX.width
  const height = bounds.height || DEFAULT_TEXT_BOX.height

  if (tool === 'text') {
    return {
      id: newShapeId(),
      type: 'text',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width > MIN_SIZE ? bounds.width : DEFAULT_TEXT_BOX.width,
      height: bounds.height > MIN_SIZE ? bounds.height : DEFAULT_TEXT_BOX.height,
      fill: 'transparent',
      stroke: 'transparent',
      strokeWidth: 0,
      opacity: 1,
      rotation: 0,
      text: 'Double-click to edit',
      fontSize: style.fontSize,
      fontColor: style.fontColor,
    }
  }

  const size = tool === 'circle' ? Math.max(width, height) : undefined
  return {
    id: newShapeId(),
    type: tool,
    x: bounds.x,
    y: bounds.y,
    width: size ?? width,
    height: size ?? height,
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    opacity: 1,
    rotation: 0,
    fontSize: style.fontSize,
    fontColor: style.fontColor,
  }
}

function createFreehandShape(x: number, y: number, style: StyleState): WbShape {
  return {
    id: newShapeId(),
    type: 'freehand',
    x,
    y,
    width: 0,
    height: 0,
    points: [0, 0],
    fill: 'transparent',
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    opacity: 1,
    rotation: 0,
    fontSize: style.fontSize,
    fontColor: style.fontColor,
  }
}

function appendFreehandPoint(shape: WbShape, x: number, y: number): WbShape {
  if (shape.type !== 'freehand') return shape
  return {
    ...shape,
    points: [...(shape.points ?? []), x - shape.x, y - shape.y],
  }
}

function getSelectionStyle(shape: WbShape, isSelected: boolean) {
  if (!isSelected) return {}
  return {
    shadowColor: '#2563eb',
    shadowBlur: 8,
    shadowOpacity: 0.18,
  }
}

function getTransformedLineEndpoints(node: Konva.Group, shape: WbShape) {
  // getTransform() is relative to the parent (Layer = canvas space).
  // getAbsoluteTransform() includes Stage scale/offset = screen space — wrong at zoom != 100%.
  const transform = node.getTransform()
  const start = transform.point({ x: 0, y: 0 })
  const end = transform.point({ x: shape.width, y: shape.height })

  return {
    x: start.x,
    y: start.y,
    width: end.x - start.x,
    height: end.y - start.y,
    x2: end.x,
    y2: end.y,
  }
}

function ToolButton({
  active,
  label,
  onClick,
  title,
  icon,
}: {
  active: boolean
  label: string
  onClick: () => void
  title: string
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background hover:bg-muted'
      }`}
    >
      {icon}
      {/* <span>{label}</span> */}
    </button>
  )
}

function StyleControls({
  style,
  onChange,
}: {
  style: StyleState
  onChange: (next: StyleState) => void
}) {
  function setValue<K extends keyof StyleState>(key: K, value: StyleState[K]) {
    onChange({ ...style, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Stroke width</span>
        <input
          type="range"
          min={1}
          max={16}
          value={style.strokeWidth}
          onChange={(e) => setValue('strokeWidth', Number(e.target.value))}
          className="w-24"
        />
        <span className="w-6 text-right tabular-nums">{style.strokeWidth}</span>
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Stroke color</span>
        <input
          type="color"
          value={style.stroke}
          onChange={(e) => setValue('stroke', e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border bg-transparent p-1"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Fill color</span>
        <input
          type="color"
          value={style.fill}
          onChange={(e) => setValue('fill', e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border bg-transparent p-1"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Font color</span>
        <input
          type="color"
          value={style.fontColor}
          onChange={(e) => setValue('fontColor', e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border bg-transparent p-1"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Font size</span>
        <input
          type="number"
          min={8}
          max={120}
          value={style.fontSize}
          onChange={(e) => setValue('fontSize', Number(e.target.value))}
          className="w-20 rounded border bg-background px-2 py-1"
        />
      </label>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
}

function WhiteboardShapeNode({
  shape,
  isSelected,
  isInteractive,
  onSelectShape,
  onMove,
  onTransform,
  onEditText,
  registerNode,
}: {
  shape: WbShape
  isSelected: boolean
  isInteractive: boolean
  onSelectShape: (id: string, addToSelection: boolean) => void
  onMove: (id: string, nextX: number, nextY: number) => void
  onTransform: (id: string, next: Partial<WbShape>) => void
  onEditText: (shape: WbShape) => void
  registerNode: (id: string, node: Konva.Node | null) => void
}) {
  const shapeRef = useCallback((node: Konva.Node | null) => registerNode(shape.id, node), [registerNode, shape.id])

  const groupProps = {
    ref: shapeRef,
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation ?? 0,
    opacity: shape.opacity ?? 1,
    draggable: isInteractive,
    onMouseDown: (event: Konva.KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true
      const addToSelection = event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey
      onSelectShape(shape.id, addToSelection)
    },
    onTap: (event: Konva.KonvaEventObject<Event>) => {
      event.cancelBubble = true
      onSelectShape(shape.id, false)
    },
    onDblClick: () => onEditText(shape),
    onDblTap: () => onEditText(shape),
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      const nextX = event.target.x()
      const nextY = event.target.y()
      if (shape.type === 'line' || shape.type === 'arrow') {
        const deltaX = nextX - shape.x
        const deltaY = nextY - shape.y
        onTransform(shape.id, {
          x: nextX,
          y: nextY,
          x2: (shape.x2 ?? (shape.x + shape.width)) + deltaX,
          y2: (shape.y2 ?? (shape.y + shape.height)) + deltaY,
          width: shape.width,
          height: shape.height,
        })
        return
      }
      onMove(shape.id, nextX, nextY)
    },
  }

  const visualStyle = getSelectionStyle(shape, isSelected)

  if (shape.type === 'rect' || shape.type === 'note') {
    return (
      <Group
        {...groupProps}
        onTransformEnd={(event) => {
          const node = event.target as Konva.Group
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onTransform(shape.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(MIN_SIZE, shape.width * scaleX),
            height: Math.max(MIN_SIZE, shape.height * scaleY),
            rotation: node.rotation(),
          })
        }}
      >
        <Rect
          width={shape.width}
          height={shape.height}
          cornerRadius={shape.type === 'note' ? 12 : 10}
          fill={shape.type === 'note' ? '#fef08a' : shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          {...visualStyle}
        />
        {shape.text ? (
          <Text
            x={10}
            y={10}
            width={Math.max(20, shape.width - 20)}
            height={Math.max(20, shape.height - 20)}
            text={shape.text}
            fontSize={shape.fontSize || DEFAULT_STYLE.fontSize}
            fill={shape.fontColor || DEFAULT_STYLE.fontColor}
            wrap="word"
            listening={false}
          />
        ) : null}
      </Group>
    )
  }

  if (shape.type === 'triangle') {
    return (
      <Group
        {...groupProps}
        onTransformEnd={(event) => {
          const node = event.target as Konva.Group
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onTransform(shape.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(MIN_SIZE, shape.width * scaleX),
            height: Math.max(MIN_SIZE, shape.height * scaleY),
            rotation: node.rotation(),
          })
        }}
      >
        <Line
          points={[shape.width / 2, 0, shape.width, shape.height, 0, shape.height]}
          closed
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          {...visualStyle}
        />
      </Group>
    )
  }

  if (shape.type === 'circle') {
    return (
      <Group
        {...groupProps}
        onTransformEnd={(event) => {
          const node = event.target as Konva.Group
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onTransform(shape.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(MIN_SIZE, shape.width * scaleX),
            height: Math.max(MIN_SIZE, shape.height * scaleY),
            rotation: node.rotation(),
          })
        }}
      >
        <Ellipse
          x={shape.width / 2}
          y={shape.height / 2}
          radiusX={shape.width / 2}
          radiusY={shape.height / 2}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          {...visualStyle}
        />
      </Group>
    )
  }

  if (shape.type === 'line') {
    return (
      <Group
        {...groupProps}
        onTransformEnd={(event) => {
          const node = event.target as Konva.Group
          const next = getTransformedLineEndpoints(node, shape)
          node.scaleX(1)
          node.scaleY(1)
          node.rotation(0)
          onTransform(shape.id, {
            ...next,
            rotation: 0,
          })
        }}
      >
        <Line
          points={[0, 0, shape.width, shape.height]}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          lineCap="round"
          lineJoin="round"
          {...visualStyle}
        />
      </Group>
    )
  }

  if (shape.type === 'arrow') {
    return (
      <Group
        {...groupProps}
        onTransformEnd={(event) => {
          const node = event.target as Konva.Group
          const next = getTransformedLineEndpoints(node, shape)
          node.scaleX(1)
          node.scaleY(1)
          node.rotation(0)
          onTransform(shape.id, {
            ...next,
            rotation: 0,
          })
        }}
      >
        <Arrow
          points={[0, 0, shape.width, shape.height]}
          stroke={shape.stroke}
          fill={shape.stroke}
          strokeWidth={shape.strokeWidth}
          pointerWidth={12}
          pointerLength={12}
          lineCap="round"
          lineJoin="round"
          {...visualStyle}
        />
      </Group>
    )
  }

  if (shape.type === 'freehand') {
    return (
      <Group
        {...groupProps}
        onTransformEnd={(event) => {
          const node = event.target as Konva.Group
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onTransform(shape.id, {
            x: node.x(),
            y: node.y(),
            points: (shape.points ?? []).map((value, index) => index % 2 === 0 ? value * scaleX : value * scaleY),
            rotation: node.rotation(),
          })
        }}
      >
        <Line
          points={shape.points ?? [0, 0]}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          tension={0.15}
          lineCap="round"
          lineJoin="round"
          {...visualStyle}
        />
      </Group>
    )
  }

  if (shape.type === 'text') {
    return (
      <Group
        {...groupProps}
        onTransformEnd={(event) => {
          const node = event.target as Konva.Group
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onTransform(shape.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(60, shape.width * scaleX),
            height: Math.max(40, shape.height * scaleY),
            rotation: node.rotation(),
          })
        }}
      >
        <Rect width={shape.width} height={shape.height} fill="transparent" stroke={isSelected ? '#93c5fd' : 'transparent'} dash={isSelected ? [6, 4] : []} />
        <Text
          width={shape.width}
          height={shape.height}
          text={shape.text || ''}
          fontSize={shape.fontSize || DEFAULT_STYLE.fontSize}
          fill={shape.fontColor || DEFAULT_STYLE.fontColor}
          wrap="word"
          verticalAlign="middle"
          {...visualStyle}
        />
      </Group>
    )
  }

  return null
}

interface CanvasProps {
  shapes: WbShape[]
  selectedIds: string[]
  tool: DrawTool
  style: StyleState
  onSelectIds: (ids: string[]) => void
  onShapesChange: (next: WbShape[], pushHistory: boolean) => void
  zoom: number
  onZoomChange: (zoom: number) => void
  onStageMount?: (stage: Konva.Stage) => void
}

function WhiteboardCanvas({
  shapes,
  selectedIds,
  tool,
  style,
  onSelectIds,
  onShapesChange,
  zoom,
  onZoomChange,
  onStageMount,
}: CanvasProps) {
  const stageRef = useRef<Konva.Stage>(null)

  // Expose stage to parent for preview capture
  useEffect(() => {
    if (stageRef.current && onStageMount) onStageMount(stageRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const containerRef = useRef<HTMLDivElement>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const nodeMapRef = useRef<Map<string, Konva.Node>>(new Map())
  const [stageSize, setStageSize] = useState({ width: 960, height: 640 })
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 })
  const [draftShape, setDraftShape] = useState<WbShape | null>(null)
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)
  const isDrawingRef = useRef(false)
  // Rubber-band selection
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number; visible: boolean }>({ x: 0, y: 0, w: 0, h: 0, visible: false })
  const selStartRef = useRef<{ x: number; y: number } | null>(null)
  const isRubberRef = useRef(false)
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pinchRef = useRef<{ distance: number; center: { x: number; y: number } } | null>(null)
  // Pan tool
  const panStartRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  // Group drag — drag all selected shapes by clicking inside transformer bbox on empty space
  const groupDragRef = useRef<{
    startPoint: { x: number; y: number }
    snapshots: Map<string, { x: number; y: number; x2?: number; y2?: number }>
  } | null>(null)

  const isSelectMode = tool === 'select'
  const isPanMode = tool === 'pan'

  useEffect(() => {
    setViewport((current) => ({ ...current, scale: zoom }))
  }, [zoom])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const resize = () => {
      setStageSize({
        width: Math.max(320, element.clientWidth),
        height: Math.max(420, element.clientHeight),
      })
    }

    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()
    return () => observer.disconnect()
  }, [])

  // Update transformer nodes whenever selectedIds change
  useEffect(() => {
    if (!transformerRef.current) return
    if (isSelectMode && selectedIds.length > 0) {
      const nodes = selectedIds
        .map((id) => nodeMapRef.current.get(id))
        .filter((n): n is Konva.Node => !!n)
      transformerRef.current.nodes(nodes)
    } else {
      transformerRef.current.nodes([])
    }
    transformerRef.current.getLayer()?.batchDraw()
  }, [selectedIds, isSelectMode, shapes])

  useEffect(() => {
    if (!editingShapeId) return
    window.setTimeout(() => textareaRef.current?.focus(), 0)
  }, [editingShapeId])

  const registerNode = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodeMapRef.current.set(id, node)
    else nodeMapRef.current.delete(id)
  }, [])

  function getPointerPosition() {
    const stage = stageRef.current
    if (!stage) return null
    const pointer = stage.getPointerPosition()
    if (!pointer) return null
    return {
      x: (pointer.x - viewport.x) / viewport.scale,
      y: (pointer.y - viewport.y) / viewport.scale,
    }
  }

  function clampZoom(nextZoom: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
  }

  function setZoomAtPoint(nextZoom: number, anchor: { x: number; y: number }) {
    const clamped = clampZoom(nextZoom)
    setViewport((current) => {
      const pointTo = {
        x: (anchor.x - current.x) / current.scale,
        y: (anchor.y - current.y) / current.scale,
      }
      return {
        x: anchor.x - pointTo.x * clamped,
        y: anchor.y - pointTo.y * clamped,
        scale: clamped,
      }
    })
    onZoomChange(clamped)
  }

  function zoomBy(direction: 'in' | 'out') {
    const anchor = {
      x: stageSize.width / 2,
      y: stageSize.height / 2,
    }
    const nextZoom = direction === 'in' ? viewport.scale * ZOOM_STEP : viewport.scale / ZOOM_STEP
    setZoomAtPoint(nextZoom, anchor)
  }

  function resetZoom() {
    setViewport({ x: 0, y: 0, scale: 1 })
    onZoomChange(1)
  }

  function fitToContent() {
    if (shapes.length === 0) { resetZoom(); return }

    // Compute bounding box of all shapes in canvas coordinates
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const node of nodeMapRef.current.values()) {
      const box = node.getClientRect({ relativeTo: node.getLayer() ?? undefined })
      if (box.width === 0 && box.height === 0) continue
      minX = Math.min(minX, box.x)
      minY = Math.min(minY, box.y)
      maxX = Math.max(maxX, box.x + box.width)
      maxY = Math.max(maxY, box.y + box.height)
    }
    if (!isFinite(minX)) { resetZoom(); return }

    const PADDING = 48 // px of stage padding around content
    const contentW = maxX - minX
    const contentH = maxY - minY
    const scaleX = (stageSize.width  - PADDING * 2) / contentW
    const scaleY = (stageSize.height - PADDING * 2) / contentH
    const scale  = clampZoom(Math.min(scaleX, scaleY))

    // Center the content in the stage
    const newX = (stageSize.width  - contentW * scale) / 2 - minX * scale
    const newY = (stageSize.height - contentH * scale) / 2 - minY * scale

    setViewport({ x: newX, y: newY, scale })
    onZoomChange(scale)
  }

  function commitTextEdit() {
    if (!editingShapeId) return
    const next = shapes.map((shape) => (
      shape.id === editingShapeId
        ? { ...shape, text: editingText }
        : shape
    ))
    onShapesChange(next, true)
    setEditingShapeId(null)
    setEditingText('')
  }

  function startTextEdit(shape: WbShape) {
    if (shape.type !== 'text' && shape.type !== 'note' && !shape.text) return
    setEditingShapeId(shape.id)
    setEditingText(shape.text ?? '')
  }

  function updateShape(id: string, patch: Partial<WbShape>, pushHistory: boolean) {
    const next = shapes.map((shape) => (
      shape.id === id
        ? normalizeShape({ ...shape, ...patch })
        : shape
    ))
    onShapesChange(next, pushHistory)
  }

  function handlePointerDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const touchEvent = event.evt as TouchEvent
    if (touchEvent.touches && touchEvent.touches.length > 1) {
      // Cancel any ongoing pan or group drag when a second finger is added
      if (panStartRef.current) { panStartRef.current = null; setIsPanning(false) }
      if (groupDragRef.current) { groupDragRef.current = null }
      isDrawingRef.current = false
      drawStartRef.current = null
      setDraftShape(null)
      return
    }

    // Pan tool — record the screen-space start point (not canvas space)
    if (isPanMode) {
      const pointer = stageRef.current?.getPointerPosition()
      if (pointer) {
        panStartRef.current = { x: pointer.x, y: pointer.y, vx: viewport.x, vy: viewport.y }
        setIsPanning(true)
      }
      return
    }

    const point = getPointerPosition()
    if (!point) return

    if (isSelectMode) {
      // Start rubber-band only when clicking on the empty stage background
      if (event.target === event.target.getStage()) {
        // If a transformer is shown and click is inside its bbox, start a group drag instead of deselecting
        if (selectedIds.length > 0 && transformerRef.current && transformerRef.current.nodes().length > 0) {
          const box = transformerRef.current.getClientRect()
          const stagePos = stageRef.current?.getPointerPosition()
          if (stagePos &&
              stagePos.x >= box.x && stagePos.x <= box.x + box.width &&
              stagePos.y >= box.y && stagePos.y <= box.y + box.height) {
            // Snapshot current positions of all selected shapes
            const snapshots = new Map<string, { x: number; y: number; x2?: number; y2?: number }>()
            for (const id of selectedIds) {
              const shape = shapes.find((s) => s.id === id)
              if (shape) snapshots.set(id, { x: shape.x, y: shape.y, x2: shape.x2, y2: shape.y2 })
            }
            groupDragRef.current = { startPoint: point, snapshots }
            return
          }
        }
        onSelectIds([])
        selStartRef.current = point
        isRubberRef.current = false
        setSelRect({ x: point.x, y: point.y, w: 0, h: 0, visible: false })
      }
      return
    }

    isDrawingRef.current = true
    drawStartRef.current = point

    if (tool === 'freehand') {
      setDraftShape(createFreehandShape(point.x, point.y, style))
      return
    }

    setDraftShape(createShape(tool, point.x, point.y, point.x, point.y, style))
  }

  function handlePointerMove() {
    // Pan mode — translate viewport using screen-space delta
    if (isPanMode && panStartRef.current) {
      const pointer = stageRef.current?.getPointerPosition()
      if (pointer) {
        setViewport((v) => ({
          ...v,
          x: panStartRef.current!.vx + pointer.x - panStartRef.current!.x,
          y: panStartRef.current!.vy + pointer.y - panStartRef.current!.y,
        }))
      }
      return
    }

    const point = getPointerPosition()
    if (!point) return

    // Group drag — move all selected shapes together
    if (isSelectMode && groupDragRef.current) {
      const dx = point.x - groupDragRef.current.startPoint.x
      const dy = point.y - groupDragRef.current.startPoint.y
      const next = shapes.map((shape) => {
        const snap = groupDragRef.current!.snapshots.get(shape.id)
        if (!snap) return shape
        const patch: Partial<WbShape> = { x: snap.x + dx, y: snap.y + dy }
        if (snap.x2 !== undefined) patch.x2 = snap.x2 + dx
        if (snap.y2 !== undefined) patch.y2 = snap.y2 + dy
        return normalizeShape({ ...shape, ...patch })
      })
      onShapesChange(next, false) // don't push history on every mousemove
      return
    }

    // Rubber-band in select mode
    if (isSelectMode && selStartRef.current) {
      const dx = point.x - selStartRef.current.x
      const dy = point.y - selStartRef.current.y
      if (!isRubberRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        isRubberRef.current = true
      }
      if (isRubberRef.current) {
        setSelRect({
          x: Math.min(selStartRef.current.x, point.x),
          y: Math.min(selStartRef.current.y, point.y),
          w: Math.abs(dx),
          h: Math.abs(dy),
          visible: true,
        })
      }
      return
    }

    if (!isDrawingRef.current || !drawStartRef.current) return

    setDraftShape((current) => {
      if (!current) return current
      if (current.type === 'freehand') {
        return appendFreehandPoint(current, point.x, point.y)
      }

      return createShape(current.type as Exclude<DrawTool, 'select' | 'pan' | 'freehand'>, drawStartRef.current!.x, drawStartRef.current!.y, point.x, point.y, style)
    })
  }

  function handlePointerUp() {
    // Commit group drag to history
    if (isSelectMode && groupDragRef.current) {
      groupDragRef.current = null
      // Push current shapes state as a history entry
      onShapesChange(shapes, true)
      return
    }

    // End pan
    if (isPanMode && panStartRef.current) {
      panStartRef.current = null
      setIsPanning(false)
      return
    }

    // Finalize rubber-band selection
    if (isSelectMode && selStartRef.current) {
      if (isRubberRef.current && selRect.visible) {
        // Convert selection rect (canvas coords) to stage screen coords for intersection check
        const selScreenBox = {
          x: selRect.x * viewport.scale + viewport.x,
          y: selRect.y * viewport.scale + viewport.y,
          width: selRect.w * viewport.scale,
          height: selRect.h * viewport.scale,
        }
        const intersected = shapes
          .filter((shape) => {
            const node = nodeMapRef.current.get(shape.id)
            if (!node) return false
            const box = node.getClientRect()
            return (
              box.x < selScreenBox.x + selScreenBox.width &&
              box.x + box.width > selScreenBox.x &&
              box.y < selScreenBox.y + selScreenBox.height &&
              box.y + box.height > selScreenBox.y
            )
          })
          .map((s) => s.id)
        if (intersected.length > 0) {
          onSelectIds(intersected)
        }
      }
      selStartRef.current = null
      isRubberRef.current = false
      setSelRect({ x: 0, y: 0, w: 0, h: 0, visible: false })
      return
    }

    if (!isDrawingRef.current) return

    isDrawingRef.current = false
    drawStartRef.current = null

    if (!draftShape) return

    let finalShape = draftShape
    if (draftShape.type === 'freehand') {
      const points = draftShape.points ?? []
      if (points.length < 4) {
        setDraftShape(null)
        return
      }
    } else if (draftShape.type === 'line' || draftShape.type === 'arrow') {
      if (Math.abs(draftShape.width) < MIN_SIZE && Math.abs(draftShape.height) < MIN_SIZE) {
        finalShape = {
          ...draftShape,
          width: 160,
          height: 0,
          x2: draftShape.x + 160,
          y2: draftShape.y,
        }
      }
    } else if (draftShape.type === 'text') {
      if (draftShape.width < MIN_SIZE && draftShape.height < MIN_SIZE) {
        finalShape = {
          ...draftShape,
          width: DEFAULT_TEXT_BOX.width,
          height: DEFAULT_TEXT_BOX.height,
        }
      }
    } else if (draftShape.width < MIN_SIZE && draftShape.height < MIN_SIZE) {
      setDraftShape(null)
      return
    }

    const next = [...shapes, normalizeShape(finalShape)]
    onShapesChange(next, true)
    onSelectIds([finalShape.id])
    setDraftShape(null)
  }

  function handleWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault()
    const pointer = stageRef.current?.getPointerPosition()
    if (!pointer) return
    const direction = event.evt.deltaY > 0 ? 'out' : 'in'
    const nextZoom = direction === 'in' ? viewport.scale * ZOOM_STEP : viewport.scale / ZOOM_STEP
    setZoomAtPoint(nextZoom, pointer)
  }

  function handleTouchMove(event: Konva.KonvaEventObject<TouchEvent>) {
    const stage = stageRef.current
    if (!stage) return

    const touches = event.evt.touches
    if (touches.length !== 2) {
      if (pinchRef.current) pinchRef.current = null
      handlePointerMove()
      return
    }

    event.evt.preventDefault()
    isDrawingRef.current = false
    drawStartRef.current = null
    setDraftShape(null)

    const containerRect = stage.container().getBoundingClientRect()
    const first = {
      x: touches[0].clientX - containerRect.left,
      y: touches[0].clientY - containerRect.top,
    }
    const second = {
      x: touches[1].clientX - containerRect.left,
      y: touches[1].clientY - containerRect.top,
    }
    const center = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    }
    const distance = Math.hypot(second.x - first.x, second.y - first.y)

    if (!pinchRef.current) {
      pinchRef.current = { distance, center }
      return
    }

    const scaleRatio = distance / pinchRef.current.distance
    const nextZoom = viewport.scale * scaleRatio
    setZoomAtPoint(nextZoom, center)
    pinchRef.current = { distance, center }
  }

  function handleTouchEnd(event: Konva.KonvaEventObject<TouchEvent>) {
    if (event.evt.touches.length < 2) {
      pinchRef.current = null
    }
    handlePointerUp()
  }

  const cursor = isPanMode ? (isPanning ? 'grabbing' : 'grab')
    : groupDragRef.current ? 'move'
    : isSelectMode ? 'default'
    : tool === 'text' ? 'text'
    : 'crosshair'
  const editingShape = editingShapeId ? shapes.find((shape) => shape.id === editingShapeId) ?? null : null
  const editingBox = editingShape ? {
    left: viewport.x + (editingShape.x + 8) * viewport.scale,
    top: viewport.y + (editingShape.y + 8) * viewport.scale,
    width: Math.max(80, editingShape.width - 16) * viewport.scale,
    minHeight: Math.max(40, editingShape.height - 16) * viewport.scale,
    fontSize: (editingShape.fontSize || DEFAULT_STYLE.fontSize) * viewport.scale,
    color: editingShape.fontColor || DEFAULT_STYLE.fontColor,
  } : null

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-white shadow-sm touch-none" style={{ cursor }}>
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        x={viewport.x}
        y={viewport.y}
      >
        {/* Background layer — always white regardless of app theme */}
        <Layer listening={false}>
          <Rect
            x={-viewport.x / viewport.scale}
            y={-viewport.y / viewport.scale}
            width={stageSize.width / viewport.scale}
            height={stageSize.height / viewport.scale}
            fill="#ffffff"
          />
        </Layer>
        {/* listening={false} in pan mode so pointer events pass through to Stage */}
        <Layer listening={!isPanMode}>
          {shapes.map((shape) => (
            <WhiteboardShapeNode
              key={shape.id}
              shape={shape}
              isSelected={selectedIds.includes(shape.id)}
              isInteractive={isSelectMode}
              onSelectShape={(id, addToSelection) => {
                if (!isSelectMode) return
                if (addToSelection) {
                  if (selectedIds.includes(id)) {
                    onSelectIds(selectedIds.filter((sid) => sid !== id))
                  } else {
                    onSelectIds([...selectedIds, id])
                  }
                } else {
                  onSelectIds([id])
                }
              }}
              onMove={(id, nextX, nextY) => updateShape(id, { x: nextX, y: nextY }, true)}
              onTransform={(id, patch) => updateShape(id, patch, true)}
              onEditText={startTextEdit}
              registerNode={registerNode}
            />
          ))}

          {draftShape ? (
            <WhiteboardShapeNode
              key={draftShape.id}
              shape={draftShape}
              isSelected={false}
              isInteractive={false}
              onSelectShape={() => {}}
              onMove={() => {}}
              onTransform={() => {}}
              onEditText={() => {}}
              registerNode={() => {}}
            />
          ) : null}

          {/* Rubber-band selection rectangle */}
          {selRect.visible ? (
            <Rect
              x={selRect.x}
              y={selRect.y}
              width={selRect.w}
              height={selRect.h}
              fill="rgba(59,130,246,0.08)"
              stroke="#3b82f6"
              strokeWidth={1 / viewport.scale}
              listening={false}
            />
          ) : null}

          {isSelectMode ? (
            <Transformer
              ref={transformerRef}
              rotateEnabled
              flipEnabled={false}
              padding={6}
              borderStroke="#3b82f6"
              anchorStroke="#1d4ed8"
              anchorFill="#ffffff"
              boundBoxFunc={(oldBox, newBox) => (
                Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8 ? oldBox : newBox
              )}
            />
          ) : null}
        </Layer>
      </Stage>

      <div className="absolute right-3 top-3 flex items-center gap-2 rounded-md border bg-white/95 p-2 shadow">
        <button
          type="button"
          onClick={() => zoomBy('out')}
          className="rounded border px-2 py-1 text-xs font-medium hover:bg-muted"
          title="Zoom out"
        >
          <Minus size={14} />
        </button>
        <span className="min-w-[4rem] text-center text-xs font-medium tabular-nums text-muted-foreground">
          {Math.round(viewport.scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoomBy('in')}
          className="rounded border px-2 py-1 text-xs font-medium hover:bg-muted"
          title="Zoom in"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className="rounded border px-2 py-1 text-xs font-medium hover:bg-muted"
          title="Reset zoom (100%)"
        >
          <Maximize2 size={14} />
        </button>
        <button
          type="button"
          onClick={fitToContent}
          className="rounded border px-2 py-1 text-xs font-medium hover:bg-muted"
          title="Zoom to fit all shapes"
        >
          <ScanEye size={14} />
        </button>
      </div>

      {editingShapeId && editingBox ? (
        <textarea
          ref={textareaRef}
          value={editingText}
          onChange={(event) => setEditingText(event.target.value)}
          onBlur={commitTextEdit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              commitTextEdit()
            }
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              commitTextEdit()
            }
          }}
          style={{
            position: 'absolute',
            left: editingBox.left,
            top: editingBox.top,
            width: editingBox.width,
            minHeight: editingBox.minHeight,
            fontSize: editingBox.fontSize,
            color: editingBox.color,
          }}
          className="resize-none rounded-md border border-primary/30 bg-white/95 p-2 text-sm leading-relaxed outline-none ring-2 ring-primary/10"
        />
      ) : null}

      {selectedIds.length > 0 && isSelectMode ? (
        <div className="absolute bottom-3 right-3 rounded-md bg-white/95 px-3 py-2 text-[11px] text-muted-foreground shadow">
          {selectedIds.length > 1 ? `${selectedIds.length} selected` : 'Select, move, resize, rotate.'}
        </div>
      ) : null}
    </div>
  )
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function DetailModal({
  board, onClose, onSave,
}: {
  board: Whiteboard
  onClose: () => void
  onSave: (data: { description: string; customer_id: string; contract_id: string; project_id: string }) => void
}) {
  const { data: customers = [] } = useGetCustomersQuery()
  const { data: contracts = [] } = useGetContractsQuery({})
  const { data: projects = [] } = useGetProjectsQuery({})

  const [description, setDescription] = useState(board.description ?? '')
  const [customerId, setCustomerId] = useState(board.customer_id ?? '')
  const [contractId, setContractId] = useState(board.contract_id ?? '')
  const [projectId, setProjectId] = useState(board.project_id ?? '')

  const filteredContracts = customerId
    ? contracts.filter((c) => c.customer_id === customerId)
    : contracts
  const filteredProjects = contractId
    ? projects.filter((p) => p.contract_id === contractId)
    : projects

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-xl border shadow-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold text-base flex items-center gap-2"><Info size={16} /> Board Details</h2>

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-muted-foreground font-medium mb-1 block">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground font-medium mb-1 block">Customer</span>
            <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setContractId(''); setProjectId('') }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">— None —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground font-medium mb-1 block">Contract</span>
            <select value={contractId} onChange={(e) => { setContractId(e.target.value); setProjectId('') }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">— None —</option>
              {filteredContracts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground font-medium mb-1 block">Project (optional)</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">— None —</option>
              {filteredProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md hover:bg-muted">Cancel</button>
          <button onClick={() => { onSave({ description, customer_id: customerId, contract_id: contractId, project_id: projectId }); onClose() }}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90">
            Save Details
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Board editor ──────────────────────────────────────────────────────────────

function BoardEditor({ board, onBack }: { board: Whiteboard; onBack: () => void }) {
  const [updateWhiteboard] = useUpdateWhiteboardMutation()
  const [name, setName] = useState(board.name)
  const [isEditingName, setIsEditingName] = useState(false)
  const [tool, setTool] = useState<DrawTool>('select')
  // activeTool tracks the last explicitly-clicked tool button (not reset by auto-switch to select)
  const [activeTool, setActiveTool] = useState<DrawTool>('select')
  const [style, setStyle] = useState<StyleState>(DEFAULT_STYLE)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [shapes, setShapes] = useState<WbShape[]>(() => normalizeShapes(board.shapes))
  const [savedAt, setSavedAt] = useState(board.updated_at)
  const [saving, setSaving] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [detailOpen, setDetailOpen] = useState(false)
  const [stayTool, setStayTool] = useState(false)
  const stageInstanceRef = useRef<Konva.Stage | null>(null)

  const historyRef = useRef<WbShape[][]>([normalizeShapes(board.shapes)])
  const historyIndexRef = useRef(0)

  const selectedShape = useMemo(
    () => (selectedIds.length === 1 ? (shapes.find((shape) => shape.id === selectedIds[0]) ?? null) : null),
    [selectedIds, shapes],
  )

  const pushHistory = useCallback((next: WbShape[]) => {
    const snapshot = normalizeShapes(next)
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1)
    nextHistory.push(cloneShapes(snapshot))
    historyRef.current = nextHistory
    historyIndexRef.current = nextHistory.length - 1
  }, [])

  const replaceShapes = useCallback((next: WbShape[], pushHistoryEntry: boolean) => {
    const normalized = normalizeShapes(next)
    setShapes(normalized)
    if (pushHistoryEntry) {
      pushHistory(normalized)
    }
  }, [pushHistory])

  useEffect(() => {
    const normalized = normalizeShapes(board.shapes)
    setName(board.name)
    setShapes(normalized)
    setSelectedIds([])
    setSavedAt(board.updated_at)
    setTool('select')
    setActiveTool('select')
    setZoom(1)
    historyRef.current = [cloneShapes(normalized)]
    historyIndexRef.current = 0
  }, [board.id, board.name, board.shapes, board.updated_at])

  useEffect(() => {
    if (!selectedShape) return
    setStyle({
      fill: selectedShape.type === 'text' ? DEFAULT_STYLE.fill : (selectedShape.fill || DEFAULT_STYLE.fill),
      stroke: selectedShape.stroke || DEFAULT_STYLE.stroke,
      strokeWidth: selectedShape.strokeWidth ?? DEFAULT_STYLE.strokeWidth,
      fontColor: selectedShape.fontColor || DEFAULT_STYLE.fontColor,
      fontSize: selectedShape.fontSize ?? DEFAULT_STYLE.fontSize,
    })
  }, [selectedShape])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const tagName = (document.activeElement as HTMLElement | null)?.tagName
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        if (historyIndexRef.current <= 0) return
        historyIndexRef.current -= 1
        setShapes(cloneShapes(historyRef.current[historyIndexRef.current]))
        setSelectedIds([])
        return
      }

      if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) {
        event.preventDefault()
        if (historyIndexRef.current >= historyRef.current.length - 1) return
        historyIndexRef.current += 1
        setShapes(cloneShapes(historyRef.current[historyIndexRef.current]))
        setSelectedIds([])
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIds.length > 0) {
        event.preventDefault()
        const next = shapes.filter((shape) => !selectedIds.includes(shape.id))
        replaceShapes(next, true)
        setSelectedIds([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [replaceShapes, selectedIds, shapes])

  function applyStyle(nextStyle: StyleState) {
    setStyle(nextStyle)
    if (!selectedShape) return

    const nextShapes = shapes.map((shape) => {
      if (shape.id !== selectedShape.id) return shape
      return normalizeShape({
        ...shape,
        fill:
          shape.type === 'text'
            ? 'transparent'
            : shape.type === 'arrow'
              ? nextStyle.stroke
              : shape.type === 'note'
                ? shape.fill
                : nextStyle.fill,
        stroke: shape.type === 'text' ? 'transparent' : nextStyle.stroke,
        strokeWidth: shape.type === 'text' ? 0 : nextStyle.strokeWidth,
        fontColor: nextStyle.fontColor,
        fontSize: nextStyle.fontSize,
      })
    })

    replaceShapes(nextShapes, true)
  }

  function deleteSelected() {
    if (selectedIds.length === 0) return
    const next = shapes.filter((shape) => !selectedIds.includes(shape.id))
    replaceShapes(next, true)
    setSelectedIds([])
  }

  function clearAll() {
    replaceShapes([], true)
    setSelectedIds([])
  }

  async function handleSave(extraAttrs?: { description?: string; customer_id?: string; contract_id?: string; project_id?: string }) {
    setSaving(true)
    try {
      // Capture a small JPEG thumbnail of the canvas
      let preview: string | undefined
      if (stageInstanceRef.current) {
        try {
          preview = stageInstanceRef.current.toDataURL({ mimeType: 'image/jpeg', quality: 0.6, pixelRatio: 0.25 })
        } catch { /* ignore preview errors */ }
      }
      const result = await updateWhiteboard({
        id: board.id,
        name,
        shapes,
        preview,
        ...extraAttrs,
      }).unwrap()
      setSavedAt(result.updated_at)
      toast.success('Board saved.')
    } catch {
      toast.error('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDetailSave(data: { description: string; customer_id: string; contract_id: string; project_id: string }) {
    try {
      await updateWhiteboard({
        id: board.id,
        description: data.description,
        customer_id: data.customer_id || undefined,
        contract_id: data.contract_id || undefined,
        project_id: data.project_id || undefined,
      }).unwrap()
      toast.success('Details saved.')
    } catch {
      toast.error('Failed to save details.')
    }
  }

  const canUndo = historyIndexRef.current > 0
  const canRedo = historyIndexRef.current < historyRef.current.length - 1

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {detailOpen && (
        <DetailModal
          board={board}
          onClose={() => setDetailOpen(false)}
          onSave={handleDetailSave}
        />
      )}

      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Back to gallery */}
            <button type="button" onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium bg-primary text-primary-foreground hover:opacity-90"
              title="Back to gallery">
              <ArrowLeft size={14} /> Boards
            </button>

            <SectionLabel>Board</SectionLabel>
            {isEditingName ? (
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === 'Escape') {
                    setIsEditingName(false)
                  }
                }}
                className="w-48 rounded-md border bg-background px-3 py-2 text-sm font-semibold"
              />
            ) : (
              <button type="button" onClick={() => setIsEditingName(true)} className="rounded-md px-1 text-sm font-semibold hover:underline">
                {name}
              </button>
            )}

            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <button type="button" onClick={() => setDetailOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 font-medium text-foreground hover:bg-muted"
                title="Edit board details">
                <Info size={14} /> Details
              </button>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                {saving ? 'Saving…' : `Saved ${fmtTs(savedAt)}`}
              </span>
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                <Save size={14} />
                <span>Save</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-5 border-t pt-3">
            <div className="flex min-w-[220px] flex-1 flex-col gap-2">
              <SectionLabel>Object</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {TOOL_GROUPS.map((item) => (
                  <ToolButton
                    key={item.id}
                    active={stayTool ? tool === item.id : activeTool === item.id}
                    label={item.label}
                    title={item.title}
                    icon={item.icon}
                    onClick={() => { setTool(item.id); setActiveTool(item.id) }}
                  />
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <Switch checked={stayTool} onCheckedChange={setStayTool} />
                <span>{stayTool ? 'Stay on tool' : 'Auto-select after draw'}</span>
              </label>
            </div>

            <div className="flex min-w-[260px] flex-1 flex-col gap-2">
              <SectionLabel>Setting</SectionLabel>
              <StyleControls style={style} onChange={applyStyle} />
            </div>

            <div className="flex min-w-[220px] flex-1 flex-col gap-2">
              <SectionLabel>Actions</SectionLabel>
              <div className="flex flex-wrap gap-2">
                <ToolButton
                  active={tool === 'select'}
                  label="Select"
                  title="Select, move, resize, rotate"
                  icon={<MousePointer2 size={14} />}
                  onClick={() => { setTool('select'); setActiveTool('select') }}
                />
                <ToolButton
                  active={tool === 'pan'}
                  label="Pan"
                  title="Pan — drag to move the canvas"
                  icon={<Hand size={14} />}
                  onClick={() => { setTool('pan'); setActiveTool('pan') }}
                />
                <ToolButton
                  active={false}
                  label="Undo"
                  title="Undo"
                  icon={<Undo2 size={14} />}
                  onClick={() => {
                    if (!canUndo) return
                    historyIndexRef.current -= 1
                    setShapes(cloneShapes(historyRef.current[historyIndexRef.current]))
                    setSelectedIds([])
                  }}
                />
                <ToolButton
                  active={false}
                  label="Redo"
                  title="Redo"
                  icon={<Redo2 size={14} />}
                  onClick={() => {
                    if (!canRedo) return
                    historyIndexRef.current += 1
                    setShapes(cloneShapes(historyRef.current[historyIndexRef.current]))
                    setSelectedIds([])
                  }}
                />
                <ToolButton
                  active={false}
                  label="Delete"
                  title="Delete selected"
                  icon={<Trash2 size={14} />}
                  onClick={deleteSelected}
                />
                <ToolButton
                  active={false}
                  label="Clear"
                  title="Clear all — erase entire board"
                  icon={<Eraser size={14} />}
                  onClick={clearAll}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Mouse and touch are supported. Use <strong>Select</strong> to move, resize, and rotate selected items.
              </p>
            </div>
          </div>
        </div>
      </div>

      <WhiteboardCanvas
        shapes={shapes}
        selectedIds={selectedIds}
        tool={tool}
        style={style}
        onSelectIds={(ids) => {
          setSelectedIds(ids)
        }}
        zoom={zoom}
        onZoomChange={setZoom}
        onShapesChange={(next, pushHistoryEntry) => {
          replaceShapes(next, pushHistoryEntry)
          if (pushHistoryEntry && !stayTool) {
            setTool('select')
          }
        }}
        onStageMount={(stage) => { stageInstanceRef.current = stage }}
      />
    </div>
  )
}

// ── Board card (gallery) ──────────────────────────────────────────────────────

function BoardCard({
  board, onOpen, onDelete,
}: { board: Whiteboard; onOpen: () => void; onDelete: () => void }) {
  return (
    <div
      className="group relative flex flex-col rounded-xl border bg-card shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
      onClick={onOpen}
    >
      {/* Preview */}
      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {board.preview ? (
          <img src={board.preview} alt={board.name} className="w-full h-full object-cover" />
        ) : (
          <PenLine size={36} className="text-muted-foreground/30" />
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="font-semibold text-sm truncate">{board.name}</p>
        {board.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{board.description}</p>
        )}
        <p className="text-[11px] text-muted-foreground/60 mt-auto pt-1">
          {new Date(board.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-2 right-2 p-1 rounded bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
        title="Delete board"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WhiteboardPage() {
  const { data: boards = [], isLoading } = useListWhiteboardsQuery({})
  const [createWhiteboard] = useCreateWhiteboardMutation()
  const [deleteWhiteboard] = useDeleteWhiteboardMutation()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Deep-link: ?board=<id> opens a board directly
  useEffect(() => {
    const boardParam = searchParams.get('board')
    if (boardParam && boards.length > 0) {
      const found = boards.find((b) => b.id === boardParam)
      if (found) {
        setActiveId(found.id)
        setSearchParams({}, { replace: true })
      }
    }
  }, [boards, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    try {
      const board = await createWhiteboard({ name: 'New Board' }).unwrap()
      setActiveId(board.id)
    } catch {
      toast.error('Failed to create board.')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteWhiteboard(id).unwrap()
      if (activeId === id) setActiveId(null)
      toast.success('Board deleted.')
    } catch {
      toast.error('Failed to delete board.')
    }
  }

  const activeBoard = activeId ? (boards.find((b) => b.id === activeId) ?? null) : null

  // Editor view
  if (activeBoard) {
    return (
      <div className="flex h-[calc(100vh-64px)] flex-col gap-4 -m-4 p-4 md:-m-6 md:p-6">
        <BoardEditor key={activeBoard.id} board={activeBoard} onBack={() => setActiveId(null)} />
      </div>
    )
  }

  // Gallery view
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <PenLine size={20} /> Whiteboard
        </h1>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus size={14} /> New Board
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-muted-foreground">
          <PenLine size={52} className="opacity-20" />
          <p className="font-medium">No boards yet</p>
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus size={14} /> Create First Board
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {boards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              onOpen={() => setActiveId(board.id)}
              onDelete={() => handleDelete(board.id)}
            />
          ))}

          {/* Plus card */}
          <button
            type="button"
            onClick={handleCreate}
            className="flex flex-col items-center justify-center aspect-video rounded-xl border-2 border-dashed text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-muted/30 transition-colors gap-2"
          >
            <Plus size={28} className="opacity-60" />
            <span className="text-xs font-medium">New Board</span>
          </button>
        </div>
      )}
    </div>
  )
}
