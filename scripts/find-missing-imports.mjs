import fs from 'fs';
import { glob } from 'glob';

const hooks = ['useState', 'useEffect', 'useRef', 'useCallback', 'useMemo', 'useContext', 'useReducer', 'useLayoutEffect'];
const files = await glob('src/**/*.{ts,tsx}');

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  for (const hook of hooks) {
    // Check if hook is used in code outside of imports/comments
    const hasUsage = lines.some(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('import') || trimmed.startsWith('//')) return false;
      if (!new RegExp('\\b' + hook + '\\b').test(line)) return false;
      if (line.includes('React.' + hook)) return false;
      return true;
    });
    if (!hasUsage) continue;

    // Check react import
    const hasReactImport = /from\s+['"]react['"]/.test(content);
    if (!hasReactImport) {
      console.log('NO REACT IMPORT:', hook, file);
      continue;
    }

    // Check if imported in react import lines
    const reactImportLines = lines.filter(l => l.includes('from') && l.includes('react'));
    const isImported = reactImportLines.some(l => new RegExp('\\b' + hook + '\\b').test(l));
    if (!isImported) {
      console.log('HOOK NOT IN IMPORT:', hook, file);
    }
  }
}