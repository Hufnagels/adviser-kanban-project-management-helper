import { api } from '@/api/baseApi'

export const importExportApi = api.injectEndpoints({
  endpoints: (build) => ({
    importTasks: build.mutation<{ imported: number }, FormData>({
      query: (body) => {
        const projectId = body.get('project_id')
        body.delete('project_id')
        const url = projectId
          ? `/import-export/upload?project_id=${projectId}`
          : '/import-export/upload'
        return { url, method: 'POST', body, formData: true }
      },
      invalidatesTags: ['Task'],
    }),
    exportTasks: build.query<Blob, void>({
      query: () => ({
        url: '/import-export/export',
        responseHandler: (r) => r.blob(),
      }),
    }),
  }),
})

export const { useImportTasksMutation, useExportTasksQuery } = importExportApi
