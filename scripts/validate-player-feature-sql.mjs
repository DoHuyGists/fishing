// npm install --no-save --package-lock=false @electric-sql/pglite
// node --test scripts/validate-player-feature-sql.mjs
import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('feature migration: cooldown, ownership, atomic history, RLS and private avatar bucket', async () => {
  const db = new PGlite()
  const buyer = '11111111-1111-4111-8111-111111111111'
  const seller = '22222222-2222-4222-8222-222222222222'
  const admin = '33333333-3333-4333-8333-333333333333'
  const countryA = '44444444-4444-4444-8444-444444444444'
  const countryB = '55555555-5555-4555-8555-555555555555'
  const fish = '66666666-6666-4666-8666-666666666666'
  const listing = '77777777-7777-4777-8777-777777777777'
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE public.countries(id uuid PRIMARY KEY);
      CREATE TABLE public.user_profile(id uuid PRIMARY KEY, country_id uuid, update_country_cooldown timestamptz, is_admin boolean DEFAULT false);
      CREATE TABLE public.species(id uuid PRIMARY KEY, name text, image text);
      CREATE TABLE public.caught(id uuid PRIMARY KEY, user_id uuid, species_id uuid, weight numeric);
      CREATE TABLE public.species_market(id uuid PRIMARY KEY, user_id uuid, caught_id uuid, status text, price bigint);
      CREATE TABLE public.blueprint(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), result_item_id uuid, result_quantity int, required_materials jsonb, gold_cost bigint);
      CREATE TABLE public.error_feedback(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text);
      CREATE TABLE public.personal_notifications(id uuid); CREATE TABLE public.system_notifications(id uuid); CREATE TABLE public.system_notification_reads(id uuid);
      CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
      CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
      CREATE PUBLICATION supabase_realtime;
      GRANT USAGE ON SCHEMA auth,public,storage TO authenticated;
      CREATE FUNCTION public.buy_species_from_market(p_market_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
      DECLARE m public.species_market;
      BEGIN
        SELECT * INTO m FROM public.species_market WHERE id=p_market_id;
        UPDATE public.caught SET user_id=auth.uid() WHERE id=m.caught_id;
        UPDATE public.species_market SET status='sold' WHERE id=m.id;
        IF current_setting('app.fail_purchase',true) = 'true' THEN RETURN jsonb_build_object('success',false,'message','purchase rejected'); END IF;
        IF current_setting('app.write_history',true) = 'true' THEN
          EXECUTE 'INSERT INTO public.market_history(seller_id,buyer_id,item,price) VALUES($1,$2,$3,$4)'
            USING m.user_id,auth.uid(),jsonb_build_object('market_id',m.id),m.price;
        END IF;
        RETURN jsonb_build_object('success',true);
      END $$;
      INSERT INTO auth.users VALUES('${buyer}'),('${seller}'),('${admin}');
      INSERT INTO public.user_profile(id,is_admin) VALUES('${buyer}',false),('${seller}',false),('${admin}',true);
      INSERT INTO public.countries VALUES('${countryA}'),('${countryB}');
      INSERT INTO public.species VALUES('${fish}','Cá chép',NULL);
      INSERT INTO public.caught VALUES('${fish}','${seller}','${fish}',2.5);
      INSERT INTO public.species_market VALUES('${listing}','${seller}','${fish}','normal',1000);
      INSERT INTO public.error_feedback(user_id,title) VALUES('${buyer}','Buyer private'),('${seller}','Seller private');
      INSERT INTO storage.buckets VALUES('existing-private','existing-private',false,NULL,NULL);
    `)
    const migration = await readFile(new URL('./supabase/migrations/player_feature_completion.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    await db.exec(migration) // Must be safe to rerun.
    await db.exec(`SELECT set_config('app.user_id','${buyer}',false); SET ROLE authenticated;`)
    await db.query('SELECT public.update_my_country($1)', [countryA])
    await assert.rejects(db.query('SELECT public.update_my_country($1)', [countryB]), /thời gian chờ/)
    await db.exec(`RESET ROLE; UPDATE public.user_profile SET update_country_cooldown=now()-interval '1 day' WHERE id='${buyer}'; SET ROLE authenticated;`)
    await db.query('SELECT public.update_my_country($1)', [countryB])
    await assert.rejects(db.query('SELECT public.update_my_identity($1,$2,$3)', ['Test name',null,`${seller}/image.png`]), /không thuộc/)
    await db.query('SELECT public.update_my_identity($1,$2,$3)', ['Tên mới',null,`${buyer}/image.png`])
    await db.query('SELECT public.complete_my_onboarding()')
    await assert.rejects(db.query(`INSERT INTO public.blueprint(gold_cost) VALUES(0)`), /row-level security/)
    const errors = await db.query('SELECT title FROM public.error_feedback')
    assert.deepEqual(errors.rows.map(row => row.title), ['Buyer private'])
    await db.query('SELECT public.buy_species_with_history($1)', [listing])
    await assert.rejects(db.query('SELECT public.buy_species_with_history($1)', [listing]), /khả dụng/)
    const history = await db.query('SELECT * FROM public.market_history')
    assert.equal(history.rows.length,1)
    assert.equal(history.rows[0].item.name,'Cá chép')
    await db.exec(`RESET ROLE; UPDATE public.caught SET user_id='${seller}'; UPDATE public.species_market SET status='normal'; SELECT set_config('app.write_history','true',false); SET ROLE authenticated;`)
    await db.query('SELECT public.buy_species_with_history($1)', [listing])
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.market_history')).rows[0].n,2)
    await db.exec(`SELECT set_config('app.user_id','${admin}',false);`)
    await db.query('INSERT INTO public.blueprint(gold_cost) VALUES(5)')
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.error_feedback')).rows[0].n,2)
    await db.exec('RESET ROLE')
    await db.exec(`UPDATE public.caught SET user_id='${seller}'; UPDATE public.species_market SET status='normal'; SELECT set_config('app.user_id','${buyer}',false); SELECT set_config('app.fail_purchase','true',false); SET ROLE authenticated;`)
    await assert.rejects(db.query('SELECT public.buy_species_with_history($1)',[listing]), /purchase rejected/)
    await db.exec('RESET ROLE')
    assert.equal((await db.query('SELECT user_id FROM public.caught WHERE id=$1',[fish])).rows[0].user_id,seller)
    assert.equal((await db.query('SELECT status FROM public.species_market WHERE id=$1',[listing])).rows[0].status,'normal')
    const buckets = await db.query('SELECT id,public FROM storage.buckets ORDER BY id')
    assert(buckets.rows.every(row => row.public === false))
    const profile = (await db.query('SELECT * FROM public.user_profile WHERE id=$1',[buyer])).rows[0]
    assert.equal(profile.country_id,countryB)
    assert.equal(profile.display_name,'Tên mới')
    assert.equal(profile.onboarding_completed,true)
  } finally { await db.close() }
})
