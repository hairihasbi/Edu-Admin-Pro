
import { z } from 'zod';

// --- SHARED SCHEMAS ---

export const UserRoleSchema = z.enum(['ADMIN', 'GURU']);

// --- API: TURSO SYNC ---
// Validates the payload for database synchronization
export const TursoSyncSchema = z.object({
  action: z.enum(['init', 'push', 'pull', 'check']),
  collection: z.string().optional(),
  userId: z.string().optional().nullable(),
  force: z.boolean().optional(),
  items: z.array(z.record(z.string(), z.any())).optional(), // Array of objects
});

// --- API: GEMINI AI ---
// Validates the prompt request
export const GeminiRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  userId: z.string().optional().nullable(),
  useSearch: z.boolean().optional(), // NEW: AI Fact Check
});

// --- API: STUDENTS FETCH ---
// Validates query parameters (coerces strings to numbers)
export const StudentQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional().default(''),
  school: z.string().optional().default(''),
  teacherId: z.string().optional().default(''),
});

// --- API: WHATSAPP BROADCAST ---
export const WhatsAppConfigSchema = z.object({
  provider: z.enum(['FLOWKIRIM', 'FONNTE', 'OTHER']),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  deviceId: z.string().optional(),
});

export const RecipientSchema = z.object({
  phone: z.string().min(5),
  name: z.string(),
});

export const WhatsAppBroadcastSchema = z.object({
  config: WhatsAppConfigSchema,
  recipients: z.array(RecipientSchema).min(1, "At least one recipient required"),
  message: z.string().min(1, "Message cannot be empty"),
});

// --- API: EMAIL SEND ---
export const EmailConfigSchema = z.object({
  provider: z.enum(['MAILERSEND', 'BREVO']),
  method: z.enum(['API', 'SMTP']),
  apiKey: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  fromEmail: z.string().email(),
  fromName: z.string(),
  isActive: z.boolean(),
});

export const UserSchema = z.object({
  fullName: z.string(),
  email: z.string().email(),
  schoolName: z.string().optional(),
});

export const SendEmailSchema = z.object({
  user: UserSchema,
  config: EmailConfigSchema,
});

// --- API: EMAIL BROADCAST (NEW) ---
export const EmailRecipientSchema = z.object({
  email: z.string().email(),
  name: z.string(),
});

export const EmailBroadcastSchema = z.object({
  config: EmailConfigSchema,
  recipients: z.array(EmailRecipientSchema).min(1, "Minimal satu penerima email"),
  subject: z.string().min(1, "Subjek wajib diisi"),
  content: z.string().min(1, "Konten email wajib diisi"), // HTML allowed
});
