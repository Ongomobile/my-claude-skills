# /create-landing-page

You are building a complete, production-ready client landing page. The user will provide a business document (PDF, text, or pasted notes). You will read it, apply the StoryBrand copywriting framework invisibly to write the copy, select a visual theme with the user, and generate a fully functional single-file landing page with a JSON-driven content system ready for Decap CMS.

---

## PHASE 0 — GATHER INPUT

### Step 1 — Get the business document

Ask the user:

> "Please share the client's business info. You can upload a PDF, paste a document, or just describe the business in your own words — anything works. The more detail the better, but even rough notes are fine."

Accept any of:
* An uploaded PDF file (read it with the Read tool)
* Pasted text (intake form, notes, website copy, bio, email)
* A freeform description typed directly in chat

If the document is missing any of these critical details, ask one short follow-up question to fill the gap (ask for all missing items at once, not one by one):
* Business name, phone, email, city/state
* What the business does and who their customers are
* What problems customers face and why they choose this business
* Their process for onboarding a new client (even roughly)

Do NOT ask about StoryBrand concepts. Do NOT use terms like "external problem," "philosophical injustice," or "guide." Extract that framing yourself from whatever the user provides.

### Step 2 — Theme selection

After receiving the document, present the theme options and ask the user to choose:

> "Got it! Now pick a visual theme for the page:"
>
> ```
> 1. industrial-dark   — Dark steel navy bg, orange accent. Manufacturing, trades, engineering.
> 2. clean-light       — White bg, blue accent, card-heavy. SaaS, professional services, tech.
> 3. navy-bold         — Deep navy bg, amber accent, bold layout. Maritime, logistics, finance.
> 4. luxury-minimal    — Full-bleed imagery, white overlay, serif feel. Premium, hospitality, design.
> 5. vibrant-teal      — Deep teal bg, amber accent, colorful cards. Travel, wellness, lifestyle.
> ```

---

## PHASE 1 — APPLY STORYBRAND FRAMEWORK (INTERNAL — DO NOT SHOW THE USER)

Before writing any copy, silently map the document content to the StoryBrand 7-part framework. The user never sees this step — it is your internal copywriting process.

| SB Element | Extract From Document | Maps To |
|------------|----------------------|---------|
| **Character** — what the customer wants | What outcome does the customer desire? What are they trying to achieve? | `hero.json → headline` — phrase as what the customer *gets*, not what the business *does* |
| **External Problem** — the visible issue | What practical problem does the customer face day-to-day? | `problem.json → cards[0]` |
| **Internal Problem** — the emotion | How does that problem make them feel? (frustrated, anxious, overwhelmed, embarrassed) | `problem.json → cards[1]` |
| **Philosophical Problem** — the injustice | Why is it wrong that they have to deal with this? What shouldn't have to be this hard? | `problem.json → cards[2]` — infer this if not stated directly |
| **Empathy** | Does the business understand the pain? Have they lived it? | `guide.json → empathyParagraph1` — write as "We understand..." |
| **Authority** | Credentials, years in business, number of clients, results achieved | `guide.json → empathyParagraph2` — write as proof, not boasting |
| **Plan** | How does a customer get started? What are the 3 simplest steps? | `plan.json → steps` — reduce perceived complexity |
| **CTA** | What action should the customer take? | Same verb used in hero, plan, stakes, footer |
| **Success** | What does life look like after working with this business? | `stakes.json → successItems` |
| **Failure** | What is the cost of NOT acting or going elsewhere? | `stakes.json → failureItems` — infer if not stated directly |

**Copywriting rules — apply these when writing all copy:**
* Use "you" more than "we" — the customer is the hero, the business is the guide
* Clarity over cleverness — no jargon, no buzzwords
* Headlines answer "what does the customer want?" — never "what does the business do?"
* Be specific: "24-hour turnaround" beats "fast delivery," "over 200 clients served" beats "experienced"
* One CTA verb used consistently across the entire page
* Empathy paragraph leads with the customer's pain, then transitions to the business's credentials
* Stakes section motivates without fear-mongering — show the positive transformation

---

## PHASE 2 — GENERATE CONTENT JSON FILES

Create the folder `content/` and write these 6 JSON files using the StoryBrand-mapped content:

### content/settings.json
```json
{
  "businessName": "[business name]",
  "logo": "[logo url or empty string]",
  "favicon": "",
  "accentColor": "[theme accent hex]",
  "phone": "[phone]",
  "email": "[email]",
  "address": "[city, state]",
  "footerTagline": "[tagline]",
  "copyrightYear": "2026",
  "gaId": ""
}
```

### content/hero.json
```json
{
  "tagline": "[short descriptor — what they do]",
  "headline": "[what the CUSTOMER wants — not what the business does]",
  "subheadline": "[the problem you solve, in one sentence, with a glimpse of hope]",
  "buttonText": "[CTA text]",
  "heroImage": "[hero bg image url or empty string]"
}
```

