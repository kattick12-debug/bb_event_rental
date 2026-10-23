// Builds one ERS town page per town from towns/template.html + towns/towns.json.
//
//   node towns/build.js            -> builds every town that has a "page" block in towns.json, plus the events page
//   node towns/build.js milford    -> builds just one town
//   node towns/build.js events     -> builds just the group events page
//
// Output: ers-embed/towns/<slug>.html (paste into that town's ERS Raw HTML block)
//         ers-embed/events.html (paste into /events/)
//         ers-embed/towns/page-settings.txt (page title + description to enter in ERS for each page)

const fs = require('fs');
const path = require('path');

const root = __dirname;
const outDir = path.join(root, '..', 'ers-embed', 'towns');
const data = JSON.parse(fs.readFileSync(path.join(root, 'towns.json'), 'utf8'));
const template = fs.readFileSync(path.join(root, 'template.html'), 'utf8');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const possessive = name => name.endsWith('s') ? name + "'" : name + "'s";

// Straight-line miles between two points, times a factor to roughly match driving distance
function roadMiles(a, b) {
  const R = 3958.8, rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * data.roadFactor;
}

const placeName = t => t.region ? t.name : `${t.name}, ${t.state}`;

function delivery(town, miles) {
  const m = Math.max(1, Math.round(miles));
  const free = data.freeDeliveryMiles, max = data.maxDeliveryMiles;
  if (town.region) {
    // A region spans several towns, so give the range of the towns we serve inside it
    const inside = data.towns.filter(t => !t.region && t.state === town.state && t.lat).map(t => roadMiles(data.warehouse, t));
    const lo = Math.round(Math.min(...inside) / 5) * 5, hi = Math.round(Math.max(...inside) / 5) * 5;
    return {
      perkTitle: 'Free Delivery',
      perkText: `Most of ${town.name} is within our ${free}-mile free delivery zone. We'll confirm for your address when you book. Setup and takedown included.`,
      distance: `About ${lo}–${hi} miles away`,
      line: `Free delivery within ${free} miles; we'll confirm for your exact address.`
    };
  }
  if (miles <= free - 5) return {
    perkTitle: 'Free Delivery',
    perkText: `${town.name} is about ${m} miles from our warehouse, well inside our ${free}-mile free delivery zone. Setup and takedown included.`,
    distance: `About ${m} miles away`,
    line: `Free delivery, setup and takedown (we deliver free within ${free} miles).`
  };
  if (miles <= free) return {
    perkTitle: 'Free Delivery',
    perkText: `${town.name} is about ${m} miles from our warehouse, inside our ${free}-mile free delivery zone. We'll confirm for your address when you book.`,
    distance: `About ${m} miles away`,
    line: `Free delivery within ${free} miles; we'll confirm for your exact address.`
  };
  if (miles <= max) return {
    perkTitle: 'We Deliver Here',
    perkText: `${town.name} is about ${m} miles from our warehouse. We deliver up to ${max} miles; a travel fee may apply past ${free} miles.`,
    distance: `About ${m} miles away`,
    line: `A small travel fee may apply past ${free} miles.`
  };
  return {
    perkTitle: 'Ask About Delivery',
    perkText: `${town.name} is outside our usual ${max}-mile delivery area. Call us and we'll see what we can do.`,
    distance: `About ${m} miles away`,
    line: 'Outside our usual area. Give us a call.'
  };
}

// ---------- Kids' age finder (same on every town page) ----------
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'inventory.json'), 'utf8'));
const TYPE_ORDER = { bounce: 0, combo: 1, slide: 2, obstacle: 3, game: 4 };
const MAX_PER_BAND = 8;

