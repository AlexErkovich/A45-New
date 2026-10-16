import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
// Publish only these frontend assets; never copy the whole checkout or dotfiles.
const publicFiles = ['index.html', 'styles.css', 'app.js', 'project-page.js', 'data/projects.js', 'assets'];
for (const file of publicFiles) await stat(resolve(root, file));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of publicFiles) {
  const destination = resolve(output, file);
  await mkdir(resolve(destination, '..'), { recursive: true });
  await cp(resolve(root, file), destination, { recursive: true, dereference: false });
}
console.log('Production frontend ready in dist/');
