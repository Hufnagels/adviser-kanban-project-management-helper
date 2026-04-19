import { configureStore } from '@reduxjs/toolkit'
import { api } from '@/api/baseApi'
import authReducer from '@/features/auth/authSlice'
import inWorkReducer from '@/features/inWork/inWorkSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    inWork: inWorkReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
