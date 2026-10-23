# Bounce Buddies website redesign

HTML for the Bounce Buddies Event Rental site (bouncebuddieseventrental.com). The site runs on Event Rental Systems (ERS), so each page here is pasted into an ERS **Raw HTML** block.

## What's in this folder

| Path | What it is |
|---|---|
| `towns/` | The town page **template**, the **town data**, and the **build script** (see below). |
| `ers-embed/towns/` | **Generated** town pages, one per town, ready to paste into ERS. Don't edit these by hand. |
| `ers-embed/towns/page-settings.txt` | Page title and meta description for each town page (generated). |
| `ers-embed/plan-my-event.html` | The Plan My Event wizard (paste into `/plan-my-event/`). |
| `ers-embed/yard-checker-page.html` | The Will It Fit yard checker (paste into `/yard-checker/`). |
| `ers-embed/party-invite.html` | The Party Invitation Maker (paste into `/party-invite/`; create that page in ERS first). |
| `ers-embed/home-page.html`, `ers-embed/plan-my-site.html` | Earlier versions, replaced by the generated town pages and the full-page yard checker. |
| `milford-redesign.html`, `yard-checker.html` | The original standalone mockups (not used on the live site). |

## Building the town pages

Every town page (`/milford/`, `/loveland/`, …) is built from one template so the design stays the same everywhere, while each page keeps its own town-specific content for Google.

### What you need

