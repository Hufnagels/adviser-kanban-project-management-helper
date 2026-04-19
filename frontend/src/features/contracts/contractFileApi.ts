import { api } from '@/api/baseApi'

export interface ContractFileRecord {
  id: string
  name: string
  size: number
  content_type: string | null
  description?: string | null
  created_at: string
}

export const contractFileApi = api.injectEndpoints({
  endpoints: (build) => ({
    listContractFiles: build.query<ContractFileRecord[], string>({
      query: (contractId) => `/contracts/${contractId}/files`,
      providesTags: (_, __, contractId) => [{ type: 'ContractFile', id: contractId }],
    }),

    uploadContractFile: build.mutation<ContractFileRecord, { contractId: string; file: File }>({
      queryFn: async ({ contractId, file }, _api, _extra, baseQuery) => {
        const form = new FormData()
        form.append('file', file)
        const result = await baseQuery({ url: `/contracts/${contractId}/files`, method: 'POST', body: form })
        if (result.error) return { error: result.error }
        return { data: result.data as ContractFileRecord }
      },
      invalidatesTags: (_, __, { contractId }) => [{ type: 'ContractFile', id: contractId }],
    }),

    deleteContractFile: build.mutation<void, { contractId: string; fileId: string }>({
      query: ({ contractId, fileId }) => ({
        url: `/contracts/${contractId}/files/${fileId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_, __, { contractId }) => [{ type: 'ContractFile', id: contractId }],
    }),

    updateContractFileDescription: build.mutation<ContractFileRecord, { contractId: string; fileId: string; description: string }>({
      query: ({ contractId, fileId, description }) => ({
        url: `/contracts/${contractId}/files/${fileId}`,
        method: 'PATCH',
        body: { description },
      }),
      invalidatesTags: (_, __, { contractId }) => [{ type: 'ContractFile', id: contractId }],
    }),
  }),
})

export const {
  useListContractFilesQuery,
  useUploadContractFileMutation,
  useDeleteContractFileMutation,
  useUpdateContractFileDescriptionMutation,
} = contractFileApi
