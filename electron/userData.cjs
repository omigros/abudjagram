'use strict';

const fs = require('node:fs');
const path = require('node:path');

const APP_FOLDER = 'Abudjagram';
// Early builds kept data under the package name inherited from Telegram Web A
const LEGACY_FOLDER = 'telegram-t';
const DEV_SUFFIX = 'dev';

// Picks the folder for sessions and settings:
// - a named profile gets `Abudjagram-<profile>`, so it runs alongside the default one (e.g. a second account);
// - development runs get `Abudjagram-dev`, apart from the installed app;
// - the installed app gets `Abudjagram`, moving the legacy folder there once, so nobody has to log in again.
//   If the move fails (e.g. an old version still runs), the legacy folder keeps being used and the move is retried
//   on the next start.
function resolveUserDataPath({ appData, isPackaged, profile }) {
  if (profile) return path.join(appData, `${APP_FOLDER}-${profile.replace(/[^\w-]/g, '')}`);
  if (!isPackaged) return path.join(appData, `${APP_FOLDER}-${DEV_SUFFIX}`);

  const target = path.join(appData, APP_FOLDER);
  const legacy = path.join(appData, LEGACY_FOLDER);
  if (fs.existsSync(target) || !fs.existsSync(legacy)) return target;

  try {
    fs.renameSync(legacy, target);
    return target;
  } catch (err) {
    return legacy;
  }
}

module.exports = { resolveUserDataPath };