// "3 and Up" -> {min:3}, "3-Adult" -> {min:3, adults}, "Teens, and Adults" -> {min:13, adults}, "Any"/"All" -> {min:0, adults}
function parseAge(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return null;
  if (/^(any|all)\b/.test(t)) return { min: 0, adults: true, label: 'All ages' };
  if (/teen/.test(t)) return { min: 13, adults: true, label: 'Teens & adults' };
  const n = t.match(/\d+/);
  if (!n) return null;
  const adults = /adult/.test(t);
  return { min: +n[0], adults, label: adults ? `Ages ${n[0]} to adult` : `Ages ${n[0]}+` };
}

// Which units show under each age band. Toddlers only see units rated 3 and under;
// the teens & adults band only shows units rated for adults.
function fitsBand(age, band) {
  if (!age) return false;
  if (band.id === 'teens') return age.adults;
  return age.min <= (band.id === 'toddler' ? 3 : band.maxAge);
}

function unitCard(u, age) {
  const wet = /wet\/dry|wet-dry/i.test(u.name) ? 'Wet or dry' : /\bwet\b/i.test(u.name) ? 'Wet' : '';
  const limits = [['Max height', u.maxHeight], ['Max weight', u.maxWeight], ['Riders at once', u.maxRiders]].filter(l => l[1]);
  const limitsHtml = limits.length
    ? limits.map(l => `<li><span>${l[0]}</span><b>${esc(l[1])}</b></li>`).join('')
    : '<li><span>Height &amp; weight limits</span><b>Ask us</b></li>';
  return `<a class="bb-unit" href="/items/${encodeURI(u.slug)}/">
          <div class="bb-unit-img"><img src="${esc(u.photo)}" alt="${esc(u.name)}" loading="lazy"></div>
          <div class="bb-unit-body">
            <h3>${esc(u.name)}</h3>
            <div class="bb-unit-tags"><span>${esc(age.label)}</span>${wet ? `<span class="wet">💧 ${wet}</span>` : ''}</div>
            <ul class="bb-unit-limits">${limitsHtml}</ul>
            <div class="bb-unit-foot"><span class="bb-unit-price">${money(u.price)}</span><span class="bb-unit-cta">Details →</span></div>
          </div>
        </a>`;
}
const money = n => '$' + Number(n).toLocaleString('en-US');

function buildAgeFinder() {
  const units = inventory.units.map(u => ({ u, age: parseAge(u.ageGroup) }));
  const tabs = inventory.ageBands.map((b, i) =>
    `<button class="bb-age-tab${i ? '' : ' on'}" role="tab" id="bb-age-tab-${b.id}" aria-controls="bb-age-${b.id}" aria-selected="${i ? 'false' : 'true'}">` +
    `<span class="bb-age-emo">${b.emoji}</span><b>${esc(b.label)}</b><small>${esc(b.ages)}</small></button>`).join('');
  const panels = inventory.ageBands.map((b, i) => {
    // Order by this band's preferred unit types (e.g. obstacle courses first for tweens), then price
    // (cheapest first, or biggest/priciest first for older kids when "biggestFirst" is set)
    const pref = b.prefer || Object.keys(TYPE_ORDER);
    const rank = t => { const i = pref.indexOf(t); return i < 0 ? 99 : i; };
    const dir = b.biggestFirst ? -1 : 1;
    const fit = units.filter(x => fitsBand(x.age, b))
      .sort((a, c) => (rank(a.u.type) - rank(c.u.type)) || dir * (a.u.price - c.u.price));
    if (!fit.length) throw new Error(`Age band "${b.id}" has no units: check ageGroup values in inventory.json`);
    // Bounce Buddies' own units come first; partner units (shared by agreement) only fill open spots.
    // Within each group, show a mix: at most 3 of any one type first, then fill with the rest.
    const own = fit.filter(x => x.u.owned), partner = fit.filter(x => !x.u.owned);
    const perType = {}, shown = [];
    const take = (list, capped) => list.forEach(x => {
      if (shown.length >= MAX_PER_BAND || shown.includes(x)) return;
      if (capped && (perType[x.u.type] = (perType[x.u.type] || 0) + 1) > 3) return;
      shown.push(x);
    });
    take(own, true); take(own, false); take(partner, true); take(partner, false);
    // Keep the on-page order by type preference so the grid still reads bounce → combo → slide, etc.
    shown.sort((a, c) => (c.u.owned - a.u.owned) || (rank(a.u.type) - rank(c.u.type)) || dir * (a.u.price - c.u.price));
    return `<div class="bb-age-panel" role="tabpanel" id="bb-age-${b.id}" aria-labelledby="bb-age-tab-${b.id}"${i ? ' hidden' : ''}>
        <p class="bb-age-tip">${b.emoji} ${esc(b.tip)}</p>
        <div class="bb-units">
        ${shown.map(x => unitCard(x.u, x.age)).join('\n        ')}
        </div>
        ${fit.length > shown.length ? `<p class="bb-age-more">Showing ${shown.length} of ${fit.length} units for this age. <a href="/category">See all rentals →</a></p>` : ''}
      </div>`;
  }).join('\n      ');
  return { tabs, panels };
}
const ageFinder = buildAgeFinder();

