---
name: acw-reel
description: Build a branded AI Creators' Workshop vertical reel (1080x1920 MP4) from a topic, in the workshop-light and shop-dark themes. Use when the user says "make a reel", "build a reel about X", "make a video for the workshop", "AI trick of the day video", "turn this into a reel", or asks for a branded short video / Instagram Reel / TikTok / YouTube Short. Also use to re-render or restyle an existing reel in this system.
---

# ACW Reel

Build a 30-second branded vertical reel as a real MP4. One command does the render, the frame capture, and the encode.

The look is fixed: AI Creators' Workshop brand, Inter 900 headlines, orange accent, paper texture, persistent footer strip. You write the scenes. The pipeline does the rest.

## How it works

Three moving parts, all in this skill:

| File | Job |
|---|---|
| `templates/Main.dc.html` | The reel itself. Scenes, copy, timings, animation. **This is the only file you edit.** |
| `scripts/make-render.py` | Bakes one theme into a scrubbable standalone page. |
| `scripts/capture.mjs` | Drives headless Chrome, grabs all 900 frames. |
| `scripts/build.sh` | Runs all of it and encodes the MP4s. |
| `templates/phone-demo.html` | Optional scene type for reels about an app: the app on a phone, tapped through step by step. A reference to copy pieces from, not a page. |

Frames come from Chrome, not from ffmpeg text filters. **This machine's ffmpeg has no `drawtext`** (built without libfreetype), so never try to draw text with ffmpeg. Chrome renders, ffmpeg only encodes.

## Build a reel

1. **Make the working folder.** One per reel, next to the other reels:

   ```bash
   mkdir -p "/Volumes/My Mac Drive/AI Creators Workshop /Reels/<slug>-reel"
   ```

   Copy in the template and the pipeline:

   ```bash
   S=~/.claude/skills/acw-reel
   D="/Volumes/My Mac Drive/AI Creators Workshop /Reels/<slug>-reel"
   cp "$S/templates/Main.dc.html" "$S/templates/canvas.json" "$D/"
   cp "$S/scripts/make-render.py" "$S/scripts/capture.mjs" "$S/scripts/shot.mjs" "$D/"
   cp "$S/assets/logo.png" "$S/assets/paper-texture.svg" "$D/"
   ```

2. **Write the scenes** into `Main.dc.html` (see "Writing the scenes" below).

3. **Build both themes:**

   ```bash
   ~/.claude/skills/acw-reel/scripts/build.sh \
     "/Volumes/My Mac Drive/AI Creators Workshop /Reels/<slug>-reel" \
     "/Volumes/My Mac Drive/AI Creators Workshop /Reels" \
     "<Reel Name>"
   ```

   Output: `<Reel Name> - ACW workshop.mp4` and `<Reel Name> - ACW dark.mp4`.
   Add theme names to the end of the command to change which get built (`workbench`, `dark`, `paint`).

4. **Check a frame before you hand it over.** Never ship a reel you have not looked at. Start Chrome yourself, then use `shot.mjs`:

   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
     --hide-scrollbars --force-device-scale-factor=1 --remote-debugging-port=9222 \
     --user-data-dir=/tmp/acw-chrome --window-size=1080,1920 about:blank &
   sleep 4
   node shot.mjs "file://$PWD/render-dark.html" 12000 /tmp/check.png
   ```

   Read the PNG. Check: nothing clipped, nothing overlapping the footer, the orange rule drew, text fits. Fix and rebuild before handing over.

## Writing the scenes

Edit only inside the `<sc-if>` blocks, the footer strip, and the `durations` array.

**Three things must stay in sync:**
- One `<sc-if value="{{ sN }}">` block per scene
- One entry in `this.durations = [...]` per scene
- One `sN: this.state.scene === N` flag in `renderVals()` per scene

**Timing.** Six scenes at ~5000ms each gives 30s. Keep each scene 4500-5500ms: under 4.5s people cannot read it, over 5.5s they scroll away. The durations must total the runtime you promised.

**Fixed scene shapes.** Scene 0 is always the hook (big logo, "AI Trick of the Day" tape, two-line headline, orange rule, twist line). The last scene is always the CTA (small logo, "Your turn" stamp, lead-in, headline, orange rule, URL, socials). Do not redesign these two; only change their words.

**Middle scenes** pick from the patterns already in the template: chip row, quote card with animated strike, before/after bars, terminal card with bullets. For a reel about an app, add the **phone demo** from `templates/phone-demo.html` (see "Phone demo scenes" below). Reuse and re-word them rather than inventing new layouts.

**The footer strip** appears on every scene. Change only the second line: `<series name> · #NN`. Bump the number for each new reel in a series.

### Layout rules that bite

