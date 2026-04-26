import { api } from '@/api/baseApi'

export interface DocBlock {
  id: string
  type: 'text' | 'heading'
  content: string
}

export interface Doc {
  id: string
  title: string
  blocks: DocBlock[]
  project_id?: string | null
  project_name?: string | null
  contract_name?: string | null
  customer_name?: string | null
  created_at: string
  updated_at: string
}

export const docsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listDocs: build.query<Doc[], { project_id?: string } | void>({
      query: (args) => {
        const params = new URLSearchParams()
        if (args && args.project_id) params.set('project_id', args.project_id)
        const qs = params.toString()
        return `/docs${qs ? `?${qs}` : ''}`
      },
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Doc' as const, id })), { type: 'Doc', id: 'LIST' }]
          : [{ type: 'Doc', id: 'LIST' }],
    }),
    createDoc: build.mutation<Doc, { title?: string; project_id?: string }>({
      query: (body) => ({ url: '/docs', method: 'POST', body }),
      invalidatesTags: [{ type: 'Doc', id: 'LIST' }],
    }),
    updateDoc: build.mutation<Doc, { id: string; title?: string; blocks?: DocBlock[] }>({
      query: ({ id, ...body }) => ({ url: `/docs/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_, __, { id }) => [{ type: 'Doc', id }, { type: 'Doc', id: 'LIST' }],
    }),
    deleteDoc: build.mutation<void, string>({
      query: (id) => ({ url: `/docs/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Doc', id: 'LIST' }],
    }),
  }),
})

export const {
  useListDocsQuery,
  useCreateDocMutation,
  useUpdateDocMutation,
  useDeleteDocMutation,
} = docsApi
