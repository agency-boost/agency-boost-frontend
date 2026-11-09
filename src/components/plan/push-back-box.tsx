import { cn } from '@/lib/cn';
import type { ScriptSize } from './script-blocks';

/**
 * **The push-back box** (D-components; `.objection-box`, `Overall.html:9752-9759`, `:10318-10325`): what
 * the customer says, in quotation marks, and the reply.
 *
 * Props only — the labels too — so the Recruitment Attack Plan (**P17-T3**, its second user) answers a
 * candidate's objection with the same box. Both lines are rendered as text, never as markup.
 *
 * **Each line keeps the breaks its author typed** (P19-T6 AC-1, B1-2): `whitespace-pre-line`, so objections written one
 * per line are read one per line.
 *
 * *They say:* is alert and *You say:* is success, as drawn; each is a word as well as a colour, so the
 * colour is never the only cue. Both clear 4.5:1 on the warm ground (`a11y.spec.tsx`).
 */
export function PushBackBox({
  theySayLabel,
  theySay,
  youSayLabel,
  youSay,
  size = 'page',
}: {
  theySayLabel: string;
  theySay: string;
  youSayLabel: string;
  youSay: string;
  size?: ScriptSize;
}) {
  return (
    <div className={cn('rounded-[10px] border border-hairline bg-base', size === 'page' ? 'px-4 py-3.5' : 'px-[15px] py-[13px]')}>
      <p className="m-0 mb-2 text-base font-semibold text-alert">
        {theySayLabel}{' '}
        <em className="whitespace-pre-line font-normal not-italic text-navy">“{theySay}”</em>
      </p>
      {/* An objection the company has not answered yet says only what the customer says (P19.4-T4, ADR-0209 §9). */}
      {youSay !== '' && (
        <>
          <p className="m-0 mb-1.5 text-base font-semibold text-success">{youSayLabel}</p>
          <p className={cn('m-0 whitespace-pre-line text-navy', size === 'page' ? 'text-md leading-normal' : 'text-base leading-normal')}>{youSay}</p>
        </>
      )}
    </div>
  );
}
