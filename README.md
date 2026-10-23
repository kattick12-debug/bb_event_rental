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
| The free delivery distance | `freeDeliveryMiles` / `maxDeliveryMiles` in `towns/towns.json` | Rebuild all |
| A town's banner photo | Add a `hero` block to that town in `towns/towns.json` (see below) | Rebuild that town |

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

### Adding a new town

1. Add the town to the `towns` list in `towns/towns.json` with its `slug` (the web address, e.g. `terrace_park`), `label` (the button text), `name`, `state`, and `lat` / `lng` (look the town up on [openstreetmap.org](https://www.openstreetmap.org) and copy the coordinates).
2. Give it a `page` block with its own `heading`, `intro`, `parksShort` and `parksLong`. Write a real, unique intro: near-identical town pages can hurt search rankings.
3. Run `node towns/build.js` (all towns, so the new town shows up in every page's town list and "nearby" links), then create the page in ERS and paste it in.

### Keeping it accurate

- **Park rules** in the town notes were researched in October 2026 (Cincinnati Parks, Great Parks of Hamilton County, Clermont County Park District, Anderson Park District, Sycamore Township, West Chester Township, Mariemont). They change, so re-check them about once a year. Towns whose city park rules weren't confirmed tell visitors to check with the city.
- **Distances** are estimates from the center of ZIP 45244, with 30% added to straight-line distance to approximate driving miles.
- **Package contents and prices** in `towns/template.html` and `ers-embed/plan-my-event.html` are copied from ERS. Update them when the packages change in ERS.
