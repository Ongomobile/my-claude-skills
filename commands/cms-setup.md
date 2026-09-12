# /cms-setup

You are setting up Decap CMS on an existing landing page so the client can edit content without touching code.

## Your Job

Read the current project's `index.html`, identify all editable content, extract it into JSON files, make the page load dynamically from those files, and wire up a Decap CMS admin panel.

---

## Step 1 — Read and Analyze

Read `index.html` in full. Identify:

- **Text content** to make editable: headlines, subheadlines, body paragraphs, button labels, taglines, quotes, list items, section headings
- **Images** to make editable: hero backgrounds, profile photos, logos, any `<img>` src values
- **Colors** to make editable: any primary/accent brand color used repeatedly (hex values in CSS)
- **Contact info**: phone, email, address
- **Grouped sections**: mentally group content into logical blocks (e.g. hero, problem/challenge, about/guide, process/steps, testimonials, CTA, footer)

Do NOT make editable: structural HTML, CSS classes, JavaScript logic, navigation link hrefs to section IDs, icon SVGs.

---

## Step 2 — Design the JSON Schema

Group the editable content into JSON files — one per major section. Use simple, flat structures. Aim for 5–8 files maximum.

**Standard file names to use** (use what fits, skip what doesn't):
- `content/settings.json` — business name, logo, accent color, phone, email, address, footer tagline
- `content/hero.json` — tagline, headline, subheadline, CTA button text, hero image
- `content/[section-name].json` — one file per major content section (name it after the section)

**JSON field naming rules:**
- camelCase field names: `sectionHeadline`, `buttonText`, `heroImage`
- Arrays for repeated items: testimonials, services, steps, cards
- Array items use `fields` objects with consistent keys

---

## Step 3 — Create the JSON Files

Write each JSON file to `content/[name].json` with the actual hardcoded values from the HTML as the default content. Do not write empty strings — populate with the real current content so the page looks correct immediately.

---

## Step 4 — Modify index.html

Make the following changes to `index.html`:

### 4a — Add to `<head>` (if not already present):
```html
<!-- Netlify Identity Widget -->
<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
```

### 4b — Add a `loadJSON` helper and `init()` function to the `<script>` section:

```js
async function loadJSON(path) {
  try {
    const res = await fetch(path + '?v=' + Date.now());
    return await res.json();
  } catch(e) {
    console.warn('Could not load:', path);
    return null;
  }
}
```

### 4c — Replace ALL hardcoded editable content with element IDs:
- Add `id="[descriptive-id]"` to every element whose content will come from JSON
- Remove the hardcoded text/src values from the HTML (leave the elements empty or with placeholder)
- For dynamically generated sections (cards, list items, steps), leave a container `<div id="[section]-container"></div>` empty — JS will build the inner HTML

### 4d — Write render functions that populate the IDs from JSON data:
- One `render[Section](data)` function per JSON file
- Use `element.textContent` for plain text, `element.innerHTML` for rich content, `element.src` for images
- For arrays (cards, steps, testimonials), build innerHTML strings and inject into the container

### 4e — Load everything in parallel and call render functions:
```js
async function init() {
  const [settings, hero, /* ...other sections */] = await Promise.all([
    loadJSON('/content/settings.json'),
    loadJSON('/content/hero.json'),
    // ...
  ]);
  renderSettings(settings);
  renderHero(hero);
  // ...
}
init();
```

### 4f — Add Netlify Identity redirect at the bottom of the script:
```js
if (window.netlifyIdentity) {
  window.netlifyIdentity.on('init', user => {
    if (!user) {
      window.netlifyIdentity.on('login', () => {
        document.location.href = '/admin/';
      });
    }
  });
}
```

### 4g — If a brand accent color was extracted:
After loading settings, apply it dynamically:
```js
function setAccentColor(hex) {
  if (!hex) return;
  document.documentElement.style.setProperty('--primary', hex); // or whatever CSS var name is used
}
```

---

## Step 5 — Create admin/index.html

Create `admin/index.html` with this exact content:

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

---

## Step 6 — Create admin/config.yml

Write a Decap CMS config that matches the JSON files exactly.

**Template to follow:**
```yaml
backend:
  name: git-gateway
  branch: main

media_folder: "images/uploads"
public_folder: "/images/uploads"

collections:

  - name: "settings"
    label: "Site Settings"
    files:
      - name: "general"
        label: "General Settings"
        file: "content/settings.json"
        fields:
          - { label: "Business Name", name: "businessName", widget: "string" }
          - { label: "Accent Color", name: "accentColor", widget: "string" }
          - { label: "Phone", name: "phone", widget: "string", required: false }
          - { label: "Email", name: "email", widget: "string", required: false }
          # ... match every field in settings.json

  - name: "hero"
    label: "Hero Section"
    files:
      - name: "hero"
        label: "Hero Content"
        file: "content/hero.json"
        fields:
          # ... match every field in hero.json
```

**Widget types to use:**
- Short text (headline, button text, name) → `widget: "string"`
- Long text (paragraph, description) → `widget: "text"`
- Image field → `widget: "image", required: false`
- True/false toggle → `widget: "boolean"`
- Repeated items (testimonials, steps, cards) → `widget: "list"` with `fields:` sub-fields
- Single repeated value (plain list of strings) → `widget: "list"` with `field: { widget: "string" }`

Add a helpful `hint:` to any field where the purpose isn't obvious. Use `default:` values where appropriate.

---

## Step 7 — Create/Update netlify.toml

If `netlify.toml` doesn't exist, create it. If it exists, ensure it contains:

```toml
[build]
  publish = "."

[[headers]]
  for = "/content/*"
  [headers.values]
    Cache-Control = "no-cache"
```

---

## Step 8 — Verify

After all files are written, confirm:
- [ ] Every piece of editable content has an ID in the HTML and a corresponding JSON field
- [ ] Every JSON field has a matching widget in `admin/config.yml`
- [ ] The `init()` function loads ALL JSON files and calls a render function for each
- [ ] `admin/index.html` exists
- [ ] `netlify.toml` exists with `publish = "."`
- [ ] Netlify Identity widget script is in `index.html`

Report what was created and any fields that may need the client to fill in (e.g. images that were referenced but not uploaded yet).
