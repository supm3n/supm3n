const fs = require('fs');
const path = require('path');

// --- Configuration ---

// 1. Define all our projects
const projects = [
  { name: 'landingpage', path: 'landingpage' },
  { name: 'disasters', path: 'projects/disasters' },
  { name: 'settleup', path: 'projects/settleup' },
  { name: 'snake', path: 'projects/snake' },
  { name: 'stock-viewer', path: 'projects/stock-viewer' }
];

// 2. Define our shared component files
const sharedDir = path.join(__dirname, 'landingpage', 'shared');
const headerFile = path.join(sharedDir, 'components', 'header.html');
const footerFile = path.join(sharedDir, 'components', 'footer.html');

// 3. Define the output build directory
const buildDir = path.join(__dirname, 'dist');

// --- Helper Functions ---

/**
 * Copies all files and directories from a source to a destination,
 * but skips 'index.html' which we process separately.
 */
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      // Skip node_modules and other junk
      if (childItemName === 'node_modules' || childItemName === '.git') {
        return;
      }
      
      // We skip index.html because we process it separately
      if (childItemName.toLowerCase() === 'index.html') {
        return;
      }

      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    // It's a file. Copy it.
    if (!fs.existsSync(path.dirname(dest))) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

// --- Build Script Logic ---

function runBuild() {
  console.log('🚀 Starting build...');

  // 1. Clean up old build directory
  console.log(`🧹 Cleaning ${buildDir}...`);
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
  fs.mkdirSync(buildDir);

  // 2. Read shared components into memory
  let headerHtml, footerHtml;
  try {
    headerHtml = fs.readFileSync(headerFile, 'utf8');
    footerHtml = fs.readFileSync(footerFile, 'utf8');
    console.log('✅ Loaded shared header and footer.');
  } catch (e) {
    console.error('❌ FATAL: Could not read shared components.', e);
    return;
  }

  // 3. Loop over each project and build it
  for (const project of projects) {
    console.log(`\n📦 Building project: ${project.name}...`);
    const srcPath = path.join(__dirname, project.path);
    const destPath = path.join(buildDir, project.name); // Output to dist/snake, dist/disasters, etc.
    
    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠️ Skipping ${project.name}: Source path not found.`);
      continue;
    }
    
    // 4. Copy all assets (CSS, JS, images, etc.)
    // This skips index.html
    copyRecursiveSync(srcPath, destPath);
    console.log(`    Copied assets for ${project.name}.`);

    // 5. Read, process, and write index.html
    const indexFile = path.join(srcPath, 'index.html');
    if (fs.existsSync(indexFile)) {
      let indexContent = fs.readFileSync(indexFile, 'utf8');

      // Do the magic replacement
      indexContent = indexContent.replace(
        /\{\{HEADER_PLACEHOLDER\}\}/g,
        headerHtml
      );
      indexContent = indexContent.replace(
        /\{\{FOOTER_PLACEHOLDER\}\}/g,
        footerHtml
      );

      fs.writeFileSync(path.join(destPath, 'index.html'), indexContent);
      console.log(`    Processed index.html for ${project.name}.`);
    } else {
      console.warn(`    No index.html found for ${project.name}.`);
    }
  }

  console.log('\n✨ Build complete! Output is in the /dist folder.');
}

// Run the build
runBuild();