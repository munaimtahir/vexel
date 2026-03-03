import Constants from "expo-constants";
import { API_BASE_URL } from "./env";

const FALLBACK_API_BASE_URL = API_BASE_URL;

let runtimeApiBaseUrl: string | undefined;

export function getApiBaseUrl(): string {
  const appDefault = Constants.expoConfig?.extra?.defaultApiBaseUrl;
  return runtimeApiBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? appDefault ?? FALLBACK_API_BASE_URL;
}

export function setApiBaseUrl(nextApiBaseUrl: string): void {
  runtimeApiBaseUrl = nextApiBaseUrl.trim();
}
