// Genera iconos PNG (app, notificación, splash) a partir de los SVG. Uso: node tools/render-icons.cjs <ruta-sharp>
const path = require('path'); const fs = require('fs');
const sharp = require(process.argv[2] || 'sharp');
const root = path.join(__dirname, '..');
const logo = fs.readFileSync(path.join(root, 'www/assets/logo.svg'));
const out = path.join(root, 'resources'); fs.mkdirSync(out, { recursive: true });
(async () => {
  await sharp(logo, { density: 1200 }).resize(1024, 1024).png().toFile(path.join(out, 'icon.png'));
  // primer plano adaptativo: logo al 66 % sobre transparente (zona segura)
  const fg = await sharp(logo, { density: 1200 }).resize(700, 700).png().toBuffer();
  await sharp({ create: { width: 1080, height: 1080, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fg, gravity: 'center' }]).png().toFile(path.join(out, 'icon-foreground.png'));
  // splash: fondo marfil con el logo
  const sp = await sharp(logo, { density: 1200 }).resize(640, 640).png().toBuffer();
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: '#F6F2EA' } }).composite([{ input: sp, gravity: 'center' }]).png().toFile(path.join(out, 'splash.png'));
  // icono de notificación: silueta blanca de la hoja
  const stat = fs.readFileSync(path.join(root, 'tools/ic_stat.svg'));
  for (const [d, s] of [['mdpi', 24], ['hdpi', 36], ['xhdpi', 48], ['xxhdpi', 72], ['xxxhdpi', 96]]) {
    fs.mkdirSync(path.join(out, 'stat', `drawable-${d}`), { recursive: true });
    await sharp(stat, { density: 1200 }).resize(s, s).png().toFile(path.join(out, 'stat', `drawable-${d}`, 'ic_stat_hs.png'));
  }
  // mipmaps clásicos para Android
  for (const [d, s] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
    const dir = path.join(out, 'mipmap', `mipmap-${d}`); fs.mkdirSync(dir, { recursive: true });
    await sharp(logo, { density: 1200 }).resize(s, s).png().toFile(path.join(dir, 'ic_launcher.png'));
    await sharp(logo, { density: 1200 }).resize(s, s).png().toFile(path.join(dir, 'ic_launcher_round.png'));
    const fs2 = Math.round(s * 108 / 48);
    const inner = await sharp(fs.readFileSync(path.join(root, 'tools/logo-foreground.svg')), { density: 1200 }).resize(Math.round(fs2 * 0.66), Math.round(fs2 * 0.66)).png().toBuffer();
    await sharp({ create: { width: fs2, height: fs2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: inner, gravity: 'center' }]).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
  }
  console.log('ok');
})();
