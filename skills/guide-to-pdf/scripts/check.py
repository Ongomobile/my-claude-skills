#!/usr/bin/env python3
"""
Look at a finished PDF, page by page, and measure it.

    python3 check.py <guide.html> <guide.pdf>

Why this exists: reading the PDF's paint instructions is not proof. A rectangle
can be drawn and then clipped away, and the numbers will still look right. The
only honest check is to rasterise every page and read the pixels. That is what
this does.

No third-party packages. `qlmanage` is built into macOS and rasterises PDFs;
poppler is not installed on this machine.

Reports, per page:
  * top inset      -> the first row containing ink. Should be ~16mm on every page.
  * edge colour    -> the four corners and four edge midpoints. Should be cream,
                      unless a page deliberately bleeds artwork to an edge.
Plus, once:
  * page count, file size, clickable link count
"""
import os, re, struct, subprocess, sys, tempfile, zlib

CREAM = (245, 239, 226)      # --canvas #F5EFE2
TOL   = 6                    # per-channel tolerance when calling a pixel cream
INK   = 10                   # per-channel difference that counts as ink


def png_pixels(path):
    """Decode a PNG to (width, height, channels, raw bytes). Pure stdlib."""
    d = open(path, 'rb').read()
    pos, idat = 8, b''
    w = h = ct = None
    while pos < len(d):
        ln = struct.unpack('>I', d[pos:pos + 4])[0]
        typ = d[pos + 4:pos + 8]
        data = d[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            w, h, _bd, ct = struct.unpack('>IIBB', data[:10])
        elif typ == b'IDAT':
            idat += data
        elif typ == b'IEND':
            break
        pos += 12 + ln
    ch = {0: 1, 2: 3, 4: 2, 6: 4}[ct]
    raw = zlib.decompress(idat)
    stride = w * ch
    out, prev, i = bytearray(), bytearray(stride), 0
    for _ in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        for x in range(stride):
            a = line[x - ch] if x >= ch else 0
            b = prev[x]
            c = prev[x - ch] if x >= ch else 0
            if f == 1:   line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out += line
        prev = line
    return w, h, ch, bytes(out)


def pdf_facts(pdf):
    d = open(pdf, 'rb').read()
    return dict(
        pages=len(re.findall(rb'/Type\s*/Page[^s]', d)),
        kb=round(len(d) / 1024),
        links=len(re.findall(rb'/Subtype\s*/Link', d)),
        uris=sorted({u.decode('latin-1') for u in re.findall(rb'/URI\s*\(([^)]*)\)', d)}),
        box=sorted({b.decode('latin-1').strip() for b in re.findall(rb'/MediaBox\s*\[([^\]]*)\]', d)}),
    )


def per_page_pdfs(src_html, n, outdir):
    """Print each page to its own PDF over CDP, so each can be rasterised."""
    js = r'''
import fs from 'node:fs';
const list=await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws=new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl);
let id=0;const pend=new Map();
await new Promise(r=>ws.onopen=r);
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}));});
await send('Page.enable');
await send('Page.navigate',{url:process.env.SRC});
await new Promise(r=>setTimeout(r,9000));
for(let p=1;p<=Number(process.env.N);p++){
  const r=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,
    marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,pageRanges:String(p)});
  const d=r.result?.result?.data ?? r.result?.data;
  if(d) fs.writeFileSync(`${process.env.OUT}/p${p}.pdf`, Buffer.from(d,'base64'));
}
ws.close(); process.exit(0);
'''
    prof = tempfile.mkdtemp()
    chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    subprocess.run(["pkill", "-f", "remote-debugging-port=9222"], capture_output=True)
    proc = subprocess.Popen([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                             "--remote-debugging-port=9222", f"--user-data-dir={prof}",
                             "--window-size=900,1200", "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    import time; time.sleep(4)
    script = os.path.join(outdir, "_pp.mjs")
    open(script, "w").write(js)
    env = dict(os.environ, SRC="file://" + os.path.abspath(src_html), N=str(n), OUT=outdir)
    subprocess.run(["node", script], env=env, capture_output=True)
    proc.terminate()
    subprocess.run(["pkill", "-f", "remote-debugging-port=9222"], capture_output=True)
    for p in range(1, n + 1):
        f = os.path.join(outdir, f"p{p}.pdf")
        if os.path.exists(f):
            subprocess.run(["qlmanage", "-t", "-s", "900", "-o", outdir, f], capture_output=True)


def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    src_html, pdf = sys.argv[1], sys.argv[2]
    facts = pdf_facts(pdf)
    print(f"{facts['pages']} pages, {facts['kb']} KB, MediaBox {facts['box']}")
    print(f"{facts['links']} clickable links")
    for u in facts['uris']:
        print("   ", u)
    print()

    tmp = tempfile.mkdtemp()
    per_page_pdfs(src_html, facts['pages'], tmp)

    print("page   top inset    edges")
    ok = True
    for p in range(1, facts['pages'] + 1):
        img = os.path.join(tmp, f"p{p}.pdf.png")
        if not os.path.exists(img):
            print(f"  {p}     (could not rasterise)"); ok = False; continue
        w, h, ch, px = png_pixels(img)

        def pix(x, y):
            o = (y * w + x) * ch
            return (px[o], px[o + 1], px[o + 2])

        def has_ink(y):
            return any(any(abs(pix(x, y)[k] - CREAM[k]) > INK for k in range(3))
                       for x in range(0, w, 2))

        top = next((y for y in range(h) if has_ink(y)), h)
        mm = top / h * 279.0
        pts = [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3),
               (w // 2, 1), (w // 2, h - 2), (1, h // 2), (w - 2, h // 2)]
        bad = [f"{x},{y}=rgb{pix(x,y)}" for x, y in pts
               if any(abs(a - b) > TOL for a, b in zip(pix(x, y), CREAM))]
        flag = ""
        if mm < 12:
            flag += "  *** TOP TOO TIGHT ***"; ok = False
        if bad:
            flag += "  (non-cream edge: " + ", ".join(bad[:2]) + ")"
        print(f"  {p}     {mm:4.1f}mm      {'cream' if not bad else 'see note'}{flag}")

    print()
    print("PASS" if ok else "SOMETHING NEEDS FIXING")
    print(f"page images kept in {tmp} - LOOK AT THEM before shipping")


if __name__ == "__main__":
    main()
