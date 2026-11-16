import http from 'node:http';
import {readFile} from 'node:fs/promises';
import studio from '../api/studio.mjs';

const staticFiles = {'/':['index.html','text/html'], '/studio.css':['studio.css','text/css'], '/studio.js':['studio.js','application/javascript']};
const server = http.createServer(async (req,res) => {
  const path = new URL(req.url,'http://localhost').pathname;
  try {
    if (path === '/api/studio') {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 12000) { res.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      if (chunks.length) req.body = Buffer.concat(chunks).toString('utf8');
      return await studio(req,res);
    }
    const file = staticFiles[path];
    if (!file) return res.writeHead(404).end();
    res.setHeader('Content-Type',file[1] + '; charset=utf-8');
    res.end(await readFile(new URL('../public/' + file[0],import.meta.url)));
  } catch (error) {
    console.error(error.name);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});
server.listen(Number(process.env.PORT || 3000),'127.0.0.1');