function buildTown(town) {
  const p = town.page;
  const others = data.towns.filter(t => t.slug !== town.slug && t.lat && !t.region);
  const miles = roadMiles(data.warehouse, town);
  const d = delivery(town, miles);

  // Nearest four towns we serve, linked to their pages (same state first: the river makes KY "near" OH towns feel far)
  const nearby = others.map(t => ({ t, mi: roadMiles(town, t) + (t.state === town.state ? 0 : 1000) }))
    .sort((a, b) => a.mi - b.mi).slice(0, 4).map(x => x.t);
  const nearbyLinks = nearby.map(t => `<a href="/${t.slug}">${esc(t.name)}</a>`);
  const nearbyText = nearbyLinks.slice(0, -1).join(', ') + ' and ' + nearbyLinks.slice(-1);

  // Town chips: this town first (highlighted), then the rest in the usual order
  const chips = [town, ...data.towns.filter(t => t.slug !== town.slug)]
    .map(t => `<a${t.slug === town.slug ? ' class="bb-here"' : ''} href="/${t.slug}">${esc(t.label)}</a>`).join('');

  const jsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Bounce Buddies Event Rental',
    description: `Bounce house, water slide, combo and obstacle course rentals delivered and set up in ${placeName(town)}.`,
    url: `https://www.bouncebuddieseventrental.com/${town.slug}/`,
    telephone: '+1-513-305-1758',
    image: 'https://files.sysers.com/cp/upload/bouncebuddieseventrental/editor/logo-copy.png',
    address: { '@type': 'PostalAddress', streetAddress: '8134 Clough Pike', addressLocality: 'Cincinnati', addressRegion: 'OH', postalCode: '45244', addressCountry: 'US' },
    areaServed: [town, ...nearby].map(t => ({ '@type': t.region ? 'AdministrativeArea' : 'City', name: placeName(t) })),
    priceRange: '$$',
    sameAs: ['https://www.facebook.com/share/1DWVacuUzA/']
  }, null, 2);

  // Banner photo: the town's own "hero" block if it has one, otherwise the default
  const hero = Object.assign({}, data.defaultHero, p.hero || {});
  if (p.hero && p.hero.photo && !p.hero.alt) throw new Error(`${town.slug}: a custom hero photo needs "alt" text`);
  if (!/^https:\/\//.test(hero.photo)) throw new Error(`${town.slug}: hero photo must be a full https:// URL`);
  const credit = hero.credit
    ? `<span class="bb-hero-credit">Photo: ${hero.creditUrl ? `<a href="${esc(hero.creditUrl)}" target="_blank" rel="noopener">${esc(hero.credit)}</a>` : esc(hero.credit)}</span>`
    : '';

  const values = {
    DZ_CONFIG: JSON.stringify({
      warehouse: { lat: data.warehouse.lat, lng: data.warehouse.lng },
      free: data.freeDeliveryMiles, max: data.maxDeliveryMiles, roadFactor: data.roadFactor
    }),
    AGE_TABS: ageFinder.tabs,
    AGE_PANELS: ageFinder.panels,
    HERO_PHOTO: esc(hero.photo),
    HERO_ALT: esc(hero.alt).replace(/"/g, '&quot;'),
    HERO_POS: esc(hero.position || 'center'),
    HERO_POS_MOBILE: esc(hero.positionMobile || '40% 55%'),
    HERO_CREDIT: credit,
    TOWN: esc(town.name),
    TOWN_STATE: esc(placeName(town)),
    POSSESSIVE: esc(possessive(town.name)),
    SLUG: town.slug,
    PERK_DELIVERY_TITLE: esc(d.perkTitle),
    PERK_DELIVERY_TEXT: esc(d.perkText),
    LOCAL_HEADING: esc(p.heading),
    INTRO: esc(p.intro),
    NEARBY_LINKS: nearbyText,
    DISTANCE_LINE: esc(d.distance),
    DELIVERY_LINE: esc(d.line),
    PARKS_SHORT: esc(p.parksShort),
    PARKS_LONG: esc(`${p.parksLong} ${data.parkText.confirm}`),
    AREA_CHIPS: chips,
    JSONLD: jsonld
  };

  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => {
    if (!(key in values)) throw new Error(`Template slot {{${key}}} has no value (town: ${town.slug})`);
    return values[key];
  });

  fs.writeFileSync(path.join(outDir, `${town.slug}.html`), html, 'utf8');

  return { town, miles, nearby };
}

