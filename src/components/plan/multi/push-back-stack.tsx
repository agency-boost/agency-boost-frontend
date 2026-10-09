import { PushBackBox } from '../push-back-box';
import type { ScriptSize } from '../script-blocks';

/**
 * **Push-back boxes, one under another** (D-components; `.objection-box`, `Recruitment_Section.html:137-141`,
 * each with `margin-bottom:10px`, logic `:573-583`). Its user is the Recruitment Attack Plan (**P17-T3**): one
 * box per hesitation the candidate has, in the order given.
 *
 * Each box is Phase 14's `PushBackBox`, unchanged — *They say:* in alert, the words in quotation marks,
 * *You say:* in success and the reply — so each is a word as well as a colour. The labels come in by props
 * like every other word, and every word is rendered as text.
 */
export function PushBackStack({
  theySayLabel,
  youSayLabel,
  items,
  size = 'page',
}: {
  theySayLabel: string;
  youSayLabel: string;
  items: readonly { readonly key: string; readonly theySay: string; readonly youSay: string }[];
  size?: ScriptSize;
}) {
  return (
    <div>
      {items.map((item) => (
        <div key={item.key} className="mb-2.5" data-push-back={item.key}>
          <PushBackBox theySayLabel={theySayLabel} theySay={item.theySay} youSayLabel={youSayLabel} youSay={item.youSay} size={size} />
        </div>
      ))}
    </div>
  );
}
