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

export async function getFamilyData(): Promise<FamilyDataResponse> {
  const { data, error } = await requireSupabase().functions.invoke<FamilyDataResponse>('family-data', {
    method: 'GET',
  });
  if (error) {
    throw await serviceError(error);
  }
  if (!data || !data.data || typeof data.sha !== 'string') {
    throw new FamilyDataServiceError('The family-data function returned an invalid response.');
  }
  return data;
}

export async function saveFamilyData(data: RawFamilyData, sha: string): Promise<string> {
  const { data: response, error } = await requireSupabase().functions.invoke<SaveFamilyDataResponse>(
    'family-data',
    { method: 'PUT', body: { data, sha } },
  );
  if (error) {
    throw await serviceError(error);
  }
  if (!response || typeof response.sha !== 'string') {
    throw new FamilyDataServiceError('The family-data function returned an invalid save response.');
  }
  return response.sha;
}