const townSettings = town => ({
  slug: town.slug,
  title: `Bounce House Rentals in ${placeName(town)} | Bounce Buddies`,
  desc: `Bounce houses, water slides, combos & obstacle courses delivered and set up in ${placeName(town)}. $1M insured, cleaned after every rental. Book online!`
});

// ---------- Group events page (/events/) ----------
function buildEvents() {
  const ev = JSON.parse(fs.readFileSync(path.join(root, 'events.json'), 'utf8'));
  const evTemplate = fs.readFileSync(path.join(root, 'events-template.html'), 'utf8');
  const baseCss = (template.match(/<style>([\s\S]*?)<\/style>/) || [])[1];
  if (!baseCss) throw new Error('Could not find the <style> block in towns/template.html');
  const unitBySlug = slug => {
    const u = inventory.units.find(x => x.slug === slug);
    if (!u) throw new Error(`events.json refers to "${slug}", which isn't in inventory.json`);
    return u;
  };
  const link = u => `/items/${encodeURI(u.slug)}/`;
  const yes = k => ev.offers[k] === 'yes';

  const eventTypes = ev.eventTypes.map(t => `<div class="bb-ev-type">
          <span class="bb-ev-emo">${t.emoji}</span><h3>${esc(t.title)}</h3><p>${esc(t.blurb)}</p>
          <ul class="bb-ev-picks">${t.picks.map(unitBySlug).map(u => `<li><a href="${link(u)}">${esc(u.name)}</a></li>`).join('')}</ul>
        </div>`).join('\n        ');

  const bundles = ev.bundles.map(b => {
    const us = b.units.map(unitBySlug);
    const total = us.reduce((s, u) => s + u.price, 0);
    const outlets = us.reduce((s, u) => s + (Number(u.outlets) || 0), 0);
    const attendants = us.reduce((s, u) => s + (Number(u.attendants) || 0), 0);
    return `<div class="bb-bundle">
          <div class="bb-bundle-top"><span class="bb-bundle-emo">${b.emoji}</span><div><h3>${esc(b.name)}</h3><span class="bb-crowd">${esc(b.crowd)}</span></div></div>
          <p>${esc(b.blurb)}</p>
          <ul class="bb-bundle-units">${us.map(u => `<li><img src="${esc(u.photo)}" alt="" loading="lazy"><a href="${link(u)}">${esc(u.name)}</a><span>${money(u.price)}</span></li>`).join('')}</ul>
          <div class="bb-bundle-stats"><span>🎈 ${us.length} units</span><span>⚡ ${outlets} outlets or a generator</span>${attendants ? `<span>👥 ${attendants} attendants listed</span>` : ''}</div>
          <div class="bb-bundle-foot">
            <div class="bb-bundle-price"><small>${b.custom ? 'Starting around' : 'From'}</small>${money(total)}${b.custom ? '+' : ''}</div>
            <a href="#bb-quote" class="bb-btn bb-btn-blue" data-bundle="${esc(b.id)}">Request this bundle →</a>
          </div>
        </div>`;
  }).join('\n        ');

  const why = [
    ['🛡️', '$1M insured', yes('coi')
      ? 'Fully insured with a $1 million liability policy, with certificates of insurance naming your school or organization.'
      : 'Fully insured with a $1 million liability policy. Need a certificate of insurance? Ask us when you request a quote.'],
    ['✅', 'Inspected & cleaned', 'Every inflatable is state-inspected each year, and cleaned and sanitized before every event.'],
    ['🧾', 'Easy billing', [
      yes('purchaseOrders') ? 'We accept purchase orders and can invoice your organization.' : 'Paying by invoice or purchase order? Let us know in your request.',
      yes('taxExempt') ? 'Tax-exempt? Send your certificate and we won’t charge sales tax.' : 'Tax-exempt organizations: mention it when you ask for a quote.'
    ].join(' ')],
    ['👥', 'Staffing', yes('attendants')
      ? 'Need hands? Our attendants can run the units so your volunteers can enjoy the event.'
      : 'Larger units list 1–2 attendants each, so you can plan volunteers. Ask us about staffing.'],
    ['🚚', 'Delivery & setup', `Free delivery within ${data.freeDeliveryMiles} miles. We set up before your start time and take everything down after.`],
    ev.offers.nonprofitDiscount
      ? ['💙', 'Nonprofit pricing', ev.offers.nonprofitDiscount]
      : ['📋', 'One quote, whole event', 'Booking several units? We’ll put the whole event, generators and all, into one quote.']
  ].map(c => `<div class="bb-why-card"><span>${c[0]}</span><div><h3>${esc(c[1])}</h3><p>${esc(c[2])}</p></div></div>`).join('\n        ');

  const faq = [
    ['Do you provide a certificate of insurance?', yes('coi')
      ? 'Yes. We carry a $1 million liability policy and can issue a certificate naming your school, church or organization. Just ask when you book.'
      : 'We carry a $1 million liability policy. If your school, church or venue needs a certificate of insurance, ask us when you request a quote.'],
    ['Can we pay by invoice or purchase order?', yes('purchaseOrders')
      ? 'Yes. We accept purchase orders and can invoice your organization.'
      : 'Mention it in your quote request and we’ll work out billing with you.'],
    ['We’re tax-exempt. Do we pay sales tax?', yes('taxExempt')
      ? 'No. Send us your tax-exempt certificate and we won’t charge sales tax.'
      : 'Let us know in your request that you’re tax-exempt and we’ll go over it with you.'],
    ['Do you provide attendants?', yes('attendants')
      ? 'Yes. Our attendants can run the units for you. Ask for staffing in your quote request.'
      : 'Our larger courses list 1–2 attendants each, and most groups use their own adult volunteers. Ask us about staffing for your event.'],
    ['How early do you set up?', 'Generally 1–3 hours before your start time, and up to 4 hours on busy days. We call the day before to confirm.'],
    ['What if it rains?', 'Cancel 8 or more days out for a full refund of your deposit. Cancel 2–7 days out and you get a rain check good for one year.'],
    ['How far do you travel?', `Delivery is free within ${data.freeDeliveryMiles} miles of our warehouse, and we travel up to ${data.maxDeliveryMiles} miles. Farther than that? Give us a call.`]
  ].map((q, i) => `<details${i ? '' : ' open'}><summary>${esc(q[0])}</summary><p>${esc(q[1])}</p></details>`).join('\n        ');

  const jsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Inflatable rentals for schools, churches, companies and community events',
    name: 'Group event inflatable rentals',
    url: `https://www.bouncebuddieseventrental.com/${ev.page.slug}/`,
    areaServed: { '@type': 'AdministrativeArea', name: 'Greater Cincinnati and Northern Kentucky' },
    provider: {
      '@type': 'LocalBusiness', name: 'Bounce Buddies Event Rental', telephone: '+1-513-305-1758',
      address: { '@type': 'PostalAddress', streetAddress: '8134 Clough Pike', addressLocality: 'Cincinnati', addressRegion: 'OH', postalCode: '45244', addressCountry: 'US' }
    }
  }, null, 2);

  const hero = data.defaultHero;
  const values = {
    SLUG: ev.page.slug,
    BASE_CSS: baseCss,
    HERO_PHOTO: esc(hero.photo),
    HERO_ALT: esc(hero.alt).replace(/"/g, '&quot;'),
    HERO_POS: esc(hero.position || 'center'),
    HERO_POS_MOBILE: esc(hero.positionMobile || '40% 55%'),
    EVENT_TYPES: eventTypes,
    BUNDLES: bundles,
    STAFF_NOTE: yes('attendants') ? ' and attendants' : '',
    WHY_CARDS: why,
    EVENT_TYPE_OPTIONS: ev.eventTypes.map(t => `<option>${esc(t.title)}</option>`).join('') + '<option>Other</option>',
    BUNDLE_OPTIONS: ev.bundles.map(b => `<option value="${esc(b.id)}">${esc(b.name)} (${esc(b.crowd)})</option>`).join(''),
    QUOTE_CONFIG: JSON.stringify({
      email: ev.quote.email || '',
      contactUrl: ev.quote.contactUrl || '/contact_us/',
      bundles: Object.fromEntries(ev.bundles.map(b => [b.id, b.units.map(s => unitBySlug(s).name).join(', ')]))
    }),
    FAQ: faq,
    JSONLD: jsonld
  };
  const html = evTemplate.replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => {
    if (!(key in values)) throw new Error(`Events template slot {{${key}}} has no value`);
    return values[key];
  });
  fs.writeFileSync(path.join(root, '..', 'ers-embed', 'events.html'), html, 'utf8');
  return { slug: ev.page.slug, title: ev.page.title, desc: ev.page.description, bundles: ev.bundles.length };
}