### content/problem.json
```json
{
  "sectionTagline": "The Challenge",
  "sectionHeadline": "[question that resonates with the pain — make them nod yes]",
  "intro": "[1–2 sentences showing you understand their situation]",
  "cards": [
    { "title": "[External Problem title]", "description": "[practical visible problem]" },
    { "title": "[Internal Problem title]", "description": "[the frustration/anxiety/embarrassment it causes]" },
    { "title": "[Philosophical Problem title]", "description": "[why this situation is unjust or wrong]" }
  ],
  "closingQuote": "You shouldn't have to [pain point]. [Empathy statement]."
}
```

### content/guide.json
```json
{
  "sectionTagline": "Your Partner",
  "sectionHeadline": "[We/I exist to help you {achieve the transformation}]",
  "empathyParagraph1": "[We understand {the frustration}. That's why we built {business name}.]",
  "empathyParagraph2": "[Authority/credentials sentence — years in business, clients served, specific achievement]",
  "guideImage": "",
  "servicesHeadline": "What We Do",
  "services": [
    { "title": "[Service 1]", "description": "[outcome-focused description]" },
    { "title": "[Service 2]", "description": "[outcome-focused description]" },
    { "title": "[Service 3]", "description": "[outcome-focused description]" },
    { "title": "[Service 4]", "description": "[outcome-focused description or remove if only 3]" }
  ],
  "promisesHeadline": "Our Three Promises",
  "promises": [
    { "title": "[Promise 1 — short]", "back": "[Specific proof or detail — what this looks like in practice]" },
    { "title": "[Promise 2 — short]", "back": "[Specific proof or detail]" },
    { "title": "[Promise 3 — short]", "back": "[Specific proof or detail]" }
  ]
}
```

### content/plan.json
```json
{
  "sectionTagline": "How It Works",
  "sectionHeadline": "[Get {desired outcome} in 3 Simple Steps]",
  "steps": [
    { "title": "[Step 1 — action verb + what they do]", "description": "[what happens next, what to expect]" },
    { "title": "[Step 2]", "description": "[what happens, reduce fear/uncertainty]" },
    { "title": "[Step 3 — the result]", "description": "[the transformation, the win]" }
  ],
  "ctaText": "[same CTA text as hero]"
}
```

### content/stakes.json
```json
{
  "sectionTagline": "What's at Stake",
  "sectionHeadline": "[The choice is clear — what kind of outcome do you want?]",
  "sectionDescription": "[1 sentence: the cost of waiting or doing nothing]",
  "failureTitle": "Without [Business Name]",
  "failureItems": [
    "[Failure outcome 1]",
    "[Failure outcome 2]",
    "[Failure outcome 3]",
    "[Failure outcome 4]",
    "[Failure outcome 5]"
  ],
  "successTitle": "With [Business Name]",
  "successItems": [
    "[Success outcome 1]",
    "[Success outcome 2]",
    "[Success outcome 3]",
    "[Success outcome 4]",
    "[Success outcome 5]"
  ],
  "closingStatement": "[One powerful sentence — the transformation in a nutshell]",
  "ctaText": "[same CTA text]"
}
```

---

## PHASE 3 — SELECT THEME VARIABLES

Based on the chosen theme, use these values throughout the HTML:

### Theme: industrial-dark
```
bg-body: #0f172a (slate-900)
bg-card: #1e293b (slate-800)
bg-section-alt: #111827 (gray-900)
accent: #f97316 (orange-500)
accent-hover: #ea6c10
text-primary: #f8fafc
text-muted: #94a3b8
font-heading: 'Bebas Neue', cursive
font-body: 'Inter', sans-serif
google-fonts: Bebas+Neue:wght@400|Inter:wght@300;400;500;600;700
border-color: rgba(249,115,22,0.3)
card-glow: rgba(249,115,22,0.1)
hero-overlay: rgba(15,23,42,0.75)
```

### Theme: clean-light
```
bg-body: #ffffff
bg-card: #f8fafc
bg-section-alt: #f1f5f9
accent: #2563eb (blue-600)
accent-hover: #1d4ed8
text-primary: #0f172a
text-muted: #64748b
font-heading: 'Plus Jakarta Sans', sans-serif
font-body: 'Inter', sans-serif
google-fonts: Plus+Jakarta+Sans:wght@600;700;800|Inter:wght@400;500;600
border-color: rgba(37,99,235,0.2)
card-glow: rgba(37,99,235,0.06)
hero-overlay: rgba(15,23,42,0.55)
```

### Theme: navy-bold
```
bg-body: #0a1628
bg-card: #0f2040
bg-section-alt: #071020
accent: #f59e0b (amber-500)
accent-hover: #d97706
text-primary: #f8fafc
text-muted: #94a3b8
font-heading: 'Oswald', sans-serif
font-body: 'Inter', sans-serif
google-fonts: Oswald:wght@500;600;700|Inter:wght@300;400;500;600
border-color: rgba(245,158,11,0.3)
card-glow: rgba(245,158,11,0.08)
hero-overlay: rgba(10,22,40,0.72)
```

