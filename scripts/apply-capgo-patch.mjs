#!/usr/bin/env node
/**
 * Apply @capgo/camera-preview patch (patch-package parser can fail on large patches;
 * GNU patch is the fallback).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const patchPath = path.join(root, 'patches/@capgo+camera-preview+7.5.0.patch');
const pluginSwift = path.join(
  root,
  'node_modules/@capgo/camera-preview/ios/Sources/CapgoCameraPreviewPlugin/Plugin.swift',
);

const cameraControllerSwift = path.join(
  root,
  'node_modules/@capgo/camera-preview/ios/Sources/CapgoCameraPreviewPlugin/CameraController.swift',
);

function patchLooksApplied() {
  if (!fs.existsSync(pluginSwift)) return false;
  const pluginSrc = fs.readFileSync(pluginSwift, 'utf8');
  const controllerSrc = fs.existsSync(cameraControllerSwift)
    ? fs.readFileSync(cameraControllerSwift, 'utf8')
    : '';
  return (
    pluginSrc.includes('hasExplicitWidth') &&
    pluginSrc.includes('Honor explicit dimensions from setPreviewSize') &&
    controllerSrc.includes('Full-bleed explicit size') &&
    controllerSrc.includes('previewLayer.videoGravity = .resizeAspectFill') &&
    controllerSrc.includes('movieFragmentInterval = CMTime.invalid')
  );
}

if (patchLooksApplied()) {
  process.exit(0);
}

try {
  execSync('npx patch-package @capgo/camera-preview', {
    cwd: root,
    stdio: 'pipe',
  });
} catch {
  execSync(`patch -p1 -i "${patchPath}"`, { cwd: root, stdio: 'inherit' });
}

if (!patchLooksApplied()) {
  console.error(
    '[apply-capgo-patch] Capgo fullscreen/audio patch did not apply. Run: patch -p1 -i patches/@capgo+camera-preview+7.5.0.patch',
  );
  process.exit(1);
}
