# Reaching the sources

Verified by trial. The point of this file is that you don't spend rounds rediscovering which routes are dead.

## Access matrix

| Route | Reddit | Etsy | Trade forums |
|---|---|---|---|
| `WebSearch` with `allowed_domains` | ❌ 400 error | — | ✅ |
| `WebFetch` direct | ❌ | ❌ 403 | ✅ |
| In-app browser (`Claude_Browser`) | ❌ blocked by policy | ❌ bot-blocked | ✅ |
| **Claude in Chrome extension, logged in** | ✅ **only working route** | ❌ blocked by policy | ✅ |

**Reddit → Chrome extension only. Etsy → no automated route exists at all.**

Do not retry the blocked routes hoping for a different result. If Reddit is unavailable, say so and run forums-only rather than burning rounds.

Also dead: appending `.json` to a Reddit URL. Reddit deprecated unauthenticated `.json` endpoints on 28 May 2026 and they have returned 403 since 30 May. The official Data API needs OAuth credentials that route through a manual approval process. Neither is a shortcut worth attempting mid-run.

## Connecting the Chrome extension

```
list_connected_browsers          → returns [] if nothing is paired
select_browser {deviceId}
tabs_context_mcp {createIfEmpty: true}
navigate {tabId, url}
```

Load these tools in a single `ToolSearch` call rather than one at a time:

```
select:mcp__claude-in-chrome__list_connected_browsers,mcp__claude-in-chrome__select_browser,mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__read_page
```

**If `list_connected_browsers` returns `[]`, nothing is paired.** Stop and fix that before any other debugging — every downstream symptom will be confusing until it's resolved.

**The gotcha that costs the most time:** being logged into claude.ai in Chrome is *not* the same as being signed into the Claude in Chrome extension. It's a separate install with its own sign-in. If the user says "I'm logged in," ask specifically whether they're signed into the *extension's side panel*. This one confusion cost roughly eight rounds on the source run.

`switch_browser` broadcasts a pairing request to every Chrome with the extension installed.

## Reddit URL patterns

**Working:**
- Subreddit search: `/r/{sub}/search/?q=TERMS&restrict_sr=1&sort=relevance&t=all`
- Site-wide search: `/search/?q=TERMS&sort=relevance&t=year`
- Thread: `/r/{sub}/comments/{id}/{slug}/`

**Broken:** `/r/{sub}/comments/search/?q=...` — returns an empty accessibility tree.

## The navigation trap

Clicking a search result often fails to navigate. Reddit is a single-page app; the click registers without a page change, and `get_page_text` returns the same search results again. This looks like the page didn't load and invites a retry loop.

**Fix:** `read_page {filter: "interactive"}` → read the `href` → `navigate` to it directly. Never loop on clicks.

## Reading threads efficiently

One `get_page_text` call returns the entire comment tree — nested and attributed. No scrolling, no expanding replies. It is the most efficient call in the workflow: budget exactly one per thread.

## Etsy and supply-side data

There is no working route. Etsy bot-blocks the crawler (403) and shows *"Access is temporarily restricted… Automated (bot) activity on your network"* to real browsers. Logging in does not help — the block is on domain policy and bot detection, not authentication.

**Workaround:** `WebSearch` for Etsy market pages. Search snippets surface listing titles, price ranges, and category counts without loading the site. This yields **directional saturation data only**. Always flag it as unverified and tell the user to spot-check the top listings manually.

Gumroad, CodeCanyon, and vendor pricing pages are reachable normally with `WebFetch` and are better sources for the supply-side scan.
