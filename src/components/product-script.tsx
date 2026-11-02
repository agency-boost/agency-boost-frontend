import {
  BulletList, NextAction, OpeningLine, SayBox, ScriptBlock, ScriptNote, ScriptText, type ScriptSize,
} from '@/components/plan/script-blocks';
import { PushBackBox } from '@/components/plan/push-back-box';
import { useMessages } from '@/i18n/language-provider';
import { planMessages } from '@/i18n/messages/plan';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import { hasScript, type CatalogScript } from '@/lib/product-catalog';

/**
 * **A product's words, in the numbered blocks** — the catalog drawer's *Attack Plan* tab and the Sales
 * Attack Plan's result (`Overall.html:9726-9790`, `:10295-10348`), composed from the shared blocks
 * (D-components). Every field is the office's approved words or the company's, as the server answered
 * them, and is rendered as text.
 *
 * **Two layouts, as drawn** (D-noscript): with an authored script — `fullScript` not blank — the six
 * blocks *0 Good fit for* to *5 Next action*. Without one:
 *
 * - on the plan page (`:9768-9790`): *Good fit for*, *Opening line* from *Good fit for*, the benefits, the
 *   push-back, and *Next action* saying no script is authored yet;
 * - in the drawer (`:10332-10348`): *Good fit for*, the benefits, the push-back, and the line saying so.
 *
 * A run-off product's drawer tab shows its note instead (`:10290`), which is the drawer's business.
 *
 * **The frame is ours, the words inside it the company's** (P18.98-T4; ADR-0179 §5): the blocks' labels are the two
 * plans' (`messages/plan.ts`) and the script's own lines the catalog's (`messages/product-catalog.ts`), in the reader's
 * language; every field of the script is shown as typed.
 */
export function ProductScript({ script, place }: { script: CatalogScript; place: 'page' | 'drawer' }) {
  const p = useMessages(planMessages);
  const t = useMessages(productCatalogMessages);
  const size: ScriptSize = place;
  const pushBack = (
    <PushBackBox
      size={size}
      theySayLabel={p.theySay}
      theySay={script.objectionTheySay}
      youSayLabel={p.youSay}
      youSay={script.objectionYouSay}
    />
  );
  const goodFit = (
    <ScriptBlock n={0} label={p.goodFitFor} lead size={size}>
      <ScriptText>{script.goodFit}</ScriptText>
    </ScriptBlock>
  );
  const benefits = (n: number) => (
    <ScriptBlock n={n} label={p.leadWithBenefits} size={size}>
      <BulletList items={script.benefits} />
    </ScriptBlock>
  );

  if (hasScript(script)) {
    return (
      <div data-layout="script">
        {goodFit}
        <ScriptBlock n={1} label={p.openingLine} size={size}>
          <OpeningLine text={script.opening} size={size} />
        </ScriptBlock>
        {benefits(2)}
        <ScriptBlock n={3} label={t.script.fullScript} size={size}>
          <SayBox text={script.fullScript} size={size} />
        </ScriptBlock>
        <ScriptBlock n={4} label={p.pushBack} size={size}>{pushBack}</ScriptBlock>
        <ScriptBlock n={5} label={p.nextAction} size={size}>
          <NextAction>{script.nextAction}</NextAction>
        </ScriptBlock>
      </div>
    );
  }

  if (place === 'drawer') {
    return (
      <div data-layout="no-script">
        {goodFit}
        {benefits(1)}
        <ScriptBlock n={2} label={p.pushBack} size={size}>{pushBack}</ScriptBlock>
        <ScriptNote>{t.script.drawerNoScript}</ScriptNote>
      </div>
    );
  }

  return (
    <div data-layout="no-script">
      {goodFit}
      <ScriptBlock n={1} label={p.openingLine} size={size}>
        <OpeningLine text={script.goodFit} size={size} />
      </ScriptBlock>
      {benefits(2)}
      <ScriptBlock n={3} label={p.pushBack} size={size}>{pushBack}</ScriptBlock>
      <ScriptBlock n={4} label={p.nextAction} size={size}>
        <NextAction>{t.script.pageNoScriptNext}</NextAction>
      </ScriptBlock>
    </div>
  );
}
