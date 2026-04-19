import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { logout } from '@/features/auth/authSlice'

export interface InWorkState {
  customerId: string
  customerName: string
  contractId: string
  contractName: string
  projects: { id: string; name: string }[]
}

function loadInWork(): InWorkState | null {
  try {
    const raw = localStorage.getItem('inWork')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const slice = createSlice({
  name: 'inWork',
  initialState: loadInWork() as InWorkState | null,
  reducers: {
    setInWork: (_state, action: PayloadAction<InWorkState>) => {
      localStorage.setItem('inWork', JSON.stringify(action.payload))
      return action.payload
    },
    clearInWork: () => {
      localStorage.removeItem('inWork')
      return null
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout, () => {
      localStorage.removeItem('inWork')
      return null
    })
  },
})

export const { setInWork, clearInWork } = slice.actions
export default slice.reducer
