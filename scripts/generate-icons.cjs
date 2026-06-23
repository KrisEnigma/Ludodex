const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function renderSvg(svgPath, pngPath, size = null) {
  let pipeline = sharp(svgPath);
  if (size) {
    pipeline = pipeline.resize(size, size);
  }
  await pipeline.png().toFile(pngPath);
  console.log(`Rendered ${svgPath} -> ${pngPath} (${size ? `${size}x${size}` : 'original'})`);
}

async function main() {
  try {
    // Web PNGs
    await renderSvg('public/icons/icon1.svg', 'public/icons/icon1.png');
    await renderSvg('public/icons/icon4.svg', 'public/icons/icon4.png');
    await renderSvg('public/icons/icon2.svg', 'public/icons/icon2.png');
    await renderSvg('public/icons/icon3.svg', 'public/icons/icon3.png');
    
    // Web Favicons and App Assets
    await renderSvg('public/icons/icon1.svg', 'public/favicon.png', 32);
    await renderSvg('public/icons/icon1.svg', 'public/apple-touch-icon.png', 180);
    await renderSvg('public/icons/icon1.svg', 'public/icon-512.png', 512);
    
    // Android densities
    const densities = {
      mdpi: 48,
      hdpi: 72,
      xhdpi: 96,
      xxhdpi: 144,
      xxxhdpi: 192
    };

    const adaptiveSizes = {
      mdpi: 108,
      hdpi: 162,
      xhdpi: 216,
      xxhdpi: 324,
      xxxhdpi: 432
    };

    const icons = {
      void: { svg: 'public/icons/icon1.svg', bgRegex: /<rect width="1024" height="1024" fill="#000000" \/>/, prefix: 'ic_launcher' },
      lumen: { svg: 'public/icons/icon4.svg', bgRegex: /<rect width="1024" height="1024" fill="#ffffff" \/>/, prefix: 'ic_launcher_lumen' },
      neon_horizon: { svg: 'public/icons/icon2.svg', bgRegex: /<rect width="1024" height="1024" fill="#000000" \/>/, prefix: 'ic_launcher_neon_horizon' },
      dot_matrix: { svg: 'public/icons/icon3.svg', bgRegex: /<rect width="1024" height="1024" fill="#9bbc0f" \/>/, prefix: 'ic_launcher_dot_matrix' }
    };
    
    const resDir = 'android/app/src/main/res';
    
    for (const [density, size] of Object.entries(densities)) {
      const mipmapDir = path.join(resDir, `mipmap-${density}`);
      
      // Void (Default)
      await renderSvg('public/icons/icon1.svg', path.join(mipmapDir, 'ic_launcher.png'), size);
      await renderSvg('public/icons/icon1.svg', path.join(mipmapDir, 'ic_launcher_round.png'), size);
      
      // Lumen
      await renderSvg('public/icons/icon4.svg', path.join(mipmapDir, 'ic_launcher_lumen.png'), size);
      await renderSvg('public/icons/icon4.svg', path.join(mipmapDir, 'ic_launcher_lumen_round.png'), size);

      // Neon Horizon
      await renderSvg('public/icons/icon2.svg', path.join(mipmapDir, 'ic_launcher_neon_horizon.png'), size);
      await renderSvg('public/icons/icon2.svg', path.join(mipmapDir, 'ic_launcher_neon_horizon_round.png'), size);

      // Dot Matrix
      await renderSvg('public/icons/icon3.svg', path.join(mipmapDir, 'ic_launcher_dot_matrix.png'), size);
      await renderSvg('public/icons/icon3.svg', path.join(mipmapDir, 'ic_launcher_dot_matrix_round.png'), size);

      // Generate Adaptive Foreground PNGs
      const canvasSize = adaptiveSizes[density];
      const fgSize = Math.round(canvasSize * 0.66); // 72dp safe area size inside 108dp canvas

      for (const [key, config] of Object.entries(icons)) {
        const svgContent = fs.readFileSync(config.svg, 'utf8');
        const transparentSvg = svgContent.replace(config.bgRegex, '');
        
        const innerBuffer = await sharp(Buffer.from(transparentSvg))
          .resize(fgSize, fgSize)
          .png()
          .toBuffer();
          
        await sharp({
          create: {
            width: canvasSize,
            height: canvasSize,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          }
        })
        .composite([{ input: innerBuffer, gravity: 'center' }])
        .png()
        .toFile(path.join(mipmapDir, `${config.prefix}_foreground.png`));
      }
    }

    // Create Adaptive XML Files for API 26+ (anydpi-v26)
    const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
    if (!fs.existsSync(anydpiDir)) fs.mkdirSync(anydpiDir, { recursive: true });

    const adaptiveIconConfigs = {
      ic_launcher: { bg: '@color/ic_background_void', fg: '@mipmap/ic_launcher_foreground' },
      ic_launcher_lumen: { bg: '@color/ic_background_lumen', fg: '@mipmap/ic_launcher_lumen_foreground' },
      ic_launcher_neon_horizon: { bg: '@color/ic_background_neon_horizon', fg: '@mipmap/ic_launcher_neon_horizon_foreground' },
      ic_launcher_dot_matrix: { bg: '@color/ic_background_dot_matrix', fg: '@mipmap/ic_launcher_dot_matrix_foreground' }
    };

    for (const [name, ref] of Object.entries(adaptiveIconConfigs)) {
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="${ref.bg}"/>
    <foreground android:drawable="${ref.fg}"/>
</adaptive-icon>
`;
      fs.writeFileSync(path.join(anydpiDir, `${name}.xml`), xmlContent);
      fs.writeFileSync(path.join(anydpiDir, `${name}_round.xml`), xmlContent);
      console.log(`Created adaptive icon XML files for ${name}`);
    }
    
    // Android Splash Screens (For Android 11 and older, and Android 12+ custom icon)
    const iconSizes = {
      mdpi: 160,
      hdpi: 240,
      xhdpi: 320,
      xxhdpi: 480,
      xxxhdpi: 640
    };

    // Clean up old full-screen splash.png files to prevent resource conflicts
    const oldSplashFiles = [
      path.join(resDir, 'drawable', 'splash.png'),
      ...Object.keys(iconSizes).map(density => path.join(resDir, `drawable-port-${density}`, 'splash.png'))
    ];
    for (const file of oldSplashFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`Deleted old splash screen: ${file}`);
      }
    }

    const svgContent = fs.readFileSync('public/icons/icon1.svg', 'utf8');
    const transparentSvg = svgContent.replace(/<rect width="1024" height="1024" fill="#000000" \/>/, '');

    for (const [density, size] of Object.entries(iconSizes)) {
      const splashDir = path.join(resDir, `drawable-port-${density}`);
      if (!fs.existsSync(splashDir)) fs.mkdirSync(splashDir, { recursive: true });
      
      const iconPath = path.join(splashDir, 'splash_icon.png');
      const innerSize = Math.round(size * 0.48);
      const innerBuffer = await sharp(Buffer.from(transparentSvg))
        .resize(innerSize, innerSize)
        .png()
        .toBuffer();

      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
      .composite([{ input: innerBuffer, gravity: 'center' }])
      .png()
      .toFile(iconPath);
      
      console.log(`Rendered padded transparent splash_icon.png -> ${splashDir} (${size}x${size}, icon size ${innerSize}x${innerSize})`);
    }
    
    // Default fallback splash_icon.png
    const defaultSplashDir = path.join(resDir, 'drawable');
    if (!fs.existsSync(defaultSplashDir)) fs.mkdirSync(defaultSplashDir, { recursive: true });
    fs.copyFileSync(
      path.join(resDir, 'drawable-port-xxhdpi', 'splash_icon.png'),
      path.join(defaultSplashDir, 'splash_icon.png')
    );
    console.log(`Copied fallback splash_icon.png -> ${defaultSplashDir}`);
    
    console.log("All icons successfully compiled with sharp!");
  } catch (err) {
    console.error("Error generating icons:", err);
    process.exit(1);
  }
}

main();
