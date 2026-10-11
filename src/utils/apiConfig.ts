import { AppSettings } from '../types';

/**
 * Returns the effective WhatsApp API server base URL.
 * Priority:
 * 1. Saved in Firestore AppSettings (accessible globally on all devices)
 * 2. Saved in localStorage (local device override)
 * 3. Environment variable VITE_WHATSAPP_API_URL
 * 4. Fallback: http://localhost:5000
 */
export const DEFAULT_NGROK_URL = 'https://unappreciably-nonsyllogistical-gonzalo.ngrok-free.dev';

export const getWhatsAppApiUrl = (settings?: AppSettings | null): string => {
  // 1. Check settings saved in Firestore
  if (settings?.whatsappServerUrl && typeof settings.whatsappServerUrl === 'string' && settings.whatsappServerUrl.trim()) {
    return settings.whatsappServerUrl.trim().replace(/\/+$/, '');
  }

  // 2. Check localStorage (for local device testing or override)
  if (typeof window !== 'undefined' && window.localStorage) {
    const localUrl = localStorage.getItem('whatsapp_server_url');
    if (localUrl && localUrl.trim()) {
      return localUrl.trim().replace(/\/+$/, '');
    }
  }

  // 3. Check environment variable (VITE_WHATSAPP_API_URL)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WHATSAPP_API_URL) {
    return String(import.meta.env.VITE_WHATSAPP_API_URL).trim().replace(/\/+$/, '');
  }

  // 4. Smart fallback: Localhost for local dev, permanent static ngrok for Netlify/mobile
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:5000';
  }

  return DEFAULT_NGROK_URL;
};

/**
 * Standard headers for WhatsApp API calls.
 * Includes 'ngrok-skip-browser-warning' to bypass ngrok's HTML interstitial screen.
 */
export const getApiHeaders = (extraHeaders?: Record<string, string>): Record<string, string> => {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(extraHeaders || {})
  };
};

/**
 * Tests connection to the provided WhatsApp server URL.
 */
export const testWhatsAppServerConnection = async (baseUrl: string): Promise<{
  success: boolean;
  status?: string;
  phone?: string;
  latencyMs?: number;
  error?: string;
}> => {
  const cleanUrl = baseUrl.trim().replace(/\/+$/, '');
  const startTime = performance.now();

  try {
    const res = await fetch(`${cleanUrl}/api/status`, {
      method: 'GET',
      headers: getApiHeaders(),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      return { success: false, error: `Server responded with HTTP ${res.status}` };
    }

    const data = await res.json();
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      success: true,
      status: data.status || 'unknown',
      phone: data.user?.phone || null,
      latencyMs
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.name === 'TimeoutError' ? 'Server connection timed out' : (err.message || 'Connection failed')
    };
  }
};
