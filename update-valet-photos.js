const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/src/app/valet/page.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove photo validation alert
const validationRegex = /\s*if \(!photoFront \|\| !photoRear \|\| !photoLeft \|\| !photoRight \|\| !photoDashboard\) \{[\s\S]*?\}/;
content = content.replace(validationRegex, '');

// 2. Remove asterisks from photo labels
content = content.replace(/'Front Angle \*'/g, "'Front Angle'");
content = content.replace(/'Rear Angle \*'/g, "'Rear Angle'");
content = content.replace(/'Left Side \*'/g, "'Left Side'");
content = content.replace(/'Right Side \*'/g, "'Right Side'");
content = content.replace(/'Dashboard \/ Odo \*'/g, "'Dashboard / Odo'");

// 3. Move the photos grid from Step 1 to Step 2
// The photos grid starts with <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5 pt-2">
const photosBlockRegex = /<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5 pt-2">[\s\S]*?}\)\)}[\s\S]*?<\/div>\s*<\/div>/;
const match = content.match(photosBlockRegex);
if (match) {
  let matchedStr = match[0]; // this is the grid + the closing div of Step 1
  let justGrid = matchedStr.substring(0, matchedStr.lastIndexOf('</div>')).trim();
  
  // Remove it from step 1
  content = content.replace(photosBlockRegex, '</div>');
  
  // Add it to step 2 right above Damage Photos
  const targetLocation = '<div className="flex flex-col gap-1.5 pt-2">\n                      <span className="text-xs font-bold text-zinc-500">Damage Photos (Optional)</span>';
  
  content = content.replace(targetLocation, justGrid + '\n\n                    ' + targetLocation);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Valet form photos updated to optional.');
