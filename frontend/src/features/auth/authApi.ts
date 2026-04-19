import { api } from '@/api/baseApi'

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<{ access_token: string; refresh_token: string }, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    register: build.mutation<unknown, { email: string; full_name: string; password: string; role?: string }>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),
    getMe: build.query<{ email: string; full_name: string; role: string; id: string }, void>({
      query: () => '/auth/me',
    }),
  }),
})

export const { useLoginMutation, useRegisterMutation, useGetMeQuery } = authApi
