/**
 * The single shared Appwrite browser client for Shield Pro.
 *
 * Endpoint + project id come from validated env config (`shared/config.ts`) —
 * they are NOT inlined here. All data-layer code imports service instances
 * from this folder; nothing constructs its own `Client`.
 *
 * Appwrite project: "shield-pro" (6a95b631003d4163dc97) @ fra.cloud.appwrite.io
 */
import { Client } from 'appwrite'

import { config } from '@/shared/config'

export const client = new Client()
  .setEndpoint(config.appwriteEndpoint)
  .setProject(config.appwriteProjectId)
