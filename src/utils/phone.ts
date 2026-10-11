/**
 * Utility to reliably normalize phone numbers for WhatsApp & Baileys
 */
export const formatWhatsAppPhone = (phone?: string | null): string => {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return '';

  // Handle international prefix 0088 or 00
  if (cleaned.startsWith('0088')) {
    cleaned = cleaned.slice(4);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  }

  // Standardize Bangladesh numbers
  if (cleaned.startsWith('880')) {
    return cleaned;
  }
  if (cleaned.startsWith('0')) {
    return '88' + cleaned;
  }
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return '880' + cleaned;
  }
  if (!cleaned.startsWith('88')) {
    return '88' + cleaned;
  }
  return cleaned;
};
