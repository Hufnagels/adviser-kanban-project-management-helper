import { api } from '@/api/baseApi'

export interface CentralFileRecord {
  id: string
  name: string
  size: number
  content_type: string | null
  description?: string | null
  created_at: string
  source_type: 'task' | 'contract'
  source_id: string
  source_name: string
}

export const filesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAllFiles: build.query<CentralFileRecord[], { source_type?: string; search?: string }>({
      query: ({ source_type, search } = {}) => {
        const params = new URLSearchParams()
        if (source_type) params.set('source_type', source_type)
        if (search) params.set('search', search)
        const qs = params.toString()
        return `/files${qs ? `?${qs}` : ''}`
      },
      providesTags: ['ContractFile', 'Task'],
    }),
  }),
})

export const { useGetAllFilesQuery } = filesApi
