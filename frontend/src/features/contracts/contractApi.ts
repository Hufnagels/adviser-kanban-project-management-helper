import { api } from '@/api/baseApi'
import type { Project } from '@/features/customers/customerApi'

export interface Contract {
  id: string
  customer_id: string
  name: string
  contract_number?: string
  status: string
  start_date?: string
  end_date?: string
  description?: string
  notes?: string
  contract_value?: number
  currency?: string
  payment_terms?: string
  billing_cycle?: string
  discount?: number
  created_at: string
}

export interface ContractWithProjects extends Contract {
  projects: Project[]
}

const TAG = 'Contract' as const

export const contractApi = api.injectEndpoints({
  endpoints: (build) => ({
    getContracts: build.query<Contract[], { customer_id?: string }>({
      query: (params) => ({ url: '/contracts', params }),
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: TAG, id })), { type: TAG, id: 'LIST' }]
          : [{ type: TAG, id: 'LIST' }],
    }),
    getContract: build.query<ContractWithProjects, string>({
      query: (id) => `/contracts/${id}`,
      providesTags: (_r, _e, id) => [{ type: TAG, id }],
    }),
    createContract: build.mutation<Contract, { name: string; customer_id: string; [key: string]: any }>({
      query: (body) => ({ url: '/contracts', method: 'POST', body }),
      invalidatesTags: [{ type: TAG, id: 'LIST' }],
    }),
    updateContract: build.mutation<Contract, { id: string } & Partial<Omit<Contract, 'id' | 'created_at'>>>({
      query: ({ id, ...body }) => ({ url: `/contracts/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: TAG, id }, { type: TAG, id: 'LIST' }],
    }),
    deleteContract: build.mutation<void, string>({
      query: (id) => ({ url: `/contracts/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: TAG, id }, { type: TAG, id: 'LIST' }],
    }),
    addProjectToContract: build.mutation<void, { project_id: string; contract_id: string }>({
      query: ({ project_id, contract_id }) => ({
        url: `/projects/${project_id}`,
        method: 'PATCH',
        body: { contract_id },
      }),
      invalidatesTags: (_r, _e, { contract_id }) => [
        { type: TAG, id: contract_id },
        { type: TAG, id: 'LIST' },
        'Project',
      ],
    }),
    removeProjectFromContract: build.mutation<void, { project_id: string; contract_id: string }>({
      query: ({ project_id }) => ({
        url: `/projects/${project_id}`,
        method: 'PATCH',
        body: { contract_id: null },
      }),
      invalidatesTags: (_r, _e, { contract_id }) => [
        { type: TAG, id: contract_id },
        { type: TAG, id: 'LIST' },
        'Project',
      ],
    }),
    createProjectInContract: build.mutation<
      Project,
      { name: string; description?: string; contract_id: string; customer_id?: string }
    >({
      query: (body) => ({ url: '/projects', method: 'POST', body }),
      invalidatesTags: (_r, _e, { contract_id }) => [
        { type: TAG, id: contract_id },
        { type: TAG, id: 'LIST' },
        'Project',
      ],
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetContractsQuery,
  useGetContractQuery,
  useCreateContractMutation,
  useUpdateContractMutation,
  useDeleteContractMutation,
  useCreateProjectInContractMutation,
  useAddProjectToContractMutation,
  useRemoveProjectFromContractMutation,
} = contractApi
