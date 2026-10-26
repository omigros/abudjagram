import { TELEGRAM_API_HASH, TELEGRAM_API_ID } from '../config';

export type ApiCredentials = {
  apiId: number;
  apiHash: string;
};

const STORAGE_KEY = 'abj-api-credentials';
const REJECTED_FLAG_KEY = 'abj-api-credentials-rejected';
const API_ID_REGEX = /^\d{3,12}$/;
const API_HASH_REGEX = /^[a-f0-9]{32}$/i;

// Keys baked in at build time win; otherwise each user enters their own keys from my.telegram.org
export function getApiCredentials(): ApiCredentials | undefined {
  if (TELEGRAM_API_ID && TELEGRAM_API_HASH) {
    return { apiId: TELEGRAM_API_ID, apiHash: TELEGRAM_API_HASH };
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return undefined;

    const { apiId, apiHash } = JSON.parse(saved) as Partial<ApiCredentials>;
    return apiId && apiHash ? { apiId, apiHash } : undefined;
  } catch (err) {
    return undefined;
  }
}

export function getIsApiCredentialsBuiltIn() {
  return Boolean(TELEGRAM_API_ID && TELEGRAM_API_HASH);
}

export function validateApiId(value: string) {
  return API_ID_REGEX.test(value.trim());
}

export function validateApiHash(value: string) {
  return API_HASH_REGEX.test(value.trim());
}

export function saveApiCredentials(apiId: string, apiHash: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiId: Number(apiId.trim()), apiHash: apiHash.trim() }));
  sessionStorage.removeItem(REJECTED_FLAG_KEY);
}

export function clearApiCredentials() {
  localStorage.removeItem(STORAGE_KEY);
}

// Sends the user back to the setup screen when Telegram rejects the entered keys
export function rejectApiCredentials() {
  if (getIsApiCredentialsBuiltIn()) return false;

  clearApiCredentials();
  sessionStorage.setItem(REJECTED_FLAG_KEY, '1');
  window.location.reload();
  return true;
}

export function getIsApiCredentialsRejected() {
  return sessionStorage.getItem(REJECTED_FLAG_KEY) === '1';
}