// --- run ---
//   node towns/build.js            -> every town page + the events page
//   node towns/build.js loveland   -> just one town
//   node towns/build.js events     -> just the events page
const only = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });

let eventsResult = null;
if (!only || only === 'events') {
  eventsResult = buildEvents();
  console.log(`built ../events.html  (${eventsResult.bundles} bundles)`);
}
if (only !== 'events') {
  const towns = data.towns.filter(t => t.page && (!only || t.slug === only));
  if (!towns.length) { console.error(`No town "${only}" with a page block in towns.json`); process.exit(1); }
  towns.map(buildTown).forEach(r =>
    console.log(`built ${r.town.slug}.html  (~${Math.round(r.miles)} mi, nearby: ${r.nearby.map(t => t.name).join(', ')})`));
}

// The settings list always covers every page, even when only one was rebuilt
const ev = JSON.parse(fs.readFileSync(path.join(root, 'events.json'), 'utf8'));
const settings = [...data.towns.filter(t => t.page).map(townSettings), { slug: ev.page.slug, title: ev.page.title, desc: ev.page.description }]
  .map(s => `/${s.slug}/\n  Page title:        ${s.title}\n  Meta description:  ${s.desc}\n`).join('\n');
fs.writeFileSync(path.join(outDir, 'page-settings.txt'),
  'ERS page settings for each page (enter these in the ERS page editor).\nGenerated by towns/build.js.\n\n' + settings, 'utf8');
console.log(`\nOutput: ${path.relative(process.cwd(), outDir)} and ers-embed/events.html`);
