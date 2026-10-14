#!/usr/bin/env bash
# Compila la APK en GitHub Actions. Todo lo que pasa queda en build.log.
set -eo pipefail
exec > >(tee build.log) 2>&1
echo "== Dependencias"
npm install --no-audit --no-fund --legacy-peer-deps
echo "== Librerías web"
node tools/prepare-web.mjs
echo "== Proyecto Android"
npx cap add android
node tools/patch-android.mjs
npx cap sync android
echo "== Compilación"
cd android
chmod +x gradlew
./gradlew assembleRelease --no-daemon --stacktrace --warning-mode=summary
cp app/build/outputs/apk/release/app-release.apk ../habitos-saludables.apk
ls -la ../habitos-saludables.apk
