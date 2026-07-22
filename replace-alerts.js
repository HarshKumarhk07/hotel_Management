const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend/src');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const allFiles = getAllFiles(directoryPath);

allFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('alert(')) {
    let original = content;

    // Check if it's already importing toast
    if (!content.includes("import { toast } from 'sonner'")) {
      // Find the last import statement or the top of the file
      const importMatches = [...content.matchAll(/^import .*? from .*?;?$/gm)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const insertPos = lastImport.index + lastImport[0].length;
        content = content.slice(0, insertPos) + "\nimport { toast } from 'sonner';" + content.slice(insertPos);
      } else {
        content = "import { toast } from 'sonner';\n" + content;
      }
    }

    // Smart replace for alerts
    content = content.replace(/alert\((.*?)\)/g, (match, innerText) => {
      let lowerInner = innerText.toLowerCase();
      // Error keywords
      if (
        lowerInner.includes('fail') || 
        lowerInner.includes('could not') || 
        lowerInner.includes('invalid') || 
        lowerInner.includes('error') || 
        lowerInner.includes('please')
      ) {
        return `toast.error(${innerText})`;
      } 
      // Success keywords
      else if (lowerInner.includes('success')) {
        return `toast.success(${innerText})`;
      } 
      // Default to info
      else {
        return `toast.info(${innerText})`;
      }
    });

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
});
console.log('All alerts replaced with sonner toast.');
