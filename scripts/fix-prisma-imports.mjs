import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const distDir = 'dist/generated/prisma';

async function findJsFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findJsFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const files = await findJsFiles(distDir);
  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const fixed = content.replace(
      /(import\s+(?:\*\s+as\s+\w+\s+)?(?:type\s+)?{[^}]*}\s+)?from\s+['"]\.(\/[^'"]+)['"]/g,
      (match, prefix, path) => {
        if (path.endsWith('.js')) return match;
        return match.replace(path, path + '.js');
      }
    );
    
    const exportFixed = fixed.replace(
      /(export\s+(?:\*\s+as\s+\w+\s+)?\*\s+from\s+['"])(\.\/[^'"]+)['"]/g,
      (match, prefix, path) => {
        if (path.endsWith('.js')) return match;
        return match.replace(path, path + '.js');
      }
    );
    
    if (content !== exportFixed) {
      await writeFile(file, exportFixed);
      console.log(`Patched: ${file}`);
    }
  }
}

main().catch(console.error);
