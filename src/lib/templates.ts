import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';
import type { SavedOfficeTemplate } from './admin';

/**
 * **The longest name a template may have** — *New template*, *Rename*, *Import from another company* and
 * *Save as template* all take one.
 *
 * The backend's `TEMPLATE.NAME_MAX_LENGTH` (`backend/src/domain/constants/templates.ts`), which its DTOs
 * enforce. Declared once here for every field that takes one, and pinned to the backend's by
 * `templates.spec.ts`, which reads that file (P13.2's exit review: it had been written out four times).
 */
export const TEMPLATE_NAME_MAX = 80;

/**
 * **What the office page says once *Save as template* has made one** (ADR-0115 §5; P13.2's exit review,
 * finding 2): the template and its company, and — when the office held anything that names something
 * archived — each thing the template left out or changed, in the API's own sentences. Data honesty: the
 * Super Admin is about to start offices from it, and a ratio quietly missing is the thing they would not
 * think to look for.
 *
 * **In the reader's `language`** (P18.98-T6): the words `admin-template.tsx`'s, its caller passing `useLanguage()` —
 * English when none is passed, as before. The template's and the company's names are as stored, and each reason is
 * the API's sentence, in the language the API wrote it in (P18.98-T5).
 */
export function savedTemplateSentence(
  template: SavedOfficeTemplate,
  companyName: string,
  language: Language = SOURCE_LANGUAGE,
): string {
  const t = messagesIn(adminTemplateMessages, language).saveAs;
  const saved = t.saved({ name: template.name, company: companyName });
  const dropped = template.dropped ?? [];
  if (dropped.length === 0) return saved;
  return `${saved} ${t.leftOut({ n: dropped.length, reasons: dropped.map((d) => d.reason).join(' ') })}`;
}
