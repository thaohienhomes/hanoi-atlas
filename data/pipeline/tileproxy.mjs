// Local mirror of tiles.openfreemap.org — the sandbox browser cannot reach the
// public internet, but node fetch can. Rewrites absolute URLs inside the style
// JSON so sprites/glyphs/tiles come back through this proxy too.
import http from "node:http";

const UP = "https://tiles.openfreemap.org";
const PORT = 4175;
const SELF = `http://127.0.0.1:${PORT}`;
const cache = new Map();

http
  .createServer(async (req, res) => {
    const path = req.url.split("?")[0];
    console.log("REQ", path);
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      let entry = cache.get(path);
      if (!entry) {
        const upstream = await fetch(UP + path);
        const type = upstream.headers.get("content-type") || "application/octet-stream";
        if (!upstream.ok) {
          res.writeHead(upstream.status).end();
          return;
        }
        let body;
        if (/json/.test(type)) {
          const text = (await upstream.text()).split(UP).join(SELF);
          body = Buffer.from(text);
        } else {
          body = Buffer.from(await upstream.arrayBuffer());
        }
        // node fetch already decompressed the body — never claim it is gzipped.
        entry = { body, type };
        cache.set(path, entry);
      }
      res.writeHead(200, { "content-type": entry.type }).end(entry.body);
    } catch (error) {
      res.writeHead(502).end(String(error));
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log("tile proxy on " + SELF));
