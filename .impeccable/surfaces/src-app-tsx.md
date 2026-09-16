---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

Scope: the whole Slabbed prototype — buyer catalogue, detail, cart, checkout and orders; seller page with listings, sales and balance; admin transactions, disputes and refund. Visitor mode: Operate.

Audience: collectors buying and selling one-of-one graded coins and cards; any account does both. Real evidence: live Hyperswitch sandbox payments, refunds and decline reasons. Everything else — sellers, listings, photos, ratings, balances — is synthetic and labelled.

## Direction contract

THESIS: A consumer marketplace that shows the data collectors actually buy on, and shows the money plainly. It refuses the airy lifestyle-commerce arrangement where specs hide behind a hero photo and payment state hides behind a spinner. Catalogue → detail is the shape; density and state legibility are the point of view.

OWN-WORLD: Light bone-white ground, near-black ink, one saturated cobalt accent used only where something can be pressed. Semantic colour is reserved exclusively for state — never decoration — so the accent never collides with paid, pending, shipped or failed. Archivo throughout, Archivo Expanded for display; tabular figures everywhere money appears. Components: listing tile with inline spec strip, detail as a two-column page, data tables with status pills, and a single confirm dialog before refunds. Every screen is a page; no drawers, nothing overlays checkout. Square-ish 4px radii, hairline rules, no shadows above 1dp.

STORY: The visitor understands this is a marketplace of one-of-one items; believes the seller is not paid until they ship; and buys one listing through a real payment, marks it received or disputes it, or — as a seller — ships and sees their balance move.

FIRST VIEWPORT: Catalogue. Slim top bar — wordmark left, search centre, role switcher and cart right. Filter chips beneath. Then a 4-up responsive grid of listing tiles: photo, price in tabular figures, title, and a spec strip (grade · cert · seller rating) that stays visible rather than hiding on hover. The tile opens a detail page. The accent appears only on actionable controls and the cart badge.

FORM: The category standard, played straight — the user took the standing exit in words after the direction roll assigned The Album Page. Craft bar: eBay, Mercari, Depop, including their seller surfaces, so seller and admin views stay in consumer-marketplace language rather than a dashboard idiom. Restrained identity: conventional structure, one committed type pairing, one accent. Composition: top bar and full-width grid with detail pages — the user steered past the surface roll (seed 3b9a76ad, which dealt sidebar-drawer, role-aware home and feed) to the plainest shape. Direction seed key 72d9f506.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved

Whether listing photos are sourced stock or generated.
