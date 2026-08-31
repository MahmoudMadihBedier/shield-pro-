/**
 * The data-layer boundary: turn a raw Appwrite/transport error into a typed
 * `AppError` with a user-facing message. Nothing above `infrastructure` should
 * ever see an `AppwriteException`.
 */
import { AppwriteException } from 'appwrite'

import { appError, type AppError } from '@/core/errors'

export function mapAppwriteError(e: unknown): AppError {
  if (e instanceof AppwriteException) {
    switch (e.code) {
      case 401:
        return appError('unauthorized', 'Your session has expired. Please sign in again.', {
          detail: `${e.type}: ${e.message}`,
        })
      case 403:
        return appError('forbidden', 'You do not have permission to perform this action.', {
          detail: `${e.type}: ${e.message}`,
        })
      case 404:
        return appError('not_found', 'The requested record could not be found.', {
          detail: `${e.type}: ${e.message}`,
        })
      case 409:
        return appError(
          'conflict',
          'This change conflicts with the current state. Refresh and try again.',
          {
            detail: `${e.type}: ${e.message}`,
          },
        )
      case 429:
        return appError('rate_limited', 'Too many attempts. Please wait a moment and try again.', {
          detail: `${e.type}: ${e.message}`,
        })
      default:
        if (e.code >= 500) {
          return appError(
            'server',
            'The service is temporarily unavailable. Please try again shortly.',
            {
              detail: `${e.code} ${e.type}: ${e.message}`,
            },
          )
        }
        return appError('unknown', e.message || 'Something went wrong.', {
          detail: `${e.code} ${e.type}`,
          cause: e,
        })
    }
  }

  // Network failures surface as a fetch TypeError before any AppwriteException.
  if (e instanceof TypeError && /fetch|network|Failed to fetch|Load failed/i.test(e.message)) {
    return appError('network', 'Cannot reach the server. Check your internet connection.', {
      detail: e.message,
      cause: e,
    })
  }

  if (e instanceof Error) {
    return appError('unknown', 'Something went wrong.', { detail: e.message, cause: e })
  }

  return appError('unknown', 'Something went wrong.', { cause: e })
}
