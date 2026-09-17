import type { GradingService, Listing } from '../shared/types'

// A drawn grading holder around the listing photo: label (title, grade, cert) over a clear
// window. Labels are generic stand-ins coloured per service, never the services' real artwork.
// Sizes use container units, so one component works as a small tile and on the listing page.

const LABEL: Record<GradingService, string> = {
  PCGS: 'border-t-[#1d3f8a]',
  NGC: 'border-t-[#1a2a44]',
  PSA: 'border-t-[#c8102e]',
  BGS: 'border-t-[#8a8d93]',
  CGC: 'border-t-[#0a6a9e]',
}

/** "PCGS MS-65" → "MS-65"; "PSA 9" → "9". The service is printed separately on the label. */
const gradeOnly = (l: Listing) =>
  l.grade?.replace(new RegExp(`^${l.service}\\s*`), '') ?? ''

export function Slab({
  listing: l,
  className = '',
}: {
  listing: Listing
  className?: string
}) {
  const coin = l.category === 'coin'
  const photo = (
    <img
      src={l.imageUrl}
      alt={l.title}
      loading="lazy"
      className={
        coin
          ? 'size-full object-contain [clip-path:circle(closest-side)]'
          : 'size-full object-contain'
      }
    />
  )

  // A real slab photo: show the whole holder, uncropped.
  if (l.photoShowsSlab)
    return (
      <img
        src={l.imageUrl}
        alt={l.title}
        loading="lazy"
        className={`size-full object-contain ${className}`}
      />
    )

  // Raw: no holder. Coins sit bare; cards sit in a plain toploader.
  if (!l.graded || !l.service)
    return (
      <div
        className={`@container grid size-full grid-rows-[minmax(0,1fr)] place-items-center ${className}`}
      >
        {coin ? (
          <div className="size-[85%]">{photo}</div>
        ) : (
          <div className="aspect-[5/7] h-full min-h-0 max-w-full rounded-[1.5cqw] border border-[#d5d8de] bg-white/60 p-[3cqw] shadow-hair">
            {photo}
          </div>
        )}
      </div>
    )

  // The holder is the container, so the label scales with the holder, not the box around it.
  return (
    <div
      className={`grid size-full grid-rows-[minmax(0,1fr)] place-items-center ${className}`}
    >
      <div
        className={`h-full max-w-full rounded-[7%/4.5%] border border-[#c3c7ce] bg-[linear-gradient(160deg,#fdfdfe,#e8eaee_55%,#f5f6f8)] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.9),0_1px_2px_rgb(18_20_24/0.12)] ${coin ? 'aspect-[5/8]' : 'aspect-[3/5]'}`}
      >
        <div className="@container size-full">
          <div className="flex size-full flex-col gap-[3cqw] p-[4cqw]">
            <div
              className={`money grid grid-cols-[1fr_auto] items-center gap-x-[3cqw] rounded-[1.5cqw] border-t-[2.5cqw] bg-white px-[4cqw] py-[2.5cqw] leading-tight text-[#121418] ${LABEL[l.service]}`}
            >
              <p className="line-clamp-2 min-w-0 text-[5.5cqw] font-semibold">
                {l.title}
              </p>
              <p className="row-span-2 text-right font-display text-[9cqw] font-bold whitespace-nowrap">
                {gradeOnly(l)}
              </p>
              <p className="min-w-0 truncate text-[4.5cqw] text-[#5d6270]">
                <span className="font-bold tracking-wide text-[#121418]">
                  {l.service}
                </span>
                {l.certNumber && ` #${l.certNumber}`}
              </p>
            </div>
            <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] place-items-center overflow-hidden rounded-[2cqw] bg-[#f3f4f6] p-[5cqw] shadow-[inset_0_1px_3px_rgb(18_20_24/0.15)]">
              {photo}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
