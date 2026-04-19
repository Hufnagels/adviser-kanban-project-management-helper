import { api } from '@/api/baseApi'

export interface Customer {
  id: string
  name: string
  description?: string
  company_type?: string
  industry?: string
  website?: string
  sap_bp_code?: string
  tax_number?: string
  tax_group?: string
  address_street?: string
  address_city?: string
  address_zip?: string
  address_state?: string
  address_country?: string
  phone?: string
  fax?: string
  email?: string
  gm_name?: string
  gm_title?: string
  gm_email?: string
  gm_phone?: string
  bank_name?: string
  bank_account?: string
  bank_iban?: string
  bank_bic?: string
  notes?: string
  created_at: string
  contracts_count: number
}

export interface Project {
  id: string
  name: string
  description?: string
  customer_id?: string
  contract_id?: string
  owner_id?: string
  created_at: string
}

export const customerApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCustomers: build.query<Customer[], void>({
      query: () => '/customers',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Customer' as const, id })), { type: 'Customer' as const, id: 'LIST' }]
          : [{ type: 'Customer' as const, id: 'LIST' }],
    }),
    getCustomer: build.query<Customer & { projects: Project[] }, string>({
      query: (id) => `/customers/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Customer' as const, id }],
    }),
    createCustomer: build.mutation<Customer, { name: string; description?: string }>({
      query: (body) => ({ url: '/customers', method: 'POST', body }),
      invalidatesTags: [{ type: 'Customer' as const, id: 'LIST' }],
    }),
    updateCustomer: build.mutation<Customer, { id: string } & Partial<Omit<Customer, 'id' | 'created_at'>>>({
      query: ({ id, ...body }) => ({ url: `/customers/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Customer' as const, id }, { type: 'Customer' as const, id: 'LIST' }],
    }),
    deleteCustomer: build.mutation<void, string>({
      query: (id) => ({ url: `/customers/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Customer' as const, id }, { type: 'Customer' as const, id: 'LIST' }],
    }),
    getProjects: build.query<Project[], { customer_id?: string }>({
      query: (params) => ({ url: '/projects', params }),
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Project' as const, id })), { type: 'Project' as const, id: 'LIST' }]
          : [{ type: 'Project' as const, id: 'LIST' }],
    }),
    createProject: build.mutation<Project, { name: string; description?: string; customer_id?: string }>({
      query: (body) => ({ url: '/projects', method: 'POST', body }),
      invalidatesTags: (_r, _e, { customer_id }) => [
        { type: 'Project' as const, id: 'LIST' },
        { type: 'Customer' as const, id: 'LIST' },
        ...(customer_id ? [{ type: 'Customer' as const, id: customer_id }] : []),
      ],
    }),
    deleteProject: build.mutation<void, { id: string; customer_id?: string }>({
      query: ({ id }) => ({ url: `/projects/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { id, customer_id }) => [
        { type: 'Project' as const, id },
        { type: 'Project' as const, id: 'LIST' },
        { type: 'Customer' as const, id: 'LIST' },
        ...(customer_id ? [{ type: 'Customer' as const, id: customer_id }] : []),
      ],
    }),
  }),
})

export const {
  useGetCustomersQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useGetProjectsQuery,
  useCreateProjectMutation,
  useDeleteProjectMutation,
} = customerApi
