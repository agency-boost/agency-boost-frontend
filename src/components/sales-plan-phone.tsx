'use client';

import Link from 'next/link';
import type { Ref } from 'react';
import { TEXT_TAP } from '@/components/ui/phone';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { planMessages } from '@/i18n/messages/plan';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import { salesAttackPlanMessages } from '@/i18n/messages/sales-attack-plan';
import { cn } from '@/lib/cn';
import {
  categoryLabel, channelLabel, fitNote, hasScript, needLabel, PRODUCT_CATALOG_HREF,
  type AttackPlan, type CatalogProduct,
} from '@/lib/product-catalog';
import {
  NavyHead, NavyTag, NavyVerdict, PhoneBenefits, PhoneBubbles, PhoneMore, PhoneQuote, PhoneScript, PhoneSection,
} from '@/components/plan/phone-plan';

/**
 * **The Sales Attack Plan's second step on a phone** (UI V1, UI-107; `attack-plan-mobile` 3; Mobile only): the product in
 * a navy card — its need and channel, the verdict, its name, its line and *Cocok untuk* — then **five numbered sections**:
 * *Kalimat pembuka*, *Tekankan manfaat berikut* (four, then *Lihat n manfaat lagi*), *Script lengkap* folded until *Baca
 * semua*, *Jika ada keberatan* as two bubbles, *Tindakan berikutnya*; then the brief's other matches as chips and
 * *Lihat di Product Catalog ›*. The same fields the wider plan draws (`ProductScript`), in the same order.
 *
 * **Without an authored script** the plan opens with *Cocok untuk* as its line and its next action says so, as the wider
 * page does (D-noscript). Every field is the server's — the office's approved words or the company's, in the reader's
 * language where they are still the platform's (UI-107) — and is rendered as text.
 */
export function PhoneSalesPlan({ product, plan, headingRef, onSwitch }: {
  product: CatalogProduct;
  /** The plan for a brief, or `null` for the catalog's deep link (no fit, no alternatives). */
  plan: AttackPlan | null;
  headingRef?: Ref<HTMLHeadingElement>;
  onSwitch: (code: string) => void;
}) {
  const t = useMessages(salesAttackPlanMessages);
  const p = useMessages(planMessages);
  const c = useMessages(productCatalogMessages);
  const language = useLanguage();
  const script = product.script;
  const runOff = product.lifecycle === 'closed_to_new_business';
  // The verdict's precedence, as the wider pill's (`Overall.html:9660-9667`): run-off, then the fit, else *Dari katalog*.
  const verdict = runOff
    ? <NavyVerdict tone="neutral">{c.runOff}</NavyVerdict>
    : plan
      ? (plan.verdict === 'good_fit'
        ? <NavyVerdict tone="good">{t.goodFit}</NavyVerdict>
        : <NavyVerdict tone="check">{t.checkFit}</NavyVerdict>)
      : <NavyVerdict tone="neutral">{t.fromCatalog}</NavyVerdict>;
  const note = runOff ? t.runOff : plan?.verdict === 'check_fit' ? fitNote(plan.outside, language) : null;
  const scripted = hasScript(script);

  return (
    <div data-layout="phone-plan">
      <NavyHead
        tags={(
          <>
            <NavyTag>{needLabel(product.needs[0], language) ?? categoryLabel(product.category.code, language) ?? product.category.label}</NavyTag>
            <NavyTag>{channelLabel(product.channel, language)}</NavyTag>
          </>
        )}
        verdict={verdict}
        title={product.name}
        headingRef={headingRef}
        line={product.tagline}
        fitLabel={p.goodFitFor}
        fit={script.goodFit}
        note={note}
      />
      <PhoneSection n={1} label={p.openingLine}>
        <PhoneQuote text={scripted ? script.opening : script.goodFit} />
      </PhoneSection>
      <PhoneSection n={2} label={p.leadWithBenefits}>
        <PhoneBenefits items={script.benefits} />
      </PhoneSection>
      {scripted && (
        <PhoneSection n={3} label={c.script.fullScriptShort}>
          <PhoneScript text={script.fullScript} />
        </PhoneSection>
      )}
      <PhoneSection n={scripted ? 4 : 3} label={p.pushBack}>
        <PhoneBubbles theySay={script.objectionTheySay} youSay={script.objectionYouSay} />
      </PhoneSection>
      <PhoneSection n={scripted ? 5 : 4} label={p.nextAction}>
        <p className="m-0 text-base leading-snug text-ink">{scripted ? script.nextAction : c.script.pageNoScriptNext}</p>
      </PhoneSection>
      {plan && plan.alternatives.length > 0 && (
        <PhoneSection label={t.alsoFits}>
          <div className="flex flex-wrap gap-1.5">
            {plan.alternatives.map((a) => (
              <button
                key={a.code}
                type="button"
                onClick={() => onSwitch(a.code)}
                className={cn(
                  'relative flex h-9 items-center rounded-pill bg-hover-row px-3 text-base font-semibold text-ink',
                  "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
                )}
              >
                {a.name}
              </button>
            ))}
          </div>
          <Link href={PRODUCT_CATALOG_HREF} className={cn('inline-flex rounded-sm', TEXT_TAP)}>
            <PhoneMore>{t.seeInCatalog}</PhoneMore>
          </Link>
        </PhoneSection>
      )}
    </div>
  );
}