- **Safe zones.** Scene padding is `~170px` top and `~210px` bottom for a reason: social UI covers the top ~250px and bottom ~350px. Never reduce the bottom padding below 200px; the footer strip lives in the last 150px.
- **Headline sizes.** 108px for a two-line hook, 128-138px for a one or two-line middle headline. More than two lines at those sizes overflows.
- **Text length.** Headlines under 6 words. Sub-lines under 12. Long copy will not fit and will not be read.
- **Stagger.** Animate elements in with `.10s` to `.15s` gaps. Everything landing at once looks cheap; more than ~1.5s of stagger wastes the scene.
- **Chips.** First one or two take the accent fill, the rest `chip-bg`. That is what makes the eye land in the right place.

### Phone demo scenes (showing an app)

Use when the reel is about something people use on a screen: a booking calendar, an estimator, a tracker. It shows the real flow instead of describing it. Two phone scenes at most, usually "tap through" then "result".

- **Recreate the app, don't screenshot it.** Rebuild its screen in HTML inside `.ph-screen`, from the app's real markup and styles. Use sample data only (a sample business, "Sarah"), never real customer details. It stays crisp at 1080 wide and scrubs frame-exact.
- **Draw at 2x the app's phone layout.** A 375px mobile screen becomes about 750px: body text 30px or more, buttons 84px tall or more. Reels are watched about 390px wide, so check by downscaling a frame to 390px. If you can't read it there, it's too small.
- **Placement.** Tag, then a two-line headline at ~100px, then the phone (`.ph-frame`, 780x1010) centered. Its top lands near 530px and its bottom must stay above 1570px, clear of the bottom social UI and the footer strip.
- **Timing (scene 5000-5400ms).** The phone is in by 0.9s. First tap no earlier than 1.9s. Typed text finishes at least 0.4s before the tap that submits. The result lands by about 3.8s and holds at least 1.2s.
- **Taps.** Put a `.ph-ring` inside the tapped element (no coordinate math) and give the element `pressIn` (tiles) or `btnPress` (sticker buttons).
- **Two animations, one property.** The later animation's `both` fill applies even before its delay and overrides the earlier one. So when an element pops in *and* gets pressed, use `forwards` on the press. For fade in then out, nest two elements: the outer fades in with `both`, the inner fades out with `forwards`.
- **State changes** (a selected day, a button label swap) are keyframes with `both` fill, so frames before the change show the old state.
- **Typing.** `typeIn` with `steps(<number of characters>, end)`.

### Client-facing cut

The same reel can be recut for clients instead of workshop members. Swap `logo.png` for a square photo in the hook, CTA and footer `<img>` tags, change the footer's brand line and series line, and re-word the hook tape and CTA stamp ("For service businesses", "Want one?"). The fixed shapes stay the same.

### Copy voice

Mike's: short, declarative, second person, peer-to-peer. **No em dashes.** No SaaS slop ("unlock", "seamless", "supercharge"). State the benefit plainly. One idea per scene.

Facts you do not have (a price, a date, a claim) stay out. Never invent a statistic to fill a scene.

## Themes

| Name | Look | File suffix |
|---|---|---|
| `workbench` | Light paper, ink text | `- ACW workshop.mp4` |
| `dark` | Shop dark, cream text | `- ACW dark.mp4` |
| `paint` | Orange flood, cream text | `- ACW paint.mp4` |

All three share the orange `#E8703A` accent. Themes are defined twice, in `Main.dc.html` (`THEMES`) and in `make-render.py` (`THEMES`). **Change both or the preview and the render drift apart.**

## Output spec

1080x1920, 30fps, H.264 yuv420p, faststart. About 1-4 MB for 30 seconds. Good for Reels, TikTok, Shorts, and Skool.

## When something breaks

| Symptom | Cause |
|---|---|
| `make-render.py` asserts on `{{ ... }}` | A theme placeholder in the stage that is not a THEMES key. Check spelling. |
| `harness not loaded` | Chrome loaded the page before the script ran, or the stage markers were edited. Keep the `<!-- ===== THE 1080x1920 REEL STAGE` and `<!-- ===================== CONTROL BAR` comments exactly as they are: `make-render.py` slices between them. |
| Blank or dark frames | Chrome debug port not up. Wait longer after launching, confirm with `curl http://127.0.0.1:9222/json/version`. |
| Text clipped at the bottom | Scene content is too tall. Cut words first, then reduce the headline size. |
| Missing logo or texture | `logo.png` and `paper-texture.svg` were not copied into the reel folder. They are referenced as `./`. |

## Requirements

Chrome, node, python3, ffmpeg with libx264. All present on this machine. Nothing to install.

## Worked example

`Reels/humanizer-reel/` is a finished reel built with this system: six scenes, 30s, both themes. Read its `Main.dc.html` when you want to see the patterns filled in with real copy.

`Reels/booking-calendar-reel/` uses the phone demo (scenes 2 and 3) and a generic booking page struck through in the quote card (scene 1). `Reels/booking-calendar-clients-reel/` is its client-facing cut.
