import {
  BulletList, NextAction, OpeningLine, SayBox, ScriptBlock, ScriptNote, ScriptText, type ScriptSize,
} from '@/components/plan/script-blocks';
import { PushBackBox } from '@/components/plan/push-back-box';
import { hasScript, PROTOTYPE_COPY, type CatalogScript } from '@/lib/product-catalog';

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
 */
export function ProductScript({ script, place }: { script: CatalogScript; place: 'page' | 'drawer' }) {
  const size: ScriptSize = place;
  const pushBack = (
    <PushBackBox
      size={size}
      theySayLabel={PROTOTYPE_COPY.theySay}
      theySay={script.objectionTheySay}
      youSayLabel={PROTOTYPE_COPY.youSay}
      youSay={script.objectionYouSay}
    />
  );
  const goodFit = (
    <ScriptBlock n={0} label={PROTOTYPE_COPY.goodFitFor} lead size={size}>
      <ScriptText>{script.goodFit}</ScriptText>
    </ScriptBlock>
  );
  const benefits = (n: number) => (
    <ScriptBlock n={n} label={PROTOTYPE_COPY.leadWithBenefits} size={size}>
      <BulletList items={script.benefits} />
    </ScriptBlock>
  );

  if (hasScript(script)) {
    return (
      <div data-layout="script">
        {goodFit}
        <ScriptBlock n={1} label={PROTOTYPE_COPY.openingLine} size={size}>
          <OpeningLine text={script.opening} size={size} />
        </ScriptBlock>
        {benefits(2)}
        <ScriptBlock n={3} label={PROTOTYPE_COPY.fullScript} size={size}>
          <SayBox text={script.fullScript} size={size} />
        </ScriptBlock>
        <ScriptBlock n={4} label={PROTOTYPE_COPY.pushBack} size={size}>{pushBack}</ScriptBlock>
        <ScriptBlock n={5} label={PROTOTYPE_COPY.nextAction} size={size}>
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
        <ScriptBlock n={2} label={PROTOTYPE_COPY.pushBack} size={size}>{pushBack}</ScriptBlock>
        <ScriptNote>{PROTOTYPE_COPY.drawerNoScript}</ScriptNote>
      </div>
    );
  }

  return (
    <div data-layout="no-script">
      {goodFit}
      <ScriptBlock n={1} label={PROTOTYPE_COPY.openingLine} size={size}>
        <OpeningLine text={script.goodFit} size={size} />
      </ScriptBlock>
      {benefits(2)}
      <ScriptBlock n={3} label={PROTOTYPE_COPY.pushBack} size={size}>{pushBack}</ScriptBlock>
      <ScriptBlock n={4} label={PROTOTYPE_COPY.nextAction} size={size}>
        <NextAction>{PROTOTYPE_COPY.planNoScriptNext}</NextAction>
      </ScriptBlock>
    </div>
  );
}
