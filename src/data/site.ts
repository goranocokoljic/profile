import { SiteSchema } from './site.schema';

// Copy from design-reference/site/content.js, verbatim. Do not reword here;
// copy changes start in the reference. `pages` is the only addition.
export const site = SiteSchema.parse({
  nav: { work:'Work', build:'How this was built', about:'About', contact:'Contact', cv:'Download CV' },
  hero: {
    eyebrow:'LEAD WEB ENGINEER · APPLICATION',
    headlineStart:'I turn organically grown web systems into',
    headlineEmphasis:'platforms other people can ship on.',
    supporting:'Hands-on architect. 20+ high-traffic portals moved onto one shared platform, a telehealth product used by real doctors and patients, and AI delivery systems where agents implement, review and verify — with the run data to prove it.',
    primary:'See the work', secondary:'See how this page was built', cv:'Download CV',
    buildNote:'This page was implemented by tr-harness, an autonomous development harness I designed. The build record is at the bottom.'
  },
  roleFit: {
    title:'Why this role, specifically',
    intro:'Three things in the role map directly onto work I have already done, and one is the reason I am applying at all.',
    items:[
      {title:'Unify what has grown organically',body:'I did exactly this for a portfolio of 20+ news portals: repeated per-site implementations became one shared Vue/Nuxt platform, without slowing the products running on it. The pattern transfers to React and Astro; the framework was never the hard part.'},
      {title:'“Far beyond insurance”',body:'A nomad in Bali with a stomach bug does not want a claims form, they want a doctor on a call within the hour. I have built that product. VisMedic was a telehealth platform used by real doctors and patients through private healthcare providers.'},
      {title:'Let the whole team ship safely',body:'I am building Toprope, a product that monitors and improves AI adoption in engineering organisations, and tr-harness, the autonomous harness that builds it. Independent review, state verification, bounded retries and telemetry are the same guardrails that let non-engineers contribute without lowering the bar.'},
      {title:'AI agents, daily, with evidence',body:'Claude Code every day. Two harnesses and an MCP server built with it, over 100 recorded runs with cost and outcome per task. This application is one of those runs.'}
    ]
  },
  selected: { label:'SELECTED WORK', items:[
    {number:'01',title:'Platform Engineering',href:'#platform'},
    {number:'02',title:'AI Engineering · tr-harness & PureContext',href:'#ai'},
    {number:'03',title:'VisMedic · Telehealth',href:'#vismedic'}
  ]},
  platform: {
    eyebrow:'01 · PLATFORM ENGINEERING',
    title:'20+ live portals, one shared platform, no pause for the business.',
    intro1:'I architected and led the shared web platform for a portfolio of high-traffic publishing products. News Theme grew into a configurable Vue/Nuxt framework powering 20+ portals, replacing portal-by-portal implementations with shared routing, components, APIs and infrastructure.',
    intro2:'These were live products serving millions of pageviews a day, so the platform had to evolve underneath them. Modernising the stack also meant modernising delivery: mandatory review, automated quality gates, front-end testing and CI/CD became part of the system rather than optional team practice.',
    shiftTitle:'The important shift wasn’t Vue or Nuxt.', shiftBody:'It was moving repeated product problems into a shared system multiple teams could evolve together. That is a React Router or Astro problem exactly as much as a Nuxt one.',
    ownershipTitle:'Between architecture and implementation.', ownershipBody:'I set technical direction, work hands-on on the difficult parts, and turn decisions into patterns other engineers can build on.',
    closing:'Platform work does not remove complexity. It puts complexity in the right place so product teams stop solving the same problem twice.',
    roleLabels:['ARCHITECTURE','HANDS-ON','PERFORMANCE','DELIVERY','CROSS-TEAM DIRECTION'],
    diagram:{ label:'PLATFORM EVOLUTION', portals:['Portal 1','Portal 2','Portal 3','…','Portal 20+'], coreTitle:'Shared News Theme Platform', coreDetail:'CMS-driven routing · configurable components · server middleware · headless APIs · shared conventions', foundation:['Routing','Components','APIs','Shared infrastructure'] },
    metrics:[ {value:'20+',label:'portals on one shared platform'}, {value:'30 → 95%',label:'desktop Core Web Vitals green URLs',note:'mobile: 20 → 55%'}, {value:'~50%',label:'shorter idea-to-production'} ]
  },
  ai: {
    eyebrow:'02 · AI ENGINEERING', title:'tr-harness and PureContext: AI inside the delivery loop, with guardrails.',
    intro1:'tr-harness is an autonomous development harness I built to develop Toprope, my AI-adoption product, task by task. It takes a GitHub issue through implementation, independent review, fixes, state verification and merge, and records what every run cost and whether it succeeded.',
    intro2:'PureContext is the MCP server underneath it: token-efficient code context for agents, plus a change-safety loop (prepare → edit → verify → compare impact) so an agent knows what it actually changed before anyone trusts it.',
    devLabel:'TR-HARNESS · FROM ISSUE TO MERGED PR', devTitle:'The agent gets the same brief an engineer would.',
    devBody:'A task with context, acceptance criteria, dependencies and architectural constraints. The agent explores the codebase, implements, runs the real build and tests, opens a pull request and responds to review findings.',
    devFlow:['GitHub issue','Understand context','Implement','Build & test','Open PR','Independent review','Fix findings','Verify state','Merge'],
    contextLabel:'PURECONTEXT · THE CONTEXT LAYER', contextTitle:'Agents should see the right code, not all of it.', contextBody:'PureContext delivers compact, relevant context to the agent and closes the loop on changes: what was prepared, what was edited, what the verified impact is. Built across 80+ iterations, benchmarked privately before any public claim.', contextLink:'PureContext on GitHub →',
    reviewLabel:'IMPLEMENTATION DOES NOT REVIEW ITSELF', reviewTitle:'Reviewers with no memory of writing the code.', reviewBody:'Isolated reviewer agents inspect a bounded diff from separate engineering perspectives. Detection happens outside the implementation context; fixes happen back inside it, where the original intent still lives.',
    lenses:['Maintainability','Security & correctness','Simplicity','Test adequacy','Reuse'],
    finished:'“Finished” is not something the agent gets to declare.', finishedBody:'The harness independently verifies repository and GitHub state before a task counts as complete.',
    limitsLabel:'AUTONOMY NEEDS LIMITS AND INSTRUMENTATION', limitsTitle:'Real runs found failure modes prompts don’t fix.', limitsBody:'So the system uses bounded review cycles, recovery paths, quarantine and escalation instead of retrying forever, and records time, cost and outcome for every task.',
    controls:[['Bounded cycles','Limited iterations per task'],['Recovery','Resume interrupted work'],['Quarantine','Isolate failed tasks'],['Escalation','Hand off at defined points'],['Telemetry','Time, cost, outcome']],
    qaLabel:'THE SAME APPROACH, APPLIED TO TESTING AT WORK', qaTitle:'Generated tests that prove they can fail.',
    qaBody:'For my current team I built a second multi-agent workflow: it reads requirements, observes the real application, surfaces discrepancies, then generates Playwright tests that are independently reviewed before they become trusted coverage.',
    qaFlow:['Requirements','Observe real behaviour','Surface discrepancies','Define cases','Generate tests','Prove they can fail','Review','Maintain'],
    qaPrinciples:[
      {title:'Never automate an ambiguity.',body:'If requirements and observed behaviour disagree, surface it rather than encode an assumption.'},
      {title:'Green is not proof.',body:'A generated test must demonstrate it can fail and verify the real outcome, not the indicator that claims success.'},
      {title:'Heal to the contract, not to green.',body:'Repair test drift; escalate real product changes and defects instead of weakening assertions.'}
    ],
    findingsLabel:'AN ANONYMISED REAL EXAMPLE', findingsTitle:'Before a single test was generated, behavioural analysis found…',
    findings:['entered state lost after a failed save','stale information remaining after deletion','invalid numeric boundaries being accepted','duplicate network activity from a single action','overlapping interface states creating ambiguous interaction'],
    ownershipTitle:'I build the system the agents work inside.', ownershipBody:'The work is not the clever prompt. It is the lifecycle, the context, the authority boundaries, the review model, the failure behaviour and the evidence required before automated work is trusted.',
    closing:'The goal is not to make AI write more code. It is an engineering system in which AI takes on more of the process without lowering the standard of the result.'
  },
  vismedic: {
    eyebrow:'03 · HEALTH-TECH · 2014–2016', title:'A telehealth product, end to end, used by real doctors and patients.',
    intro:'VisMedic connected patients with specialist physicians for remote consultations. I owned product direction, designed the experience and visual identity, and built much of the platform across front end and back end, including the real-time WebRTC consultation flow.',
    meta:[['ROLE','Lead Developer · Product Owner · CMO'],['STACK','HTML · SCSS · JavaScript · Python · Flask · MySQL · WebRTC'],['USERS','Patients · Doctors · Healthcare providers'],['DATA','Sensitive medical records and private consultations']],
    archiveLabel:'FROM THE PRODUCT ARCHIVE · 2015–2016',
    realTitle:'It went beyond the prototype stage.', realBody:'VisMedic was used by real doctors and patients through private healthcare providers including BelMedic and MediGroup, alongside several smaller clinics.', hipaa:'Built around sensitive medical information and private consultations; designed to HIPAA requirements.',
    recognition:[['Ring Serbia 2016','Best Startup in Serbia'],['Catch Pitch Challenge 2016','First Prize'],['Ring Balkans 2016','Runner-up (unofficial)'],['Pioneers of the Balkans','Finalist']],
    closing:'When software sits between a person and something they genuinely care about, complexity has to disappear on the user’s side — even when it remains considerable underneath.'
  },
  buildStory: {
    eyebrow:'HOW THIS PAGE WAS BUILT', title:'This application was built as software.',
    intro:'I wrote the intent, content, visual direction, architecture and acceptance criteria. tr-harness executed the implementation against them, with independent review and verification on every task.',
    triad:['HUMAN INTENT','AGENT EXECUTION','INDEPENDENT VERIFICATION'],
    flow:['Issue','Implement','Build & test','PR','Review','Fix','Verify','Merge'],
    body:'The agent does the engineering work; the harness controls the lifecycle and verifies that the expected repository and GitHub state actually exists.',
    trailTitle:'Every visible part of this page has a trail.',
    trailNote:'Issues, pull requests, review cycles, wall time and model cost, exported from the real build.',
    metrics:[['TASKS COMPLETED',''],['SUCCESSFUL RUNS',''],['REVIEW FINDINGS',''],['WALL TIME',''],['MODEL COST','']],
    cta:'Inspect the full build →'
  },
  background: {
    eyebrow:'BACKGROUND', title:'Not a straight line from developer to architect.',
    paragraphs:[
      'I started in digital and creative work, kept writing software throughout, and over time engineering became the centre. Startups pulled me into full-stack ownership and architecture; shared platforms and engineering teams shifted my focus toward systems that make other engineers more effective; AI has extended that same direction. Even as my scope moved toward architecture and leadership I stayed close to implementation, because that is where assumptions become real constraints.'
    ],
    cv:'The full chronology is in my CV.'
  },
  contact: {
    title:'If this is the kind of engineer you are looking for, I would be glad to talk.',
    supporting:'Belgrade, so a full working day of overlap with German hours. Comfortable async, comfortable deciding with incomplete information, and happy to start as the only web engineer.',
    cv:'Download CV', github:'View GitHub', purecontext:'PureContext on GitHub', linkedin:'Connect on LinkedIn', email:'goran.ocokoljic@gmail.com', location:'Belgrade, Serbia · Remote / EU time zones', footer:'Written with intent. Implemented by tr-harness.'
  },
  pages: {
    home: { title:'Goran Ocokoljić — Lead Web Engineer' },
    build: { title:'Build record — Goran Ocokoljić', heading:'Build record', empty:'No runs recorded yet.' }
  }
});
