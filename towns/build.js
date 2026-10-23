// Builds one ERS town page per town from towns/template.html + towns/towns.json.
//
//   node towns/build.js            -> builds every town that has a "page" block in towns.json
//   node towns/build.js milford    -> builds just one town
//
// Output: ers-embed/towns/<slug>.html (paste into that town's ERS Raw HTML block)
//         ers-embed/towns/page-settings.txt (page title + description to enter in ERS for each town)

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

  const title = `Bounce House Rentals in ${placeName(town)} | Bounce Buddies`;
  const desc = `Bounce houses, water slides, combos & obstacle courses delivered and set up in ${placeName(town)}. $1M insured, cleaned after every rental. Book online!`;
  return { town, miles, title, desc, nearby };
}

// --- run ---
const only = process.argv[2];
const towns = data.towns.filter(t => t.page && (!only || t.slug === only));
if (!towns.length) { console.error(only ? `No town "${only}" with a page block in towns.json` : 'No towns with a page block'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const results = towns.map(buildTown);
const settings = results.map(r =>
  `/${r.town.slug}/\n  Page title:        ${r.title}\n  Meta description:  ${r.desc}\n`).join('\n');
fs.writeFileSync(path.join(outDir, 'page-settings.txt'),
  'ERS page settings for each town page (enter these in the ERS page editor).\nGenerated by towns/build.js.\n\n' + settings, 'utf8');

results.forEach(r => console.log(`built ${r.town.slug}.html  (~${Math.round(r.miles)} mi, nearby: ${r.nearby.map(t => t.name).join(', ')})`));
console.log(`\nOutput: ${path.relative(process.cwd(), outDir)}`);
