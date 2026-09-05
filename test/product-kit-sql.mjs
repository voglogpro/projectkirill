/** Isolated PostgreSQL/WASM regression check. No DATABASE_URL is read.
 * KIRA_PGLITE_MODULE must point to an externally installed @electric-sql/pglite.
 * Run after npm run build:api; it never contacts or changes a live database.
 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PostgresCoreRepository } from '../dist/db/postgres-core-repository.js';
import { PostgresEntitlementGate } from '../dist/billing/postgres-entitlement-gate.js';
import { PostgresTelegramUpdateJobRepository } from '../dist/db/postgres-telegram-update-job-repository.js';
import { PostgresTelegramUpdateRepository } from '../dist/db/postgres-telegram-update-repository.js';
const packageRoot = process.env.KIRA_PGLITE_MODULE;
if (!packageRoot) throw new Error('Set KIRA_PGLITE_MODULE to an external PGlite installation');
const moduleUrl = (name) => pathToFileURL(resolve(packageRoot, name)).href;
const { PGlite } = await import(moduleUrl('dist/index.js'));
const { citext } = await import(moduleUrl('dist/contrib/citext.js'));
const { pgcrypto } = await import(moduleUrl('dist/contrib/pgcrypto.js'));
const db = new PGlite({ extensions: { citext, pgcrypto } });
const query = async (statement, values = []) => (await db.query(statement, values)).rows;
const sql = (chunks, ...values) => query(chunks.map((part, index) => part + (index < values.length ? `$${index + 1}` : '')).join(''), values);
sql.json = JSON.stringify;
sql.begin = async (callback) => callback(sql);
try {
  for (const name of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort()) {
    if (name.startsWith('008')) {
      await db.exec(`INSERT INTO users (id,email,display_name) VALUES ('00000000-0000-4000-8000-000000000001','legacy@example.test','Legacy');
        INSERT INTO projects (id,owner_user_id,name,slug) VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Legacy','legacy-bot');
        INSERT INTO billing_subscriptions (user_id,plan_code,current_period_start,current_period_end)
        VALUES ('00000000-0000-4000-8000-000000000001','solo',now(),now()+interval '1 month');`);
    }
    await db.exec(await readFile(resolve('migrations', name), 'utf8'));
  }
  const [legacy] = await query(`SELECT kit, legacy_full_access_until IS NOT NULL AS grace,
    project_launch_allowed(id) AS allowed FROM projects WHERE slug='legacy-bot'`);
  assert.deepEqual(legacy, { kit: 'bot-app-site', grace: true, allowed: true });
  await db.exec(`UPDATE projects SET legacy_full_access_until = now() - interval '1 second' WHERE slug='legacy-bot'`);
  assert.equal((await query(`SELECT project_launch_allowed(id) AS allowed FROM projects WHERE slug='legacy-bot'`))[0].allowed, false);

  const repository = new PostgresCoreRepository(sql);
  const gate = new PostgresEntitlementGate(sql);
  assert.equal(await new PostgresTelegramUpdateJobRepository(sql).claimNext({ leaseSeconds: 60, maxAttempts: 8 }), null);
  assert.equal(await new PostgresTelegramUpdateRepository(sql).findActiveIntegration(randomUUID()), null);
  const document = { schemaVersion: 1, metadata: { title: 'Home' }, settings: { maxWidth: 'normal', respectTelegramTheme: true }, blocks: [] };
  for (const [plan, limit, allowedKits] of [
    ['solo', 1, ['bot', 'site']], ['trio', 3, ['bot']], ['studio', 1, ['bot','bot-app','bot-app-site','site']],
  ]) {
    const owner = randomUUID();
    await query('INSERT INTO users(id,email,display_name) VALUES($1,$2,$3)', [owner, `${owner}@example.test`, plan]);
    await query(`INSERT INTO billing_subscriptions(user_id,plan_code,current_period_start,current_period_end)
      VALUES($1,$2,now(),now()+interval '1 month')`, [owner, plan]);
    for (const kit of ['bot','bot-app','bot-app-site','site']) {
      const project = await repository.createProject(owner, { name: kit, slug: `check-${kit}`, kit, entryDocument: document });
      assert.equal(project.kit, kit);
      assert.equal((await repository.getOwnedProject(owner, project.id)).kit, kit);
      assert.equal((await query('SELECT project_launch_allowed($1) AS allowed', [project.id]))[0].allowed, allowedKits.includes(kit));
      await repository.updateProject(owner, project.id, undefined, kit);
    }
    const projects = await repository.listProjects(owner);
    const bot = projects.find((project) => project.kit === 'bot');
    const snapshot = await repository.getOwnedSnapshot(owner, bot.id);
    await repository.publishSnapshot(owner, snapshot, 'a'.repeat(64));
    assert.equal(await repository.getPublicApp(bot.publicId), null, 'text bots cannot serve Mini Apps');
    assert.equal(await repository.getPublicApp(bot.publicId, 'site'), null, 'text bots cannot serve sites');
    for (let index = 1; index <= limit; index++) {
      const next = await repository.createProject(owner, { name: 'Extra', slug: `extra-bot-${index}`, kit: 'bot', entryDocument: document });
      assert.equal((await query('SELECT project_launch_allowed($1) AS allowed', [next.id]))[0].allowed, index < limit);
      if (index < limit) await repository.publishSnapshot(owner, await repository.getOwnedSnapshot(owner, next.id), 'b'.repeat(64));
    }
  }
  for (const plan of ['solo', 'trio', 'studio']) {
    for (const kit of ['bot', 'bot-app', 'bot-app-site', 'site']) {
      const owner = randomUUID();
      await query('INSERT INTO users(id,email,display_name) VALUES($1,$2,$3)', [owner, `${owner}@example.test`, plan]);
      await query(`INSERT INTO billing_subscriptions(user_id,plan_code,current_period_start,current_period_end)
        VALUES($1,$2,now(),now()+interval '1 month')`, [owner, plan]);
      const project = await repository.createProject(owner, { name: kit, slug: 'surface-test', kit, entryDocument: document });
      const compatible = plan === 'studio' || kit === 'bot' || (plan === 'solo' && kit === 'site');
      if (compatible) await gate.assertCanPublish(owner, project.id);
      else await assert.rejects(gate.assertCanPublish(owner, project.id), { code: 'PLAN_LIMIT_REACHED' });
      // Even a directly written release is not publicly readable on the wrong plan.
      await repository.publishSnapshot(owner, await repository.getOwnedSnapshot(owner, project.id), 'c'.repeat(64));
      assert.equal(Boolean(await repository.getPublicApp(project.publicId)), compatible && ['bot-app', 'bot-app-site'].includes(kit));
      assert.equal(Boolean(await repository.getPublicApp(project.publicId, 'site')), compatible && ['site', 'bot-app-site'].includes(kit));
      await query(`UPDATE billing_subscriptions SET plan_code='solo' WHERE user_id=$1`, [owner]);
      if (['bot-app', 'bot-app-site'].includes(kit)) assert.equal(await repository.getPublicApp(project.publicId), null);
      await query(`UPDATE billing_subscriptions SET current_period_start=now()-interval '2 month',current_period_end=now()-interval '1 second' WHERE user_id=$1`, [owner]);
      assert.equal(await repository.getPublicApp(project.publicId, 'site'), null);
      await assert.rejects(gate.assertCanPublish(owner, project.id));
    }
  }
  console.log('PASS: all eight migrations, legacy grace, persisted kits, plan/slot policy, public surface matrix, downgrade, expiry, worker SQL.');
} catch (error) {
  console.error(error.message, error.code ?? '', error.query ?? '');
  process.exitCode = 1;
} finally { await db.close(); }
