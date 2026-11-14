var fs = require('fs');
var c = fs.readFileSync('c:\\Users\\hello\\Documents\\facelook-connect-hub\\src\\components\\ChatSystem.tsx', 'utf8');
var lines = c.split('\n');
// Find and fix line 6308 (index 6307)
for (var i = 0; i < lines.length; i++) {
  if (lines[i].match(/^6308 |/)) {
    lines[i] = '6308 | )';
    break;
  }
}
fs.writeFileSync('c:\\Users\\hello\\Documents\\facelook-connect-hub\\src\\components\\ChatSystem.tsx', lines.join('\n'), 'utf8');
console.log('Fixed line 6308');