// Shared across all twelve policy-system routes so heading treatment stays
// identical everywhere rather than being hand-tuned per page.
export const POLICY_HEADING_FONT = 'font-[family-name:var(--font-league-spartan)] font-bold'
export const POLICY_BODY_FONT = 'font-[family-name:var(--font-source-sans-3)]'

// text-2xl in this project's type scale is 1.75rem (28px), non-responsive
// here on purpose: --edu-teal only clears AA at 24px and above, so section
// headings must never shrink below that at any breakpoint.
export const POLICY_SECTION_HEADING = `${POLICY_HEADING_FONT} text-2xl text-edu-teal`
export const POLICY_TITLE = `${POLICY_HEADING_FONT} text-3xl text-edu-navy`
