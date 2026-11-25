import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('market sell slots enforce per-seller active capacity without replacing listing behavior', async () => {
  const db = new PGlite();
  const migration = await readFile(new URL('./supabase/migrations/20261125_market_sell_slots.sql', import.meta.url), 'utf8');
  const insert = (id, owner = 'a', status = 'normal') => db.query(
    'INSERT INTO public.species_market VALUES ($1,$2,$3,100)', [id, owner, status]);
  const count = async owner => (await db.query(
    "SELECT count(*)::int AS count FROM public.species_market WHERE user_id=$1 AND status='normal'", [owner])).rows[0].count;
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE TABLE public.user_profile(id text PRIMARY KEY, market_sell_slot integer, cash integer DEFAULT 1000);
      CREATE TABLE public.species_market(id text PRIMARY KEY, user_id text, status text, price integer);
      INSERT INTO public.user_profile(id,market_sell_slot) VALUES ('a',2),('b',1),('zero',0),('unset',NULL),('negative',-1);
    `);
    await db.exec(migration);
    await db.exec(migration); // Safe to apply again.
    await insert('a1'); await insert('a2');
    await insert('history', 'a', 'sold');
    await insert('cancelled', 'a', 'cancelled');
    await assert.rejects(insert('a3'), /MARKET_SELL_SLOT_LIMIT/);
    assert.equal(await count('a'), 2);
    await insert('b1', 'b');
    await assert.rejects(insert('b2', 'b'), /MARKET_SELL_SLOT_LIMIT/);
    for (const owner of ['zero', 'unset', 'negative', 'missing']) {
      await assert.rejects(insert(owner, owner), /MARKET_SELL_SLOT_LIMIT/);
    }
    // Updating an existing active listing does not consume another slot.
    await db.exec("UPDATE public.species_market SET price=200 WHERE id='a1'");
    await assert.rejects(db.exec("UPDATE public.species_market SET status='normal' WHERE id='cancelled'"), /MARKET_SELL_SLOT_LIMIT/);
    await assert.rejects(db.exec("UPDATE public.species_market SET user_id='b' WHERE id='a1'"), /MARKET_SELL_SLOT_LIMIT/);
    // Cancellation and purchase both free slots.
    await db.exec("UPDATE public.species_market SET status='cancelled' WHERE id='a1'");
    await insert('a3');
    await db.exec("UPDATE public.species_market SET status='sold' WHERE id='a2'");
    await db.exec("UPDATE public.species_market SET status='normal' WHERE id='cancelled'");
    assert.equal(await count('a'), 2);
    // Reduced limits preserve existing listings and block new ones.
    await db.exec("UPDATE public.user_profile SET market_sell_slot=1 WHERE id='a'");
    await db.exec("UPDATE public.species_market SET price=300 WHERE id='a3'");
    await assert.rejects(insert('a4'), /MARKET_SELL_SLOT_LIMIT/);
    await db.exec("UPDATE public.user_profile SET market_sell_slot=3 WHERE id='a'");
    await insert('a4');
    // A failed listing rolls back earlier fee deductions in the same transaction.
    await db.exec('BEGIN');
    await db.exec("UPDATE public.user_profile SET cash=cash-500 WHERE id='a'");
    await assert.rejects(insert('a5'), /MARKET_SELL_SLOT_LIMIT/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query("SELECT cash FROM public.user_profile WHERE id='a'")).rows[0].cash, 1000);
    // Multi-row inserts cannot exceed the final available slot either.
    await db.exec("UPDATE public.user_profile SET market_sell_slot=4 WHERE id='a'");
    await assert.rejects(db.exec("INSERT INTO public.species_market VALUES ('a5','a','normal',100),('a6','a','normal',100)"), /MARKET_SELL_SLOT_LIMIT/);
    assert.equal(await count('a'), 3);
  } finally {
    await db.close();
  }
});
