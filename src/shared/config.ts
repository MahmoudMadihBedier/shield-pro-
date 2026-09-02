/**
 * The single place env config is read and validated. Import `config` from here;
 * never touch `import.meta.env` anywhere else.
 */
import { z } from 'zod'

const envSchema = z.object({
  appwriteEndpoint: z.string().url(),
  appwriteProjectId: z.string().min(1),
  appwriteProjectName: z.string().min(1),
})

const parsed = envSchema.safeParse({
  appwriteEndpoint: import.meta.env.VITE_APPWRITE_ENDPOINT,
  appwriteProjectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  appwriteProjectName: import.meta.env.VITE_APPWRITE_PROJECT_NAME,
})

if (!parsed.success) {
  // Fail loud and early: a misconfigured build should never reach a user.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n')
  throw new Error(`Invalid Appwrite configuration. Check your .env file:\n${issues}`)
}

export const config = Object.freeze(parsed.data)

export type AppConfig = typeof config
