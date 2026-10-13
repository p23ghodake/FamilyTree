import { RawFamilyData } from '../types/FamilyTypes';
import { requireSupabase } from '../lib/supabase';

export class FamilyDataServiceError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'FamilyDataServiceError';
  }
}

interface FamilyDataResponse {
  data: RawFamilyData;
  sha: string;
  canEdit?: boolean;
  /** Visitor view: some details are removed and the data cannot be saved. */
  limited?: boolean;
}

interface SaveFamilyDataResponse {
  sha: string;
}

async function serviceError(error: { message: string; context?: unknown }): Promise<FamilyDataServiceError> {
  const response = error.context instanceof Response ? error.context : null;
  let message = error.message;
  if (response) {
    try {
      const body: unknown = await response.clone().json();
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
        message = body.error;
      }
    } catch {
      message = `${message} (HTTP ${response.status})`;
    }
  }
  return new FamilyDataServiceError(message, response?.status);
}

type InvokeResult<T> = { data: T | null; error: { message: string; context?: unknown } | null };

// On 401 the stored JWT is stale: refresh it and retry once, otherwise end the session so the user can sign in again.
async function invokeWithRefresh<T>(call: () => Promise<InvokeResult<T>>): Promise<InvokeResult<T>> {
  const result = await call();
  const response = result.error?.context instanceof Response ? result.error.context : null;
  if (response?.status !== 401) return result;
  const client = requireSupabase();
  const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
  if (refreshError || !refreshed.session) {
    await client.auth.signOut({ scope: 'local' });
    return {
      data: null,
      error: { message: 'Your session expired. Please sign in again.', context: undefined },
    };
  }
  return call();
}

export async function getFamilyData(): Promise<FamilyDataResponse> {
  const { data, error } = await invokeWithRefresh(() =>
    requireSupabase().functions.invoke<FamilyDataResponse>('family-data', { method: 'GET' }));
  if (error) {
    throw await serviceError(error);
  }
  if (!data || !data.data || typeof data.sha !== 'string') {
    throw new FamilyDataServiceError('The family-data function returned an invalid response.');
  }
  return data;
}

export async function saveFamilyData(data: RawFamilyData, sha: string): Promise<string> {
  const { data: response, error } = await invokeWithRefresh(() =>
    requireSupabase().functions.invoke<SaveFamilyDataResponse>(
      'family-data',
      { method: 'PUT', body: { data, sha } },
    ));
  if (error) {
    throw await serviceError(error);
  }
  if (!response || typeof response.sha !== 'string') {
    throw new FamilyDataServiceError('The family-data function returned an invalid save response.');
  }
  return response.sha;
}
