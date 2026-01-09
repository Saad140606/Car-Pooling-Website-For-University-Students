/*
REST migration script (emulator-friendly) to backfill createdBy from driverId.
Uses Firestore Emulator REST endpoints, no admin SDK needed.
Usage:
  node scripts/migrate-createdBy-rest.js            # dry-run
  node scripts/migrate-createdBy-rest.js --apply    # perform updates
  node scripts/migrate-createdBy-rest.js --univ fast --apply
*/

const argv = require('minimist')(process.argv.slice(2));
const APPLY = !!argv.apply;
const TARGET_UNIV = argv.univ || argv.university || null;
const USE_OWNER = !!(argv.owner || argv.bypass || argv.emulatorAdmin);
const PROJECT = process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT || 'demo-project';
const HOST = process.env.EMULATOR_HOST || 'http://127.0.0.1:8080';

async function fetchJson(url, opts = {}) {
  const headers = opts.headers || {};
  if (USE_OWNER) {
    headers['Authorization'] = 'Bearer owner';
  }
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

function docName(univ, rideId) {
  return `projects/${PROJECT}/databases/(default)/documents/universities/${univ}/rides/${rideId}`;
}

(async function main() {
  console.log('Using HOST:', HOST);
  console.log('Project:', PROJECT);
  const base = `${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

  // Get list of universities
  let universities = [];
  if (TARGET_UNIV) {
    universities = [TARGET_UNIV];
  } else {
    try {
      const data = await fetchJson(`${base}/universities`);
      if (data.documents) universities = data.documents.map(d => d.name.split('/').pop());
    } catch (err) {
      console.error('Failed to list universities:', err.message || err);
      process.exit(1);
    }
  }

  console.log('Universities to scan:', universities);

  let checked = 0, updated = 0;
  for (const univ of universities) {
    console.log(`Scanning universities/${univ}/rides`);
    try {
      const ridesList = await fetchJson(`${base}/universities/${univ}/rides`);
      const docs = ridesList.documents || [];
      console.log(`  found ${docs.length} rides`);
      for (const d of docs) {
        checked++;
        const rideId = d.name.split('/').pop();
        const fields = d.fields || {};
        const createdBy = fields.createdBy ? fields.createdBy.stringValue : undefined;
        const driverId = fields.driverId ? fields.driverId.stringValue : undefined;
        if (!createdBy) {
          if (driverId) {
            console.log(`  will set createdBy=${driverId} on ${univ}/rides/${rideId}`);
            if (APPLY) {
              const patchUrl = `${HOST}/v1/${docName(univ, rideId)}?updateMask.fieldPaths=createdBy`;
              const body = { fields: { createdBy: { stringValue: driverId } } };
              await fetchJson(patchUrl, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
              updated++;
              console.log('    updated');
            }
          } else {
            console.log(`  skip ${univ}/rides/${rideId} (no driverId)`);
          }
        }
      }
    } catch (err) {
      console.error(`  error scanning ${univ}:`, err.message || err);
    }
  }

  console.log('Done. Checked:', checked, 'Updated:', updated);
  if (!APPLY) console.log('Dry-run complete. Re-run with --apply to perform updates.');
})();
