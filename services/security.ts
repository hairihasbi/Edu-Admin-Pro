
import DOMPurify from 'dompurify';

/**
 * Sanitizes input string to prevent XSS attacks.
 * Strips ALL HTML tags to ensure data is stored as plain text.
 * Useful for: Names, Usernames, Descriptions, Chat messages.
 */
export const sanitizeInput = (input: string | undefined | null): string => {
  if (!input) return '';
  
  // Force string type just in case
  const text = String(input);

  // Configure DOMPurify to strip everything
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // No HTML allowed
    ALLOWED_ATTR: []  // No attributes allowed
  }).trim();
};

/**
 * Sanitizes input but allows basic formatting (if needed in future).
 * Currently strict to prevent formatting issues in reports.
 */
export const sanitizeRichText = (input: string): string => {
    return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: ['b', 'i', 'u', 'p', 'br'], // Only allow basic formatting
        ALLOWED_ATTR: []
    });
};
