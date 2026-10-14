import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('public');
http.createServer(async (req,res) => {
  try {
    const target = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if (target !== root && !target.startsWith(root + path.sep)) {res.writeHead(403).end(); return;}
    const file = target === root ? path.join(root,'index.html') : target;
    const content = await readFile(file);
    res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'})[path.extname(file)] || 'application/octet-stream'}).end(content);
  } catch {res.writeHead(404).end('Não encontrado');}
}).listen(3000,'127.0.0.1',() => console.log('Recreação: http://localhost:3000'));
