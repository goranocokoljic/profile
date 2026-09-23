// zod 4 from the `zod` package, not the zod 3 re-exported by `astro/zod`.
import { z } from 'zod';

// Mirrors `window.siteCopy` in design-reference/site/content.js, plus `pages`
// (page-level strings) and `markup` (strings and links the reference hard-codes
// in index.html). Only content.js keys are checked verbatim against the reference. Objects are
// strict, so a missing or misspelt key fails the parse and names the path.

const text = z.string().min(1);
const pair = z.tuple([text, text]);

const titled = z.strictObject({ title: text, body: text });
// An image's text alternative and its visible caption.
const figure = z.strictObject({ alt: text, caption: text });

const nav = z.strictObject({
  work: text,
  build: text,
  about: text,
  contact: text,
  cv: text,
});

const hero = z.strictObject({
  eyebrow: text,
  headlineStart: text,
  headlineEmphasis: text,
  supporting: text,
  primary: text,
  secondary: text,
  cv: text,
  buildNote: text,
});

const roleFit = z.strictObject({
  title: text,
  intro: text,
  items: z.array(titled).min(1),
});

const selected = z.strictObject({
  label: text,
  items: z
    .array(
      z.strictObject({
        number: text,
        title: text,
        href: z.string().regex(/^#[\w-]+$/),
      }),
    )
    .min(1),
});

const platform = z.strictObject({
  eyebrow: text,
  title: text,
  intro1: text,
  intro2: text,
  shiftTitle: text,
  shiftBody: text,
  ownershipTitle: text,
  ownershipBody: text,
  closing: text,
  roleLabels: z.array(text).min(1),
  diagram: z.strictObject({
    label: text,
    portals: z.array(text).min(1),
    coreTitle: text,
    coreDetail: text,
    foundation: z.array(text).min(1),
  }),
  metrics: z
    .array(z.strictObject({ value: text, label: text, note: text.optional() }))
    .min(1),
});

const ai = z.strictObject({
  eyebrow: text,
  title: text,
  intro1: text,
  intro2: text,
  devLabel: text,
  devTitle: text,
  devBody: text,
  devFlow: z.array(text).min(1),
  contextLabel: text,
  contextTitle: text,
  contextBody: text,
  contextLink: text,
  reviewLabel: text,
  reviewTitle: text,
  reviewBody: text,
  lenses: z.array(text).min(1),
  finished: text,
  finishedBody: text,
  limitsLabel: text,
  limitsTitle: text,
  limitsBody: text,
  controls: z.array(pair).min(1),
  qaLabel: text,
  qaTitle: text,
  qaBody: text,
  qaFlow: z.array(text).min(1),
  qaPrinciples: z.array(titled).min(1),
  findingsLabel: text,
  findingsTitle: text,
  findings: z.array(text).min(1),
  ownershipTitle: text,
  ownershipBody: text,
  closing: text,
});

const vismedic = z.strictObject({
  eyebrow: text,
  title: text,
  intro: text,
  meta: z.array(pair).min(1),
  archiveLabel: text,
  realTitle: text,
  realBody: text,
  hipaa: text,
  recognition: z.array(pair).min(1),
  closing: text,
});

const buildStory = z.strictObject({
  eyebrow: text,
  title: text,
  intro: text,
  // Lengths pinned: the section lays these out as 3 and 8 grid columns.
  triad: z.array(text).length(3),
  flow: z.array(text).length(8),
  body: text,
  trailTitle: text,
  trailNote: text,
  // [label, value]. The value is an empty placeholder in the reference; the
  // build-record data fills it at build time. Five: the card's KPI grid has
  // five columns, in this order: tasks, successful runs, findings, wall time,
  // billed cost.
  metrics: z.array(z.tuple([text, z.string()])).length(5),
  cta: text,
});

const background = z.strictObject({
  eyebrow: text,
  title: text,
  paragraphs: z.array(text).min(1),
  cv: text,
});

const contact = z.strictObject({
  title: text,
  supporting: text,
  cv: text,
  github: text,
  purecontext: text,
  linkedin: text,
  // Also the mailto: target.
  email: z.email(),
  location: text,
  footer: text,
});

// Not in content.js: the reference hard-codes its <title>, and /build has no
// reference copy yet. Kept here so pages hold no strings of their own.
const pages = z.strictObject({
  // `description` feeds <meta name="description"> and the og:/twitter: share tags.
  home: z.strictObject({ title: text, description: text }),
  build: z.strictObject({
    title: text,
    description: text,
    eyebrow: text,
    heading: text,
    // The intro above the dashboard: what tr-harness is and the issue→merge
    // loop; then what is real vs estimated and where the second dataset is from.
    intro: z.tuple([text, text]),
    // The <noscript> fallback: the site dataset's runs as a plain table.
    noscript: z.strictObject({
      caption: text,
      columns: z.strictObject({ issue: text, outcome: text, duration: text, billed: text }),
    }),
    // Build-record dashboard: the empty state and the dataset switch.
    empty: text,
    datasetLabel: text,
    datasets: z.strictObject({ site: text, toprope: text }),
    // Sub-line under the review-findings KPI on /build and on the homepage
    // card: "n blocker/high · n medium · n low/style"; `fixed` is the card's
    // second line, "n fixed before merge".
    findingsBreakdown: z.strictObject({ blocker: text, medium: text, low: text, fixed: text }),
    // Footnotes the dashboard shows: under the KPI row, and under the cycle-1
    // trend chart per dataset. The site's sentence carries no run count: the
    // dataset grows and a typed number would go stale.
    footnotes: z.strictObject({
      kpis: text,
      trend: z.strictObject({ site: text.regex(/^\D*$/, 'no digits: the site run count is derived, never typed'), toprope: text }),
    }),
  }),
  // og:image:alt for the share image every page uses.
  shareImageAlt: text,
});

// Not in content.js: strings and links the reference writes into index.html,
// plus text alternatives this site adds for assistive tech.
const markup = z.strictObject({
  monogram: text,
  homeLabel: text,
  navLabel: text,
  portraitAlt: text,
  // Visually hidden summary of the platform-evolution diagram.
  platformDiagramSummary: text,
  // Site-relative file path, e.g. /goran-ocokoljic-cv.pdf.
  cvHref: z.string().regex(/^\/[\w.-]+(\/[\w.-]+)*$/),
  pureContextHref: z.url({ protocol: /^https$/ }),
  githubHref: z.url({ protocol: /^https$/ }),
  linkedinHref: z.url({ protocol: /^https$/ }),
  // Link text of the CV line at the end of the background section.
  backgroundCvLink: text,
  // Visually hidden suffix on links that open in a new tab.
  newTabLabel: text,
  // PureContext tool names the reference hard-codes as pills on the context card.
  changeSafetyLoop: z.array(text).min(1),
  // The three VisMedic archive screenshots. Keyed, not a list: the component
  // pairs each key with its image and the grid lays out exactly three figures.
  vismedicArchive: z.strictObject({ consultation: figure, booking: figure, calendar: figure }),
  vismedicAward: figure,
  // The build-record card on the homepage: the reference's "BUILD RECORD"
  // label, then strings the reference has no copy for (it shows no data).
  buildRecord: z.strictObject({
    label: text,
    latest: text,
    pr: text,
    // The button that shows and hides the last runs.
    showRuns: text,
    hideRuns: text,
    runsCaption: text,
    columns: z.strictObject({ issue: text, outcome: text, billed: text }),
    empty: text,
  }),
});

export const SiteSchema = z.strictObject({
  nav,
  hero,
  roleFit,
  selected,
  platform,
  ai,
  vismedic,
  buildStory,
  background,
  contact,
  pages,
  markup,
});

export type Site = z.infer<typeof SiteSchema>;
