import { api } from './api-client';

/**
 * The insurers a person may register under.
 *
 * The only company question reachable without a token: `GET /admin/companies` is
 * `company:crud`, Super Admin only, and registration is public. The server returns an id
 * and a name and nothing else — which insurers exist is not a secret, how each is
 * configured is.
 */
export interface Insurer {
  readonly _id: string;
  readonly name: string;
}

export const listInsurers = () => api<Insurer[]>('/companies');