### Theme: luxury-minimal
```
bg-body: #fafaf9
bg-card: #ffffff
bg-section-alt: #f5f5f4
accent: #292524 (stone-800)
accent-hover: #1c1917
text-primary: #1c1917
text-muted: #78716c
font-heading: 'Cormorant Garamond', serif
font-body: 'Inter', sans-serif
google-fonts: Cormorant+Garamond:wght@400;500;600;700|Inter:wght@400;500
border-color: rgba(41,37,36,0.15)
card-glow: rgba(41,37,36,0.04)
hero-overlay: rgba(0,0,0,0.40)
```

### Theme: vibrant-teal
```
bg-body: #0d4f4f
bg-card: #0f5f5f
bg-section-alt: #094040
accent: #f59e0b (amber-500)
accent-hover: #d97706
text-primary: #f0fdfa
text-muted: #99f6e4
font-heading: 'Playfair Display', serif
font-body: 'Inter', sans-serif
google-fonts: Playfair+Display:wght@500;600;700|Inter:wght@400;500;600
border-color: rgba(245,158,11,0.3)
card-glow: rgba(245,158,11,0.1)
hero-overlay: rgba(13,79,79,0.70)
```

---

## PHASE 4 — GENERATE index.html

Generate a complete, self-contained `index.html` using the exact structure below. Substitute all `[THEME_*]` placeholders with the selected theme values. The page fetches ALL content from JSON files — no hardcoded business content in the HTML.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title id="page-title">Loading...</title>
  <link rel="icon" id="favicon" href="" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=[THEME_GOOGLE_FONTS]&display=swap" rel="stylesheet" />
  <script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>

  <style type="text/tailwindcss">
    @theme {
      --color-accent: [THEME_ACCENT];
      --color-accent-hover: [THEME_ACCENT_HOVER];
      --color-body: [THEME_BG_BODY];
      --color-card: [THEME_BG_CARD];
      --color-section-alt: [THEME_BG_SECTION_ALT];
      --color-text-primary: [THEME_TEXT_PRIMARY];
      --color-text-muted: [THEME_TEXT_MUTED];
      --font-heading: [THEME_FONT_HEADING];
      --font-body: [THEME_FONT_BODY];
    }

    html { scroll-behavior: smooth; }

    body {
      background-color: var(--color-body);
      color: var(--color-text-primary);
      font-family: var(--font-body);
      overflow-x: hidden;
    }

    h1, h2, h3, .font-heading {
      font-family: var(--font-heading);
      text-wrap: balance;
    }

    /* === Animations === */
    [data-animate] {
      opacity: 0;
      transform: translateY(28px);
      transition: opacity 0.65s ease, transform 0.65s ease;
    }
    [data-animate].visible {
      opacity: 1;
      transform: translateY(0);
    }
    [data-animate][data-delay="1"] { transition-delay: 0.1s; }
    [data-animate][data-delay="2"] { transition-delay: 0.2s; }
    [data-animate][data-delay="3"] { transition-delay: 0.3s; }
    [data-animate][data-delay="4"] { transition-delay: 0.4s; }
    [data-animate][data-delay="5"] { transition-delay: 0.5s; }

    /* === Hero Parallax === */
    #hero {
      position: relative;
      overflow: hidden;
    }
    #hero-bg {
      position: absolute;
      inset: -10%;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      will-change: transform;
    }
    #hero-overlay {
      position: absolute;
      inset: 0;
      background: [THEME_HERO_OVERLAY];
    }

    /* === Sparks === */
    .sparks {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .spark {
      position: absolute;
      width: 2px;
      height: 2px;
      border-radius: 50%;
      background: var(--color-accent);
      animation: spark-float var(--dur, 4s) var(--delay, 0s) infinite ease-in-out;
      opacity: 0;
    }
    @keyframes spark-float {
      0%   { opacity: 0; transform: translateY(0) scale(0); }
      15%  { opacity: 0.9; }
      85%  { opacity: 0.4; }
      100% { opacity: 0; transform: translateY(-80px) scale(1.5); }
    }

    /* === Navbar === */
    #navbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 50;
      transition: background 0.3s, box-shadow 0.3s;
    }
    #navbar.scrolled {
      background: var(--color-body);
      box-shadow: 0 1px 12px rgba(0,0,0,0.35);
    }

    /* === Cards === */
    .card {
      background: var(--color-card);
      border: 1px solid [THEME_BORDER_COLOR];
      border-radius: 1rem;
      transition: transform 0.3s, box-shadow 0.3s;
    }
    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 36px [THEME_CARD_GLOW];
    }

    /* === Accent Button === */
    .btn-accent {
      display: inline-block;
      background: var(--color-accent);
      color: var(--color-body);
      font-weight: 700;
      padding: 0.8rem 2rem;
      border-radius: 0.5rem;
      text-decoration: none;
      transition: background 0.2s, transform 0.2s;
      cursor: pointer;
      border: none;
      font-family: var(--font-body);
      font-size: 1rem;
    }
    .btn-accent:hover {
      background: var(--color-accent-hover);
      transform: translateY(-2px);
    }

    /* === Pulse Glow on CTA === */
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 0 0 transparent; }
      50% { box-shadow: 0 0 24px 8px [THEME_CARD_GLOW]; }
    }
    .btn-accent.pulse { animation: pulse-glow 2.5s ease-in-out infinite; }

    /* === Flip Cards === */
    .flip-card { perspective: 900px; cursor: pointer; }
    .flip-inner {
      position: relative;
      width: 100%;
      height: 180px;
      transform-style: preserve-3d;
      transition: transform 0.55s ease;
    }
    .flip-card:hover .flip-inner,
    .flip-card.flipped .flip-inner { transform: rotateY(180deg); }
    .flip-front, .flip-back {
      position: absolute;
      inset: 0;
      backface-visibility: hidden;
      border-radius: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      text-align: center;
    }
    .flip-front {
      background: var(--color-card);
      border: 1px solid [THEME_BORDER_COLOR];
    }
    .flip-back {
      background: var(--color-accent);
      color: var(--color-body);
      transform: rotateY(180deg);
      font-size: 0.9rem;
      font-weight: 500;
    }

    /* === Plan Step Line === */
    .step-connector {
      position: absolute;
      top: 2rem;
      left: calc(50% + 2rem);
      right: calc(-50% + 2rem);
      height: 2px;
      background: linear-gradient(to right, var(--color-accent), transparent);
    }

    /* === Stakes Section === */
    .failure-item::before { content: "✗  "; color: #ef4444; font-weight: 700; }
    .success-item::before { content: "✓  "; color: #22c55e; font-weight: 700; }

    /* === Modal === */
    #quote-modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.75);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }
    #quote-modal.open { display: flex; }

    /* === Mobile Menu === */
    #mobile-menu { display: none; }
    #mobile-menu.open { display: block; }
  </style>
</head>
<body>

<!-- ═══════════════════════════════════════════ NAVBAR -->
<nav id="navbar" class="px-6 py-4">
  <div class="max-w-6xl mx-auto flex items-center justify-between">
    <a href="#" class="flex items-center gap-3">
      <img id="nav-logo" src="" alt="" class="h-10 hidden" />
      <span id="nav-brand" class="font-heading text-2xl" style="color:var(--color-accent)"></span>
    </a>
    <div class="hidden md:flex items-center gap-8">
      <a href="#problem" class="text-sm hover:opacity-80" style="color:var(--color-text-muted)">The Challenge</a>
      <a href="#guide" class="text-sm hover:opacity-80" style="color:var(--color-text-muted)">About Us</a>
      <a href="#plan" class="text-sm hover:opacity-80" style="color:var(--color-text-muted)">How It Works</a>
      <button onclick="openModal()" class="btn-accent text-sm px-5 py-2" id="nav-cta">Request a Quote</button>
    </div>
    <button id="hamburger" class="md:hidden p-2" onclick="toggleMenu()" aria-label="Menu">
      <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
  </div>
  <div id="mobile-menu" class="md:hidden px-4 pb-4 mt-2 space-y-3" style="background:var(--color-body)">
    <a href="#problem" class="block py-2 text-sm" style="color:var(--color-text-muted)" onclick="closeMenu()">The Challenge</a>
    <a href="#guide" class="block py-2 text-sm" style="color:var(--color-text-muted)" onclick="closeMenu()">About Us</a>
    <a href="#plan" class="block py-2 text-sm" style="color:var(--color-text-muted)" onclick="closeMenu()">How It Works</a>
    <button onclick="openModal();closeMenu()" class="btn-accent w-full text-center" id="mobile-cta">Request a Quote</button>
  </div>
</nav>

<!-- ═══════════════════════════════════════════ HERO -->
<section id="hero" class="relative min-h-screen flex items-center justify-center text-center pt-20">
  <div id="hero-bg"></div>
  <div id="hero-overlay"></div>
  <div class="sparks" id="sparks-container"></div>
  <div class="relative z-10 max-w-4xl mx-auto px-6">
    <p id="hero-tagline" class="font-heading text-sm tracking-widest uppercase mb-4" style="color:var(--color-accent)"></p>
    <h1 id="hero-headline" class="font-heading text-5xl md:text-7xl leading-tight mb-6" style="color:var(--color-text-primary)"></h1>
    <p id="hero-subheadline" class="text-lg md:text-xl max-w-2xl mx-auto mb-10" style="color:var(--color-text-muted)"></p>
    <button onclick="openModal()" id="hero-cta" class="btn-accent pulse text-lg px-8 py-4"></button>
  </div>
</section>

<!-- ═══════════════════════════════════════════ PROBLEM -->
<section id="problem" class="py-24 px-6" style="background:var(--color-section-alt)">
  <div class="max-w-6xl mx-auto">
    <div class="text-center mb-16">
      <p id="problem-tagline" data-animate class="font-heading text-sm tracking-widest uppercase mb-3" style="color:var(--color-accent)"></p>
      <h2 id="problem-headline" data-animate data-delay="1" class="font-heading text-4xl md:text-5xl mb-6"></h2>
      <p id="problem-intro" data-animate data-delay="2" class="text-lg max-w-2xl mx-auto" style="color:var(--color-text-muted)"></p>
    </div>
    <div id="problem-cards" class="grid md:grid-cols-3 gap-6 mb-12"></div>
    <blockquote id="problem-quote" data-animate class="text-center text-xl italic max-w-2xl mx-auto" style="color:var(--color-accent)"></blockquote>
  </div>
</section>

<!-- ═══════════════════════════════════════════ GUIDE -->
<section id="guide" class="py-24 px-6" style="background:var(--color-body)">
  <div class="max-w-6xl mx-auto">

    <!-- Empathy / Who We Are -->
    <div class="grid md:grid-cols-2 gap-12 items-center mb-20">
      <div>
        <p id="guide-tagline" data-animate class="font-heading text-sm tracking-widest uppercase mb-3" style="color:var(--color-accent)"></p>
        <h2 id="guide-headline" data-animate data-delay="1" class="font-heading text-4xl md:text-5xl mb-6"></h2>
        <p id="guide-empathy1" data-animate data-delay="2" class="text-lg mb-4" style="color:var(--color-text-muted)"></p>
        <p id="guide-empathy2" data-animate data-delay="3" class="text-lg" style="color:var(--color-text-muted)"></p>
      </div>
      <div data-animate data-delay="2" class="flex justify-center">
        <img id="guide-image" src="" alt="" class="rounded-xl shadow-2xl w-full max-w-sm hidden" />
        <div id="guide-image-placeholder" class="w-full max-w-sm h-64 rounded-xl flex items-center justify-center" style="background:var(--color-card); border:2px dashed [THEME_BORDER_COLOR]">
          <span style="color:var(--color-text-muted)">Photo coming soon</span>
        </div>
      </div>
    </div>

    <!-- Services -->
    <div class="mb-20">
      <h3 id="guide-services-headline" data-animate class="font-heading text-3xl text-center mb-10"></h3>
      <div id="guide-services" class="grid md:grid-cols-2 lg:grid-cols-4 gap-6"></div>
    </div>

    <!-- Promises / Flip Cards -->
    <div>
      <h3 id="guide-promises-headline" data-animate class="font-heading text-3xl text-center mb-10"></h3>
      <div id="guide-promises" class="grid md:grid-cols-3 gap-6"></div>
    </div>

  </div>
</section>

<!-- ═══════════════════════════════════════════ PLAN -->
<section id="plan" class="py-24 px-6" style="background:var(--color-section-alt)">
  <div class="max-w-6xl mx-auto text-center">
    <p id="plan-tagline" data-animate class="font-heading text-sm tracking-widest uppercase mb-3" style="color:var(--color-accent)"></p>
    <h2 id="plan-headline" data-animate data-delay="1" class="font-heading text-4xl md:text-5xl mb-16"></h2>
    <div id="plan-steps" class="grid md:grid-cols-3 gap-8 mb-12 relative"></div>
    <button onclick="openModal()" id="plan-cta" data-animate class="btn-accent text-lg px-8 py-4"></button>
  </div>
</section>

<!-- ═══════════════════════════════════════════ STAKES -->
<section id="stakes" class="py-24 px-6" style="background:var(--color-body)">
  <div class="max-w-6xl mx-auto text-center">
    <p id="stakes-tagline" data-animate class="font-heading text-sm tracking-widest uppercase mb-3" style="color:var(--color-accent)"></p>
    <h2 id="stakes-headline" data-animate data-delay="1" class="font-heading text-4xl md:text-5xl mb-4"></h2>
    <p id="stakes-description" data-animate data-delay="2" class="text-lg mb-12 max-w-2xl mx-auto" style="color:var(--color-text-muted)"></p>

    <div class="grid md:grid-cols-2 gap-8 mb-12">
      <!-- Failure -->
      <div data-animate class="card p-8 text-left" style="border-color: rgba(239,68,68,0.3);">
        <h3 id="stakes-failure-title" class="font-heading text-2xl mb-6" style="color:#ef4444"></h3>
        <ul id="stakes-failure-list" class="space-y-3 text-base" style="color:var(--color-text-muted)"></ul>
      </div>
      <!-- Success -->
      <div data-animate data-delay="1" class="card p-8 text-left" style="border-color: rgba(34,197,94,0.3);">
        <h3 id="stakes-success-title" class="font-heading text-2xl mb-6" style="color:#22c55e"></h3>
        <ul id="stakes-success-list" class="space-y-3 text-base" style="color:var(--color-text-muted)"></ul>
      </div>
    </div>

    <p id="stakes-closing" data-animate class="text-xl italic max-w-2xl mx-auto mb-8" style="color:var(--color-accent)"></p>
    <button onclick="openModal()" id="stakes-cta" data-animate class="btn-accent text-lg px-8 py-4"></button>
  </div>
</section>

<!-- ═══════════════════════════════════════════ FOOTER -->
<footer id="footer" style="background:var(--color-card); border-top: 1px solid [THEME_BORDER_COLOR]">
  <div class="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-4 gap-10">
    <div>
      <p id="footer-brand" class="font-heading text-2xl mb-3" style="color:var(--color-accent)"></p>
      <p id="footer-tagline" class="text-sm" style="color:var(--color-text-muted)"></p>
    </div>
    <div>
      <p class="font-heading text-sm uppercase tracking-wider mb-4" style="color:var(--color-text-muted)">Services</p>
      <ul id="footer-services" class="space-y-2 text-sm" style="color:var(--color-text-muted)"></ul>
    </div>
    <div>
      <p class="font-heading text-sm uppercase tracking-wider mb-4" style="color:var(--color-text-muted)">Contact</p>
      <div id="footer-contact" class="space-y-2 text-sm" style="color:var(--color-text-muted)"></div>
    </div>
    <div>
      <p class="font-heading text-sm uppercase tracking-wider mb-4" style="color:var(--color-text-muted)">Ready to Start?</p>
      <button onclick="openModal()" id="footer-cta" class="btn-accent w-full text-center mb-3"></button>
      <p id="footer-email-link" class="text-xs text-center" style="color:var(--color-text-muted)"></p>
    </div>
  </div>
  <div class="border-t px-6 py-4 text-center text-xs" style="border-color:[THEME_BORDER_COLOR]; color:var(--color-text-muted)">
    <span id="footer-copyright"></span>
  </div>
</footer>

<!-- ═══════════════════════════════════════════ QUOTE MODAL -->
<div id="quote-modal" onclick="closeModalOutside(event)">
  <div class="card max-w-lg w-full mx-4 p-8" style="background:var(--color-card)">
    <div class="flex justify-between items-center mb-6">
      <h3 id="modal-title" class="font-heading text-2xl"></h3>
      <button onclick="closeModal()" class="text-2xl" style="color:var(--color-text-muted)">&times;</button>
    </div>
    <form id="quote-form" class="space-y-4" onsubmit="submitQuote(event)">
      <input type="text" name="name" placeholder="Your Name" required
        class="w-full px-4 py-3 rounded-lg text-sm outline-none"
        style="background:var(--color-body); border:1px solid [THEME_BORDER_COLOR]; color:var(--color-text-primary)" />
      <input type="email" name="email" placeholder="Your Email" required
        class="w-full px-4 py-3 rounded-lg text-sm outline-none"
        style="background:var(--color-body); border:1px solid [THEME_BORDER_COLOR]; color:var(--color-text-primary)" />
      <input type="tel" name="phone" placeholder="Phone (optional)"
        class="w-full px-4 py-3 rounded-lg text-sm outline-none"
        style="background:var(--color-body); border:1px solid [THEME_BORDER_COLOR]; color:var(--color-text-primary)" />
      <textarea name="message" placeholder="Tell us about your project..." rows="4" required
        class="w-full px-4 py-3 rounded-lg text-sm outline-none resize-none"
        style="background:var(--color-body); border:1px solid [THEME_BORDER_COLOR]; color:var(--color-text-primary)"></textarea>
      <button type="submit" id="modal-submit" class="btn-accent w-full text-center"></button>
    </form>
  </div>
</div>

<!-- ═══════════════════════════════════════════ SCRIPTS -->
<script>
  // ── JSON loader ──────────────────────────────────────────────────────
  async function loadJSON(path) {
    try {
      const res = await fetch(path + '?v=' + Date.now());
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch(e) {
      console.warn('Could not load:', path, e);
      return null;
    }
  }

  // ── Renderers ────────────────────────────────────────────────────────
  function renderSettings(s) {
    if (!s) return;
    document.title = s.businessName;
    el('page-title').textContent = s.businessName;
    el('nav-brand').textContent = s.businessName;
    el('footer-brand').textContent = s.businessName;
    el('footer-tagline').textContent = s.footerTagline || '';
    el('footer-copyright').textContent = `© ${s.copyrightYear} ${s.businessName}. All rights reserved.`;
    if (s.logo) { el('nav-logo').src = s.logo; el('nav-logo').classList.remove('hidden'); }
    if (s.favicon) { el('favicon').href = s.favicon; }
    // Contact block
    const c = el('footer-contact');
    if (s.phone) c.innerHTML += `<p><a href="tel:${s.phone}" style="color:var(--color-text-muted)">${s.phone}</a></p>`;
    if (s.email) {
      c.innerHTML += `<p><a href="mailto:${s.email}" style="color:var(--color-text-muted)">${s.email}</a></p>`;
      el('footer-email-link').innerHTML = `Or email <a href="mailto:${s.email}" style="color:var(--color-accent)">${s.email}</a>`;
    }
    if (s.address) c.innerHTML += `<p>${s.address}</p>`;
    // GA
    if (s.gaId) {
      const ga = document.createElement('script');
      ga.src = `https://www.googletagmanager.com/gtag/js?id=${s.gaId}`;
      ga.async = true;
      document.head.appendChild(ga);
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', s.gaId);
    }
    _contactEmail = s.email || '';
    _businessName = s.businessName || '';
  }

  function renderHero(h) {
    if (!h) return;
    el('hero-tagline').textContent = h.tagline || '';
    el('hero-headline').textContent = h.headline || '';
    el('hero-subheadline').textContent = h.subheadline || '';
    setText('hero-cta', h.buttonText);
    setText('nav-cta', h.buttonText);
    setText('mobile-cta', h.buttonText);
    if (h.heroImage) el('hero-bg').style.backgroundImage = `url('${h.heroImage}')`;
  }

  function renderProblem(p) {
    if (!p) return;
    el('problem-tagline').textContent = p.sectionTagline || '';
    el('problem-headline').textContent = p.sectionHeadline || '';
    el('problem-intro').textContent = p.intro || '';
    el('problem-quote').textContent = p.closingQuote || '';
    if (p.cards) {
      el('problem-cards').innerHTML = p.cards.map((c,i) => `
        <div class="card p-8" data-animate data-delay="${i+1}">
          <h3 class="font-heading text-2xl mb-3" style="color:var(--color-accent)">${c.title}</h3>
          <p style="color:var(--color-text-muted)">${c.description}</p>
        </div>`).join('');
    }
  }

  function renderGuide(g) {
    if (!g) return;
    el('guide-tagline').textContent = g.sectionTagline || '';
    el('guide-headline').textContent = g.sectionHeadline || '';
    el('guide-empathy1').textContent = g.empathyParagraph1 || '';
    el('guide-empathy2').textContent = g.empathyParagraph2 || '';
    el('guide-services-headline').textContent = g.servicesHeadline || 'What We Do';
    el('guide-promises-headline').textContent = g.promisesHeadline || 'Our Three Promises';
    if (g.guideImage) {
      el('guide-image').src = g.guideImage;
      el('guide-image').classList.remove('hidden');
      el('guide-image-placeholder').classList.add('hidden');
    }
    if (g.services) {
      el('guide-services').innerHTML = g.services.map((s,i) => `
        <div class="card p-6" data-animate data-delay="${i+1}">
          <h4 class="font-heading text-xl mb-2" style="color:var(--color-accent)">${s.title}</h4>
          <p class="text-sm" style="color:var(--color-text-muted)">${s.description}</p>
        </div>`).join('');
    }
    if (g.promises) {
      el('guide-promises').innerHTML = g.promises.map((p,i) => `
        <div class="flip-card" data-animate data-delay="${i+1}" onclick="this.classList.toggle('flipped')">
          <div class="flip-inner">
            <div class="flip-front">
              <h4 class="font-heading text-xl" style="color:var(--color-text-primary)">${p.title}</h4>
            </div>
            <div class="flip-back">
              <p>${p.back}</p>
            </div>
          </div>
        </div>`).join('');
    }
    // Footer services list
    if (g.services) {
      el('footer-services').innerHTML = g.services.map(s =>
        `<li>${s.title}</li>`).join('');
    }
  }

  function renderPlan(p) {
    if (!p) return;
    el('plan-tagline').textContent = p.sectionTagline || '';
    el('plan-headline').textContent = p.sectionHeadline || '';
    setText('plan-cta', p.ctaText);
    if (p.steps) {
      el('plan-steps').innerHTML = p.steps.map((s,i) => `
        <div class="card p-8 text-center relative" data-animate data-delay="${i+1}">
          <div class="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4 font-heading"
               style="background:var(--color-accent); color:var(--color-body)">${i+1}</div>
          <h3 class="font-heading text-2xl mb-3">${s.title}</h3>
          <p style="color:var(--color-text-muted)">${s.description}</p>
        </div>`).join('');
    }
  }

  function renderStakes(s) {
    if (!s) return;
    el('stakes-tagline').textContent = s.sectionTagline || '';
    el('stakes-headline').textContent = s.sectionHeadline || '';
    el('stakes-description').textContent = s.sectionDescription || '';
    el('stakes-failure-title').textContent = s.failureTitle || '';
    el('stakes-success-title').textContent = s.successTitle || '';
    el('stakes-closing').textContent = s.closingStatement || '';
    setText('stakes-cta', s.ctaText);
    if (s.failureItems) {
      el('stakes-failure-list').innerHTML = s.failureItems.map(i =>
        `<li class="failure-item">${i}</li>`).join('');
    }
    if (s.successItems) {
      el('stakes-success-list').innerHTML = s.successItems.map(i =>
        `<li class="success-item">${i}</li>`).join('');
    }
    // Modal & footer CTA text
    setText('modal-title', s.ctaText || 'Request a Quote');
    setText('footer-cta', s.ctaText || 'Get Started');
    setText('modal-submit', s.ctaText || 'Send Request');
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }
  function setText(id, text) { const e = el(id); if (e && text) e.textContent = text; }

  let _contactEmail = '';
  let _businessName = '';

  // ── Sparks ───────────────────────────────────────────────────────────
  function initSparks() {
    const container = el('sparks-container');
    for (let i = 0; i < 20; i++) {
      const spark = document.createElement('div');
      spark.className = 'spark';
      spark.style.cssText = `
        left: ${Math.random()*100}%;
        top: ${40 + Math.random()*50}%;
        --dur: ${3 + Math.random()*4}s;
        --delay: ${Math.random()*5}s;
        width: ${1+Math.random()*3}px;
        height: ${1+Math.random()*3}px;
      `;
      container.appendChild(spark);
    }
  }

  // ── Parallax ─────────────────────────────────────────────────────────
  function initParallax() {
    const bg = el('hero-bg');
    if (!bg) return;
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      bg.style.transform = `translateY(${scrolled * 0.4}px)`;
    }, { passive: true });
  }

  // ── Scroll Animations ────────────────────────────────────────────────
  function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
  }

  // ── Navbar scroll ────────────────────────────────────────────────────
  function initNavbar() {
    window.addEventListener('scroll', () => {
      el('navbar').classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }

  // ── Mobile menu ──────────────────────────────────────────────────────
  function toggleMenu() { el('mobile-menu').classList.toggle('open'); }
  function closeMenu() { el('mobile-menu').classList.remove('open'); }

  // ── Modal ────────────────────────────────────────────────────────────
  function openModal() { el('quote-modal').classList.add('open'); }
  function closeModal() { el('quote-modal').classList.remove('open'); }
  function closeModalOutside(e) { if (e.target === el('quote-modal')) closeModal(); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  function submitQuote(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value;
    const email = form.email.value;
    const phone = form.phone.value;
    const message = form.message.value;
    const subject = encodeURIComponent(`Quote Request from ${name}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\n\n${message}`
    );
    window.location.href = `mailto:${_contactEmail}?subject=${subject}&body=${body}`;
    closeModal();
  }

  // ── Main init ────────────────────────────────────────────────────────
  async function init() {
    const [settings, hero, problem, guide, plan, stakes] = await Promise.all([
      loadJSON('/content/settings.json'),
      loadJSON('/content/hero.json'),
      loadJSON('/content/problem.json'),
      loadJSON('/content/guide.json'),
      loadJSON('/content/plan.json'),
      loadJSON('/content/stakes.json'),
    ]);

    renderSettings(settings);
    renderHero(hero);
    renderProblem(problem);
    renderGuide(guide);
    renderPlan(plan);
    renderStakes(stakes);

    // Init interactive features after DOM is populated
    requestAnimationFrame(() => {
      initSparks();
      initParallax();
      initScrollAnimations();
      initNavbar();
    });
  }

  init();

  // ── Netlify Identity ─────────────────────────────────────────────────
  if (window.netlifyIdentity) {
    window.netlifyIdentity.on('init', user => {
      if (!user) {
        window.netlifyIdentity.on('login', () => {
          document.location.href = '/admin/';
        });
      }
    });
  }
</script>

</body>
</html>
```

---

## PHASE 5 — CREATE admin/ AND netlify.toml

**admin/index.html** — create exactly:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Content Manager</title>
  <script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
</head>
<body>
  <script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
</body>
</html>
```

**admin/config.yml** — generate a complete Decap CMS config matching all 6 JSON files. Use `widget: "list"` with a `field:` sub-widget for plain string arrays (failureItems, successItems). Use `widget: "list"` with `fields:` for object arrays (cards, services, steps, promises).

**netlify.toml** — create:
```toml
[build]
  publish = "."

[[headers]]
  for = "/content/*"
  [headers.values]
    Cache-Control = "no-cache"
```

---

## PHASE 6 — VERIFY AND REPORT

After generating all files, report:
- ✅ Files created (with file paths)
- 🎨 Theme used and accent color
- 📋 StoryBrand framework applied (brief summary of how the 7 parts map to the content)
- ⚠️ Any fields the client still needs to fill in (images, etc.)
- 🚀 Next step: run `/cms-setup` if CMS wasn't set up, or deploy to Netlify

---

## NOTES

* The `[THEME_*]` placeholders in the HTML template above must be replaced with actual values from the selected theme — do NOT output placeholder text in the final HTML
* All business content comes from JSON files — the HTML is a template shell only
* The modal uses `mailto:` — no backend needed, works on any static host
* For local testing: `python3 -m http.server 8080` and open `http://localhost:8080`
* For hero images: if none provided, the hero bg div will just show a solid color — that's fine, add a client photo later
