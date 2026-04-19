import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react'
import type { RootState } from '@/store'
import { setCredentials, logout } from '@/features/auth/authSlice'

const rawBase = fetchBaseQuery({
  baseUrl: '/api/v1',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

// Mutex flag so concurrent 401s only trigger one refresh
let isRefreshing = false
let pendingResolvers: Array<(token: string | null) => void> = []

function waitForRefresh(): Promise<string | null> {
  return new Promise((resolve) => pendingResolvers.push(resolve))
}

function resolveAll(token: string | null) {
  pendingResolvers.forEach((r) => r(token))
  pendingResolvers = []
}

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBase(args, api, extraOptions)

  if (result.error?.status !== 401) return result

  // Skip refresh loop for the refresh call itself
  const url = typeof args === 'string' ? args : args.url
  if (url === '/auth/refresh') return result

  if (isRefreshing) {
    // Wait for the in-flight refresh to finish
    const newToken = await waitForRefresh()
    if (!newToken) return result
    // Retry with the new token already in state
    return rawBase(args, api, extraOptions)
  }

  isRefreshing = true
  const refreshToken = localStorage.getItem('refresh_token')

  if (!refreshToken) {
    api.dispatch(logout())
    isRefreshing = false
    resolveAll(null)
    return result
  }

  const refreshResult = await rawBase(
    { url: '/auth/refresh', method: 'POST', body: { refresh_token: refreshToken } },
    api,
    extraOptions,
  )

  if (refreshResult.data) {
    const { access_token, refresh_token } = refreshResult.data as {
      access_token: string
      refresh_token: string
    }
    const state = api.getState() as RootState
    api.dispatch(setCredentials({ token: access_token, user: state.auth.user! }))
    localStorage.setItem('refresh_token', refresh_token)

    isRefreshing = false
    resolveAll(access_token)

    // Retry the original request
    result = await rawBase(args, api, extraOptions)
  } else {
    api.dispatch(logout())
    isRefreshing = false
    resolveAll(null)
  }

  return result
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Task', 'Project', 'TimeEntry', 'Customer', 'Colleague', 'Me', 'Contract', 'ContractFile', 'Doc', 'Whiteboard'],
  endpoints: () => ({}),
})
