// The WISHOP mark: a W drawn as one continuous thread ("le fil"), with a
// saffron lozenge on its middle peak. Same drawing as the landing page logo
// (public/landing/index.html) so the app and the site share one identity.
// The W follows currentColor; the lozenge keeps the brand saffron.
export function WishopMark({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 -2 48 44" aria-hidden="true" className={className}>
      <polyline
        points="4,9 14,33 24,17 34,33 44,9"
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        strokeMiterlimit={4}
      />
      <path d="M24 0l5 5-5 5-5-5z" fill="#F4B63F" />
    </svg>
  );
}
