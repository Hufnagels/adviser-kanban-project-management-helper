import { api } from '@/api/baseApi'

export interface TaskFile {
  id: string
  name: string
  size: number
  content_type?: string
  description?: string | null
  created_at: string
}

export interface Task {
  id: string
  external_id?: string
  title: string
  task_type?: string
  description?: string
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'canceled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  listing_date?: string
  due_date?: string
  finishing_date?: string
  approval: boolean
  notes?: string
  project_id?: string
  assignee_id?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export type TaskCreate = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'created_by'>
export type TaskUpdate = Partial<TaskCreate>

export const taskApi = api.injectEndpoints({
  endpoints: (build) => ({
    getTasks: build.query<Task[], { project_id?: string; status?: string }>({
      query: (params) => ({ url: '/tasks', params }),
      providesTags: ['Task'],
    }),
    createTask: build.mutation<Task, TaskCreate>({
      query: (body) => ({ url: '/tasks', method: 'POST', body }),
      invalidatesTags: ['Task'],
    }),
    updateTask: build.mutation<Task, { id: string } & TaskUpdate>({
      query: ({ id, ...body }) => ({ url: `/tasks/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Task'],
    }),
    deleteTask: build.mutation<void, string>({
      query: (id) => ({ url: `/tasks/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Task'],
    }),
    getTaskFiles: build.query<TaskFile[], string>({
      query: (taskId) => `/tasks/${taskId}/files`,
      providesTags: (_r, _e, taskId) => [{ type: 'Task' as const, id: `files-${taskId}` }],
    }),
    uploadTaskFile: build.mutation<TaskFile, { taskId: string; form: FormData }>({
      query: ({ taskId, form }) => ({ url: `/tasks/${taskId}/files`, method: 'POST', body: form }),
      invalidatesTags: (_r, _e, { taskId }) => [{ type: 'Task' as const, id: `files-${taskId}` }],
    }),
    deleteTaskFile: build.mutation<void, { taskId: string; fileId: string }>({
      query: ({ taskId, fileId }) => ({ url: `/tasks/${taskId}/files/${fileId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { taskId }) => [{ type: 'Task' as const, id: `files-${taskId}` }],
    }),
    updateTaskFileDescription: build.mutation<TaskFile, { taskId: string; fileId: string; description: string }>({
      query: ({ taskId, fileId, description }) => ({
        url: `/tasks/${taskId}/files/${fileId}`,
        method: 'PATCH',
        body: { description },
      }),
      invalidatesTags: (_r, _e, { taskId }) => [{ type: 'Task' as const, id: `files-${taskId}` }],
    }),
  }),
})

export const {
  useGetTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useGetTaskFilesQuery,
  useUploadTaskFileMutation,
  useDeleteTaskFileMutation,
  useUpdateTaskFileDescriptionMutation,
} = taskApi
