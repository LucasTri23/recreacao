import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Cada publicação recebe novos nomes para todos os módulos. Assim, o navegador
// nunca combina o app novo com uma dependência antiga em cache.
const source = path.resolve('public');
const output = path.resolve('dist');
const files = (await readdir(source)).sort();
const contents = new Map(await Promise.all(files.map(async file => [file,await readFile(path.join(source,file),'utf8')])));
const hash = createHash('sha256').update(JSON.stringify([...contents])).digest('hex').slice(0,16);
const names = new Map(files.map(file => [file,/\.(js|css)$/.test(file) ? file.replace(/\.(js|css)$/,`.${hash}.$1`) : file]));
await mkdir(output,{recursive:true});
for (const [file,original] of contents) {
  let content = original;
  if (file.endsWith('.js')) content = content.replace(/(['"])(\.\/[^'"\s]+\.js)\1/g,(match,quote,url) => names.has(url.slice(2)) ? `${quote}./${names.get(url.slice(2))}${quote}` : match);
  if (file.endsWith('.html')) content = content.replace(/(src|href)="([^"\s]+\.(?:js|css))"/g,(match,attr,url) => names.has(url) ? `${attr}="${names.get(url)}"` : match);
  await writeFile(path.join(output,names.get(file)),content);
}
console.log(`Site preparado em dist · versão ${hash}`);
