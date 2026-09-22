// zod 4 from the `zod` package, not the zod 3 re-exported by `astro/zod`.
import { z } from 'zod';

// Mirrors `window.siteCopy` in design-reference/site/content.js, plus a `pages`
// block for page-level strings the reference keeps in its HTML. Objects are
// strict, so a missing or misspelt key fails the parse and names the path.

const text = z.string().min(1);
const pair = z.tuple([text, text]);

const titled = z.strictObject({ title: text, body: text });

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
  triad: z.array(text).min(1),
  flow: z.array(text).min(1),
  body: text,
  trailTitle: text,
  trailNote: text,
  // [label, value]. The value is an empty placeholder in the reference; the
  // build-record data fills it at build time.
  metrics: z.array(z.tuple([text, z.string()])).min(1),
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
  email: text,
  location: text,
  footer: text,
});

// Not in content.js: the reference hard-codes its <title>, and /build has no
// reference copy yet. Kept here so pages hold no strings of their own.
const pages = z.strictObject({
  home: z.strictObject({ title: text }),
  build: z.strictObject({ title: text, heading: text, empty: text }),
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
});

export type Site = z.infer<typeof SiteSchema>;
