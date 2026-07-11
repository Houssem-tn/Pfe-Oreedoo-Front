// Copies tracked example environment files to their real (git-ignored)
// counterparts on first setup, without overwriting files that already
// exist. Run with: npm run env:setup
const fs = require('fs');
const path = require('path');

const envDir = path.join(__dirname, '..', 'src', 'environments');

const pairs = [
  ['environment.development.example.ts', 'environment.development.ts'],
  ['environment.production.example.ts', 'environment.production.ts'],
];

for (const [exampleName, realName] of pairs) {
  const examplePath = path.join(envDir, exampleName);
  const realPath = path.join(envDir, realName);

  if (fs.existsSync(realPath)) {
    console.log(`skip  ${realName} (already exists)`);
    continue;
  }

  fs.copyFileSync(examplePath, realPath);
  console.log(`created ${realName} from ${exampleName} — fill in real values before use`);
}
