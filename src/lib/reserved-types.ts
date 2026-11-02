import type { ApiError } from './api-client';

/**
 * **A refusal to archive an activity type the office's activity binding names**, said plainly
 * (ADR-0163 §5, which turned ADR-0115 §2's three reserved types into the bound ones; P13.2-T6 AC-3).
 *
 * The office's settings save in one batch, and the API names the change that failed — *Change 2
 * (type.archive): …* — which is the batch's bookkeeping, not the Owner's words. The sentence after it is
 * the API's own, naming the type by its label and saying what can be done instead, so that is what is
 * shown. `null` for any other refusal.
 */
export function reservedRefusal(error: ApiError): ApiError | null {
  if (error.code !== 'ACTIVITY_TYPE_BOUND') return null;
  return { ...error, message: error.message.replace(/^Change \d+ \([^)]*\): /, '') };
}
