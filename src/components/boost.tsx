import { cn } from '@/lib/cn';

/**
 * **Boost, the mascot** (UI V1, UI-102; D-11, D-12): navy body, white face, navy shield-shaped hood, orange scarf,
 * the AgencyBoost mark on his belly — on a clean peach circle with a soft floor shadow, as exported in `public/brand/`.
 *
 * | Pose | Where (UI-102) |
 * |---|---|
 * | `pointing` | sign-in (~200px), onboarding (~160px) |
 * | `thinking` | a page or a list that is fully empty (96–120px), with one line and its main action (`EmptyState`) |
 * | `sleeping` | nothing logged, no data (96–150px): Home's 7-day chart, Activity with nothing this week |
 * | `celebrating` | success, a goal reached (96–120px): goal ≥ 100% on `/summary` |
 * | `phone` | the app icon and the link preview (UI-103, UI-101); with the others, Home's daily quote |
 *
 * **`sleeping` is cut from the presentation sheet** (`brand/boost-mascot-poses.webp`; UI V1 T16), which the report lists
 * as still to export. Its white ground is turned into transparency where it touches the edge, and the floor shadow's light
 * pink is told from the pillow's grey by its red. The pillow and his face stay opaque, the shadow stays soft and fades on
 * an ellipse, and the peach circle is the sheet's own. A designer's export replaces the files in place.
 *
 * Artwork, not an icon: no emoji stand in for him, and the line icons stay the UI's (UI-102). **Decorative by default**
 * (`alt=""`): he sits beside words that say what he means; a caller whose picture carries meaning passes `alt`.
 *
 * **A plain `<img>` with a `srcset`, not `next/image`**: each pose is exported at 120, 240 and 360px wide (`@1x`–`@3x`
 * of the sizes UI-102 names), WebP, 6–22 kB, beside the transparent PNG it came from — so a phone on 4G fetches the one
 * its screen needs, and the 38 screens that draw `EmptyState` carry no image component's script into the first load.
 */
export type BoostPose = 'thinking' | 'celebrating' | 'pointing' | 'phone' | 'sleeping';

/** Each pose's files in `public/brand/` — the transparent PNG and its WebP widths — and its proportions. */
const POSES: Record<BoostPose, { src: string; width: number; height: number }> = {
  thinking: { src: '/brand/boost-thinking.png', width: 354, height: 371 },
  celebrating: { src: '/brand/boost-celebrating.png', width: 405, height: 399 },
  pointing: { src: '/brand/boost-pointing.png', width: 381, height: 369 },
  phone: { src: '/brand/boost-phone.png', width: 353, height: 346 },
  sleeping: { src: '/brand/boost-sleeping.png', width: 595, height: 399 },
};

/** The widths each pose is exported at, as WebP: `boost-<pose>-<width>.webp`. */
export const BOOST_WIDTHS = [120, 240, 360] as const;

const srcSetOf = (src: string) =>
  BOOST_WIDTHS.map((w) => `${src.replace(/\.png$/, `-${w}.webp`)} ${w}w`).join(', ');

/** Home's daily quote, in its rotation order (UI-100: thinking → celebrating → pointing → phone). */
export const BOOST_QUOTE_POSES = ['thinking', 'celebrating', 'pointing', 'phone'] as const;

export function boostArt(pose: BoostPose) {
  return POSES[pose];
}

/**
 * **The three 3D icons** (UI-102: *only on the sign-in page and in empty states*): a bar chart, a calendar and a
 * checklist, cut from `brand/3d-icons.webp` as `sleeping` is. Only the glyph is cut: the white tile it sits on is drawn
 * by the caller as a card (`bg-card`, the token's white and shadow), so it is the app's card and not a picture of one.
 * Each glyph is a transparent PNG with 48, 96 and 144px WebP versions, 1–10 kB each.
 */
export type Brand3dIconName = 'chart' | 'calendar' | 'checklist';

const ICONS_3D: Record<Brand3dIconName, { src: string; width: number; height: number }> = {
  chart: { src: '/brand/icon3d-chart.png', width: 324, height: 288 },
  calendar: { src: '/brand/icon3d-calendar.png', width: 353, height: 346 },
  checklist: { src: '/brand/icon3d-checklist.png', width: 299, height: 332 },
};

/** The widths each 3D icon is exported at, as WebP: `icon3d-<name>-<width>.webp`. */
export const BRAND_3D_ICON_WIDTHS = [48, 96, 144] as const;

/** A 3D icon, `size` px wide; decorative (`alt=""`) — a card's words, where it has any, say what it means. */
export function Brand3dIcon({ name, size = 32, className }: { name: Brand3dIconName; size?: number; className?: string }) {
  const art = ICONS_3D[name];
  return (
    // Static artwork of known sizes, as `Boost` is.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={art.src}
      srcSet={BRAND_3D_ICON_WIDTHS.map((w) => `${art.src.replace(/\.png$/, `-${w}.webp`)} ${w}w`).join(', ')}
      sizes={`${size}px`}
      width={size}
      height={Math.round((size * art.height) / art.width)}
      alt=""
      aria-hidden
      decoding="async"
      data-icon-3d={name}
      className={cn('shrink-0 select-none', className)}
      draggable={false}
    />
  );
}

export function Boost({
  pose,
  size = 112,
  alt = '',
  priority = false,
  className,
}: {
  pose: BoostPose;
  /** His width, in px: 64 (Home's quote), 96–120 (an empty state), ~160–200 (onboarding, sign-in). */
  size?: number;
  alt?: string;
  /** Above the fold on the page it opens (sign-in): loaded first. */
  priority?: boolean;
  className?: string;
}) {
  const art = boostArt(pose);
  return (
    // Static artwork of known sizes, served as a `srcset` (above): no image component's script for it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={art.src}
      srcSet={srcSetOf(art.src)}
      sizes={`${size}px`}
      width={size}
      height={Math.round((size * art.height) / art.width)}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      data-boost={pose}
      className={cn('shrink-0 select-none', className)}
      draggable={false}
    />
  );
}
