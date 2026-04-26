import { api } from '@/api/baseApi'

export interface MeetingFile {
  id: string
  name: string
  size: number
  content_type: string | null
  description: string | null
  created_at: string
}

export interface TopicFile {
  id: string
  name: string
  size: number
  content_type: string | null
  description: string | null
  created_at: string
}

export interface MeetingTopic {
  id: string
  meeting_id: string
  sort_order: number
  name: string
  description: string | null
  planned_minutes: number | null
  actual_seconds: number
  decision: string | null
  status: 'pending' | 'active' | 'done'
  files: TopicFile[]
}

export interface Meeting {
  id: string
  title: string
  date: string | null
  location: string | null
  description: string | null
  status: 'draft' | 'in_progress' | 'completed' | 'canceled'
  sort_order: number
  customer_id: string | null
  contract_id: string | null
  project_id: string | null
  topic_count: number
  total_planned_minutes: number
  topics?: MeetingTopic[]
  files?: MeetingFile[]
  created_at: string
  updated_at: string
}

const TAG = 'Meeting' as const
const TOPIC_TAG = 'MeetingTopic' as const

export const meetingsApi = api.injectEndpoints({
  endpoints: (build) => ({
    // ── Meetings ──────────────────────────────────────────────────────────────
    listMeetings: build.query<Meeting[], { status?: string; customer_id?: string; contract_id?: string }>({
      query: (params = {}) => {
        const q = new URLSearchParams()
        if (params.status) q.set('status', params.status)
        if (params.customer_id) q.set('customer_id', params.customer_id)
        if (params.contract_id) q.set('contract_id', params.contract_id)
        const qs = q.toString()
        return `/meetings${qs ? `?${qs}` : ''}`
      },
      providesTags: [TAG],
    }),

    getMeeting: build.query<Meeting, string>({
      query: (id) => `/meetings/${id}`,
      providesTags: (_r, _e, id) => [{ type: TAG, id }],
    }),

    createMeeting: build.mutation<Meeting, {
      title: string
      date?: string
      location?: string
      description?: string
      customer_id?: string
      contract_id?: string
      project_id?: string
    }>({
      query: (body) => ({ url: '/meetings', method: 'POST', body }),
      invalidatesTags: [TAG],
    }),

    updateMeeting: build.mutation<Meeting, {
      id: string
      title?: string
      date?: string | null
      location?: string | null
      description?: string | null
      status?: string
      customer_id?: string | null
      contract_id?: string | null
      project_id?: string | null
    }>({
      query: ({ id, ...body }) => ({ url: `/meetings/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [TAG, { type: TAG, id }],
    }),

    deleteMeeting: build.mutation<void, string>({
      query: (id) => ({ url: `/meetings/${id}`, method: 'DELETE' }),
      invalidatesTags: [TAG],
    }),

    reorderMeetings: build.mutation<void, string[]>({
      query: (ids) => ({ url: '/meetings/reorder', method: 'POST', body: { ids } }),
      invalidatesTags: [TAG],
    }),

    duplicateMeeting: build.mutation<Meeting, string>({
      query: (id) => ({ url: `/meetings/${id}/duplicate`, method: 'POST' }),
      invalidatesTags: [TAG],
    }),

    // ── Topics ────────────────────────────────────────────────────────────────
    addTopic: build.mutation<MeetingTopic, {
      meeting_id: string
      name: string
      description?: string
      planned_minutes?: number
    }>({
      query: ({ meeting_id, ...body }) => ({ url: `/meetings/${meeting_id}/topics`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { meeting_id }) => [{ type: TAG, id: meeting_id }],
    }),

    updateTopic: build.mutation<MeetingTopic, {
      meeting_id: string
      topic_id: string
      name?: string
      description?: string | null
      planned_minutes?: number | null
      actual_seconds?: number
      decision?: string | null
      status?: string
      sort_order?: number
    }>({
      query: ({ meeting_id, topic_id, ...body }) => ({
        url: `/meetings/${meeting_id}/topics/${topic_id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_r, _e, { meeting_id }) => [{ type: TAG, id: meeting_id }],
    }),

    deleteTopic: build.mutation<void, { meeting_id: string; topic_id: string }>({
      query: ({ meeting_id, topic_id }) => ({
        url: `/meetings/${meeting_id}/topics/${topic_id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { meeting_id }) => [{ type: TAG, id: meeting_id }],
    }),

    reorderTopics: build.mutation<void, { meeting_id: string; ids: string[] }>({
      query: ({ meeting_id, ids }) => ({
        url: `/meetings/${meeting_id}/topics/reorder`,
        method: 'POST',
        body: { ids },
      }),
      invalidatesTags: (_r, _e, { meeting_id }) => [{ type: TAG, id: meeting_id }],
    }),

    // ── Meeting files ─────────────────────────────────────────────────────────
    uploadMeetingFile: build.mutation<MeetingFile, { meeting_id: string; form: FormData }>({
      query: ({ meeting_id, form }) => ({
        url: `/meetings/${meeting_id}/files`,
        method: 'POST',
        body: form,
      }),
      invalidatesTags: (_r, _e, { meeting_id }) => [{ type: TAG, id: meeting_id }],
    }),

    deleteMeetingFile: build.mutation<void, { meeting_id: string; file_id: string }>({
      query: ({ meeting_id, file_id }) => ({
        url: `/meetings/${meeting_id}/files/${file_id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { meeting_id }) => [{ type: TAG, id: meeting_id }],
    }),

    // ── Topic files ───────────────────────────────────────────────────────────
    uploadTopicFile: build.mutation<TopicFile, { meeting_id: string; topic_id: string; form: FormData }>({
      query: ({ meeting_id, topic_id, form }) => ({
        url: `/meetings/${meeting_id}/topics/${topic_id}/files`,
        method: 'POST',
        body: form,
      }),
      invalidatesTags: (_r, _e, { meeting_id }) => [{ type: TAG, id: meeting_id }],
    }),

    deleteTopicFile: build.mutation<void, { meeting_id: string; topic_id: string; file_id: string }>({
      query: ({ meeting_id, topic_id, file_id }) => ({
        url: `/meetings/${meeting_id}/topics/${topic_id}/files/${file_id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { meeting_id }) => [{ type: TAG, id: meeting_id }],
    }),
  }),
})

export const {
  useListMeetingsQuery,
  useGetMeetingQuery,
  useCreateMeetingMutation,
  useUpdateMeetingMutation,
  useDeleteMeetingMutation,
  useReorderMeetingsMutation,
  useDuplicateMeetingMutation,
  useAddTopicMutation,
  useUpdateTopicMutation,
  useDeleteTopicMutation,
  useReorderTopicsMutation,
  useUploadMeetingFileMutation,
  useDeleteMeetingFileMutation,
  useUploadTopicFileMutation,
  useDeleteTopicFileMutation,
} = meetingsApi

export function meetingFileDownloadUrl(meetingId: string, fileId: string) {
  return `/api/v1/meetings/${meetingId}/files/${fileId}/download`
}

export function topicFileDownloadUrl(meetingId: string, topicId: string, fileId: string) {
  return `/api/v1/meetings/${meetingId}/topics/${topicId}/files/${fileId}/download`
}
