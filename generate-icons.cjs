const sharp = require('sharp');
const fs = require('fs');
const pngToIco = require('png-to-ico');

async function generate() {
  console.log('Reading SVG...');
  const svgBuffer = Buffer.from(fs.readFileSync('public/favicon.svg', 'utf8').replace('viewBox="0 0 100 100"', 'width="100" height="100" viewBox="0 0 100 100"'));
  
  console.log('Generating PNGs...');
  await sharp(svgBuffer).resize(32, 32).png().toFile('public/favicon-32x32.png');
  await sharp(svgBuffer).resize(16, 16).png().toFile('public/favicon-16x16.png');
  await sharp(svgBuffer).resize(180, 180).png().toFile('public/apple-touch-icon.png');

  console.log('Generating ICO...');
  const buf = await pngToIco('public/favicon-32x32.png');
  fs.writeFileSync('public/favicon.ico', buf);
  
  console.log('Done generating icons!');
}

generate().catch(console.error);
