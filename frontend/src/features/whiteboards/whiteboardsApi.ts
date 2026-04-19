import { api } from '@/api/baseApi'

export interface WbShape {
  id: string
  type: 'rect' | 'triangle' | 'circle' | 'line' | 'arrow' | 'text' | 'note' | 'freehand'
  x: number
  y: number
  width: number
  height: number
  // line / arrow end point
  x2?: number
  y2?: number
  // freehand flat point array [x1,y1,x2,y2,...]
  points?: number[]
  // style
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  // text
  text?: string
  fontSize?: number
  fontColor?: string
  // transform
  rotation?: number
}

export interface Whiteboard {
  id: string
  name: string
  shapes: WbShape[]
  description?: string
  preview?: string        // base64 data URL (JPEG thumbnail)
  customer_id?: string
  contract_id?: string
  project_id?: string
  created_at: string
  updated_at: string
}

export const whiteboardsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listWhiteboards: build.query<Whiteboard[], { contract_id?: string }>({
      query: ({ contract_id } = {}) =>
        contract_id ? `/whiteboards?contract_id=${contract_id}` : '/whiteboards',
      providesTags: ['Whiteboard'],
    }),
    createWhiteboard: build.mutation<Whiteboard, {
      name?: string
      description?: string
      customer_id?: string
      contract_id?: string
      project_id?: string
    }>({
      query: (body) => ({ url: '/whiteboards', method: 'POST', body }),
      invalidatesTags: ['Whiteboard'],
    }),
    updateWhiteboard: build.mutation<Whiteboard, {
      id: string
      name?: string
      shapes?: WbShape[]
      description?: string
      preview?: string
      customer_id?: string
      contract_id?: string
      project_id?: string
    }>({
      query: ({ id, ...body }) => ({ url: `/whiteboards/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_, __, { id }) => [{ type: 'Whiteboard', id: id as string }, 'Whiteboard'],
    }),
    deleteWhiteboard: build.mutation<void, string>({
      query: (id) => ({ url: `/whiteboards/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Whiteboard'],
    }),
  }),
})

export const {
  useListWhiteboardsQuery,
  useCreateWhiteboardMutation,
  useUpdateWhiteboardMutation,
  useDeleteWhiteboardMutation,
} = whiteboardsApi
