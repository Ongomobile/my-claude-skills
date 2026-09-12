// Paste into mcp__claude-in-chrome__javascript_tool on an open Skool course page.
// Replace GROUP, COURSE, BUILD before running. Fires and returns immediately;
// poll window.__skoolHarvest to watch progress.
//
//   GROUP  = slug in the URL, e.g. "claudecodeprofitroom"
//   COURSE = course name in the URL, e.g. "eeed3be1"
//   BUILD  = JSON.parse(document.getElementById('__NEXT_DATA__').textContent).buildId
//
window.__skoolHarvest = { done: 0, total: 0, files: 0, err: [], saved: false };
(async () => {
  const GROUP = "GROUP_SLUG", COURSE = "COURSE_NAME", BUILD = "BUILD_ID";
  const H = window.__skoolHarvest;
  const root = JSON.parse(document.getElementById("__NEXT_DATA__").textContent)
                 .props.pageProps.course;

  const nodes = [];
  (function walk(n, d) {
    const m = (n.course && n.course.metadata) || {};
    nodes.push({ id: n.course.id, title: m.title || "", depth: d,
                 kids: (n.children || []).length });
    (n.children || []).forEach(x => walk(x, d + 1));
  })(root, 0);
  H.total = nodes.length;

  const res = [];
  for (const nd of nodes) {
    if (nd.kids > 0) { res.push({ ...nd, meta: null }); H.done++; continue; }
    try {
      const u = `/_next/data/${BUILD}/${GROUP}/classroom/${COURSE}.json`
              + `?md=${nd.id}&group=${GROUP}&id=${COURSE}`;
      const p = JSON.parse(await (await fetch(u, { credentials: "include" })).text()).pageProps;
      let hit = null;
      (function w2(n) {
        if (n.course && n.course.id === nd.id) hit = n.course.metadata;
        (n.children || []).forEach(w2);
      })(p.course);
      res.push({ ...nd, meta: hit });
    } catch (e) {
      H.err.push(nd.title + ": " + e.message);
      res.push({ ...nd, meta: null });
    }
    H.done++;
  }

  // Attachments: metadata.resources is a JSON string. Entries with a file_id
  // need a short-lived signed URL, and only the browser can ask for one.
  H.files = 0;
  for (const r of res) {
    const raw = (r.meta || {}).resources;
    if (!raw || raw === "[]") continue;
    let list;
    try { list = JSON.parse(raw); } catch { continue; }
    for (const item of list) {
      if (!item.file_id) continue;
      try {
        const resp = await fetch(
          `https://api2.skool.com/files/${item.file_id}/download-url?expire=28800`,
          { method: "POST", credentials: "include" });
        if (resp.ok) { item.dl = (await resp.text()).trim(); H.files++; }
      } catch (e) { H.err.push("file " + item.file_name + ": " + e.message); }
    }
    r.meta.resources = JSON.stringify(list);
  }

  const payload = JSON.stringify(res);
  H.bytes = payload.length;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  a.download = COURSE + "-course.json";
  document.body.appendChild(a); a.click(); a.remove();
  H.saved = true;
})();
"started";