[Node.js](https://nodejs.org) (any recent version). Check it's installed:

```bash
node -v
```

### Build

From the project folder:

```bash
node towns/build.js
```

This writes one page per town to `ers-embed/towns/<town>.html` and refreshes `ers-embed/towns/page-settings.txt`.

To rebuild just one town, add its name (the part of its web address, e.g. `loveland`, `blue_ash`, `northern_kentucky`):

```bash
node towns/build.js loveland
```

### Put a page on the site

1. Open the town's page in the ERS editor (e.g. `/loveland/`). It needs the **full-width** layout (like `/milford/`), not the classic one, or it gets the old header.
2. Replace everything in its Raw HTML block with the contents of `ers-embed/towns/loveland.html`.
3. In the page settings, copy that town's **page title** and **meta description** from `ers-embed/towns/page-settings.txt`.
4. Save and check the page on your phone and computer.

### What to edit, and where

| To change… | Edit… | Then |
|---|---|---|
| The design of every town page (layout, colors, sections, prices, FAQ) | `towns/template.html` | Rebuild all towns and re-paste them |
| One town's intro, heading or park notes | That town's `page` block in `towns/towns.json` | Rebuild that town and re-paste it |
| The free delivery distance (town pages and the "Do you deliver to me?" checker) | `freeDeliveryMiles` / `maxDeliveryMiles` in `towns/towns.json` | Rebuild all |
| Where delivery distances are measured from | `warehouse` `lat` / `lng` in `towns/towns.json` | Rebuild all |
| A town's banner photo | Add a `hero` block to that town in `towns/towns.json` (see below) | Rebuild that town |
| The Kids' Age Finder (units, ages, height/weight limits) | `towns/inventory.json` (see below) | Rebuild all |

`towns/template.html` uses slots like `{{TOWN}}` and `{{INTRO}}` that the build script fills in. If you add a new slot, add its value in `towns/build.js` too (the build stops with an error if a slot has no value).

### Changing a town's banner photo

Every town uses the default parade photo (`defaultHero` in `towns/towns.json`) unless it has its own. To give a town its own photo:

1. Upload the photo to ERS (or any public image host) and copy its web address.
2. In `towns/towns.json`, add a `hero` block inside that town's `page` block:

   ```json
   "hero": {
     "photo": "https://files.sysers.com/.../loveland-backyard-party.jpg",
     "alt": "Rainbow bounce house set up at a backyard birthday party in Loveland, Ohio",
     "position": "60% 40%",
     "positionMobile": "50% 60%"
   },
   ```

3. Rebuild that town (`node towns/build.js loveland`) and re-paste it into ERS.

| Setting | Required? | What it does |
|---|---|---|
| `photo` | Yes | Full `https://` address of the image. |
| `alt` | Yes | Short description including the town name. Google reads this, so it helps the page show up in image search. |
| `position` | No | Which part of the photo stays in view on computers. First number is left–right, second is top–bottom: `"30% 50%"` keeps the left-center, `"50% 20%"` keeps the top-middle. |
| `positionMobile` | No | The same, for phones (the photo shows below the text there). |
| `credit`, `creditUrl` | No | Adds a small "Photo: …" credit in the banner's corner. Required for Creative Commons photos (e.g. from Wikimedia). |

Photo tips:

- Your own photos of real setups in that town work best (get the family's OK, and avoid kids' faces without consent).
- Only use photos you took or have the rights to. Don't use images from a Google search.
- Use a landscape photo about 1600–2400 px wide, compressed to under ~400 KB so the page loads fast.

### Kids' Age Finder

The "What's best for your kids' ages?" section on every town page has four tabs (Toddlers 2–4, Kids 5–8, Tweens 9–12, Teens & adults) and shows up to 8 rated units for each. It's built from `towns/inventory.json`, which lists every rental unit (copied from the ERS item pages).

For each unit you can fill in:

| Field | Example | Notes |
|---|---|---|
| `ageGroup` | `"3 and Up"`, `"4-Adult"`, `"Teens, and Adults"`, `"All"` | Units with no age group don't appear in the finder. Use the same wording as the ERS "Age Group" field. "Adult", "Teens" or "All" also puts a unit in the Teens & adults tab. |
| `maxHeight` | `"5'0\""` | From the manufacturer label on the unit. |
| `maxWeight` | `"150 lbs"` | From the manufacturer label. |
| `maxRiders` | `"6 kids"` | How many can use it at once. |

Until a unit has height, weight or rider limits, its card says "Height & weight limits: Ask us".

Each tab's tip text, preferred unit types (`prefer`) and ordering are set in the `ageBands` list at the top of the file. When you add or remove a unit in ERS, add or remove it here too (`slug` is the last part of its ERS item address, e.g. `/items/shark_attack_combo_wet-dry/`).

### "Do you deliver to me?" checker

Every town page has a delivery checker: a visitor types their party address and sees whether delivery is free, may have a travel fee, or is outside the area. How it works:

1. It looks up the address with free OpenStreetMap services (Photon, with Nominatim as a backup).
2. It gets the **driving distance** from the free OSRM routing service. If that service is busy, it estimates from straight-line distance plus 30%.
3. It compares the miles to `freeDeliveryMiles` and `maxDeliveryMiles` in `towns/towns.json`: free up to 2 miles under the limit, "looks like free, we'll confirm" right around it, "travel fee may apply" up to the max, and "call us" beyond that.

Distances are measured from the `warehouse` point in `towns/towns.json`: the warehouse at 8134 Clough Pike (39.0885, -84.3289, from the U.S. Census geocoder). If the warehouse moves, update those coordinates (right-click the spot on Google Maps to copy them) and rebuild.

The free services are fine for normal traffic. If the checker ever gets heavy use, switch to a paid map service (Google Maps or Mapbox).

### Adding a new town

1. Add the town to the `towns` list in `towns/towns.json` with its `slug` (the web address, e.g. `terrace_park`), `label` (the button text), `name`, `state`, and `lat` / `lng` (look the town up on [openstreetmap.org](https://www.openstreetmap.org) and copy the coordinates).
2. Give it a `page` block with its own `heading`, `intro`, `parksShort` and `parksLong`. Write a real, unique intro: near-identical town pages can hurt search rankings.
3. Run `node towns/build.js` (all towns, so the new town shows up in every page's town list and "nearby" links), then create the page in ERS and paste it in.

### Keeping it accurate

- **Park rules** in the town notes were researched in October 2026 (Cincinnati Parks, Great Parks of Hamilton County, Clermont County Park District, Anderson Park District, Sycamore Township, West Chester Township, Mariemont). They change, so re-check them about once a year. Towns whose city park rules weren't confirmed tell visitors to check with the city.
- **Distances** on the town pages are measured from the warehouse (8134 Clough Pike), with 30% added to straight-line distance to approximate driving miles. The "Do you deliver to me?" checker uses real driving miles when the routing service responds.
- **Package contents and prices** in `towns/template.html` and `ers-embed/plan-my-event.html` are copied from ERS. Update them when the packages change in ERS.

## Party Invitation Maker

`ers-embed/party-invite.html` is a full page (like the yard checker): parents enter the birthday kid's name, age, date, time, place, RSVP and a note, pick one of five themes (Bounce Castle, Water Splash, Obstacle Race, Carnival, Movie Night), and download, print or share a 5×7 invitation. Everything stays in their browser. Each invite has a small "Bounce house fun by Bounce Buddies" credit at the bottom.

To put it live: create a `/party-invite/` page in ERS set up like `/yard-checker/` (blank, full page) and paste the file in. The town pages and the Plan My Event results already link to `/party-invite/`. To add or change a theme, edit the `THEMES` list near the top of the file's script.