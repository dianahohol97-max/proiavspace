import type { Author } from '@/lib/blog/authors'
import { initials } from '@/lib/blog/authors'

/** Author portrait, or her initials until a photo is added to authors.ts. */
export function AuthorAvatar({ author, size = 40 }: { author: Author; size?: number }) {
  if (author.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- images are unoptimized site-wide
      <img
        src={author.photo}
        alt={author.name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-[#eef1ff] font-brand font-semibold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(author.name)}
    </span>
  )
}
