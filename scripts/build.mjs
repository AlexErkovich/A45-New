import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { publicSupabaseConfig } from '../src/build-config.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
// Publish only these frontend assets; never copy the whole checkout or dotfiles.
await import('./generate-icons.mjs');
const publicFiles = ['index.html', 'styles.css', 'ui.css', 'app.js', 'card-motion.js', 'home-page.js', 'icons.js', 'feedback.js', 'project-page.js', 'admin.css', 'data/projects.js', 'assets'];
for (const file of publicFiles) await stat(resolve(root, file));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of publicFiles) {
  const destination = resolve(output, file);
  await mkdir(resolve(destination, '..'), { recursive: true });
  await cp(resolve(root, file), destination, { recursive: true, dereference: false });
}
if (existsSync(resolve(root, '.env.local'))) process.loadEnvFile(resolve(root, '.env.local'));
const config = publicSupabaseConfig(process.env);
await build({ entryPoints: [resolve(root, 'src/cloud-entry.js')], bundle: true, platform: 'browser', format: 'iife', target: ['es2022'], minify: true, outfile: resolve(output, 'integration.js'), define: { __A45_SUPABASE_CONFIG__: JSON.stringify(config) } });
// Retain source-directory preview compatibility; this generated file is ignored by Git.
await cp(resolve(output, 'integration.js'), resolve(root, 'integration.js'));
console.log('Production frontend ready in dist/. Supabase: ' + (config ? 'configured' : 'disabled (local fallback)'));

await build({entryPoints:[resolve(root,'src/image-worker.mjs')],bundle:true,platform:'browser',format:'iife',target:['es2022'],minify:true,outfile:resolve(output,'image-worker.js')});

// PDF viewer is loaded only when a PDF is opened; worker/fonts remain first-party assets.
await build({entryPoints:[resolve(root,'src/ui/pdf-preview.mjs')],bundle:true,platform:'browser',format:'esm',target:['es2022'],minify:true,outfile:resolve(output,'pdf-preview.js')});
await cp(resolve(root,'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),resolve(output,'pdf.worker.min.mjs'));
for(const directory of ['cmaps','standard_fonts','wasm'])await cp(resolve(root,'node_modules/pdfjs-dist',directory),resolve(output,'pdf-assets',directory),{recursive:true});
await cp(resolve(root,'node_modules/pdfjs-dist/LICENSE'),resolve(output,'pdf-assets/LICENSE'));
