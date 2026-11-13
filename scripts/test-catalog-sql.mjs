import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const user = '00000000-0000-0000-0000-000000000001';
const item = '00000000-0000-0000-0000-000000000002';
const receipt = '00000000-0000-0000-0000-000000000003';
const fixture = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO authenticated;
  CREATE TABLE public.feature_flags(feature_key text PRIMARY KEY,enabled boolean);
  INSERT INTO public.feature_flags VALUES ('shop',true),('work-bench',true),('skill',true),('redeem',true),('aquaculture',true),('diary',true),('world-map',true),('guide',true);
  CREATE FUNCTION public.feature_is_enabled(p_feature text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT coalesce((SELECT enabled FROM public.feature_flags WHERE feature_key=p_feature),false) $$;
  CREATE TABLE public.countries(id uuid,name text,code text,information text,created_at timestamptz,updated_at timestamptz,location jsonb);
  CREATE TABLE public.fishing_areas(id uuid,country_id uuid,title text,location jsonb,scene_path text,is_available boolean);
  CREATE TABLE public.species(id uuid,created_at timestamptz,information text,location text,status text,name text,image text,owner_id uuid,secret_strength numeric);
  ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;
  CREATE POLICY species_owner ON public.species FOR SELECT TO authenticated USING(owner_id=auth.uid());
  CREATE TABLE public.guides(id uuid,title text,content text,sort_order integer,is_published boolean);
  CREATE TABLE public.items(id uuid,category text,classification text,name text,information text,image text,icon text,quantity integer,price bigint,rpc text,"isDisabled" boolean);
  CREATE TABLE public.blueprint(id uuid,result_item_id uuid,result_quantity integer,required_materials jsonb,gold_cost bigint,created_at timestamptz);
  CREATE TABLE public.skills(id uuid,code text,name text,description text,icon text,max_level integer,effect_per_level jsonb,sort_order integer,is_disabled boolean);
  CREATE TABLE public.aquaculture_species_rules(species_id uuid,enabled boolean,rules_version integer,seed_cash bigint);
  CREATE TABLE public.aquaculture_species_foods(species_id uuid,item_id uuid,enabled boolean,capacity_units_per_item integer,quality_gain numeric);
  CREATE TABLE public.currency_conversion_rates(source_currency text,target_currency text,source_amount bigint,target_amount bigint,is_active boolean);
  CREATE TABLE public.effects(action text,owner_id uuid);
  CREATE TABLE public.aquaculture_actions(user_id uuid,request_id uuid,kind text,input jsonb,result jsonb,PRIMARY KEY(user_id,request_id));
  CREATE FUNCTION public.purchase_item(p_item_id uuid,p_quantity integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN INSERT INTO public.effects VALUES('purchase',auth.uid()); RETURN jsonb_build_object('success',true); END $$;
  CREATE FUNCTION public.craft_blueprint(p_blueprint_id uuid,p_quantity bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN INSERT INTO public.effects VALUES('craft',auth.uid()); RETURN jsonb_build_object('success',true); END $$;
  CREATE FUNCTION public.upgrade_skill(p_skill_id uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('success',true) $$;
  CREATE FUNCTION public.convert_currency(p_source_currency text,p_target_currency text,p_batches bigint,p_source_amount bigint,p_target_amount bigint) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('cash',123) $$;
  CREATE FUNCTION public.aquaculture_lock_user() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF; RETURN auth.uid(); END $$;
  CREATE FUNCTION public.aquaculture_previous_action(u uuid,r uuid,k text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
    DECLARE a public.aquaculture_actions%ROWTYPE; BEGIN SELECT * INTO a FROM public.aquaculture_actions WHERE user_id=u AND request_id=r;
    IF FOUND THEN IF a.kind<>k OR a.input<>p THEN RAISE EXCEPTION 'Request ID reused'; END IF; RETURN a.result; END IF; RETURN NULL; END $$;
  CREATE FUNCTION public.stock_aquaculture_batch(p_pond_id uuid,p_species_id uuid,p_quantity integer,p_mode text,p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN INSERT INTO public.effects VALUES('stock',auth.uid()); RETURN jsonb_build_object('batch_id',p_request_id); END $$;
  CREATE FUNCTION public.feed_aquaculture_batch(p_batch_id uuid,p_inventory_id uuid,p_request_id uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('success',true) $$;
  GRANT SELECT ON public.countries,public.fishing_areas,public.species,public.guides,public.items,public.blueprint,public.skills,public.aquaculture_species_rules,public.aquaculture_species_foods TO authenticated;
  REVOKE ALL ON public.currency_conversion_rates,public.effects,public.aquaculture_actions FROM authenticated;
`;

test('catalog migration executes on PostgreSQL and guards the legacy actions', async t => {
  const db = new PGlite();
  const query = async (sql, args) => (await db.query(sql, args)).rows;
  const revision = async domain => (await query('SELECT revision::text FROM public.game_catalog_versions WHERE domain=$1', [domain]))[0].revision;
  const action = async (name, args, expected) => (await query('SELECT public.execute_game_catalog_action($1,$2,$3) AS data', [name, args, expected]))[0].data;
  try {
    await db.exec(fixture);
    const sql = await readFile(new URL('./supabase/migrations/20261113_game_catalog_cache.sql', import.meta.url), 'utf8');
    await db.exec(sql); await db.exec(sql); // idempotent replay
    await db.exec(`SET test.uid='${user}'; INSERT INTO public.items(id,name,price,quantity,"isDisabled") VALUES('${item}','Bait',10,1,false);
      INSERT INTO public.species(id,name,owner_id,secret_strength) VALUES('${item}','Visible','${user}',999),('${receipt}','Hidden','${receipt}',999);
      INSERT INTO public.aquaculture_species_rules VALUES('${item}',true,1,10);
      INSERT INTO public.currency_conversion_rates VALUES('cash','shells',100,1,true);`);

    await t.test('statement triggers cover dependencies, deletes and rollback', async () => {
      const old = await revision('blueprints');
      await db.exec(`BEGIN; UPDATE public.items SET price=12; ROLLBACK;`); assert.equal(await revision('blueprints'), old);
      await db.exec('UPDATE public.items SET price=11'); assert.equal(BigInt(await revision('blueprints')), BigInt(old) + 1n);
      const next = await revision('shop'); await db.exec(`DELETE FROM public.items WHERE id='${item}'`);
      assert.equal(BigInt(await revision('shop')), BigInt(next) + 1n);
      await db.exec(`INSERT INTO public.items(id,name,price,quantity,"isDisabled") VALUES('${item}','Bait',10,1,false)`);
    });
    await t.test('snapshots preserve RLS and expose only the player projection; rates remain RPC-only', async () => {
      await db.exec('SET ROLE authenticated');
      const snapshot = (await query("SELECT public.get_game_catalog_snapshot('species') AS data"))[0].data;
      assert.equal(snapshot.data.length, 1); assert.equal(snapshot.data[0].name, 'Visible'); assert.equal(snapshot.data[0].secret_strength, undefined);
      await assert.rejects(query('SELECT * FROM public.currency_conversion_rates'), /permission denied/);
      assert.equal((await query("SELECT public.get_game_catalog_snapshot('rates') AS data"))[0].data.data[0].source_amount, 100);
      for (const domain of ['countries','areas','guides','shop','items','blueprints','skills','aquaculture']) {
        const value = (await query('SELECT public.get_game_catalog_snapshot($1,$2::uuid[]) AS data', [domain, [item]]))[0].data;
        assert.equal(typeof value.revision, 'string'); assert.ok(value.data);
      }
      await db.exec('RESET ROLE');
    });
    await t.test('mismatch rejects before effects, current revisions call existing typed signatures', async () => {
      const rev = await revision('shop'); await db.exec('SET ROLE authenticated');
      await assert.rejects(action('purchase_item', { p_item_id: item, p_quantity: 2 }, { shop: '0' }), error => {
        assert.equal(error.code, 'P0001', error.message);
        return JSON.parse(error.detail).code === 'CATALOG_VERSION_MISMATCH';
      });
      assert.equal((await action('purchase_item', { p_item_id: item, p_quantity: 2 }, { shop: rev })).success, true);
      assert.equal((await action('craft_blueprint', { p_blueprint_id: item, p_quantity: 2 }, { blueprints: await revision('blueprints') })).success, true);
      await db.exec('RESET ROLE');
      assert.deepEqual((await query('SELECT action FROM public.effects ORDER BY action')).map(x => x.action), ['craft','purchase']);
    });
    await t.test('maintenance and argument/function injection are rejected', async () => {
      await db.exec("UPDATE public.feature_flags SET enabled=false WHERE feature_key='shop'; SET ROLE authenticated");
      await assert.rejects(action('purchase_item', { p_item_id: item, p_quantity: 1 }, { shop: await revision('shop') }), /Feature disabled/);
      await assert.rejects(action('purchase_item); DROP TABLE public.items;', {}, {}), /Unsupported/);
      await db.exec("RESET ROLE; UPDATE public.feature_flags SET enabled=true WHERE feature_key='shop'; SET ROLE authenticated");
      await assert.rejects(action('purchase_item', { p_item_id: item, p_quantity: 1, injected: 'x' }, { shop: await revision('shop') }), /Invalid catalog action arguments/);
      await db.exec('RESET ROLE');
    });
    await t.test('committed farm receipts win over changed revisions; uncommitted stale quotes cannot stock', async () => {
      const params = { p_pond_id: item, p_species_id: item, p_quantity: 1, p_mode: 'simple', p_request_id: receipt };
      await db.query('INSERT INTO public.aquaculture_actions VALUES($1,$2,$3,$4,$5)', [user, receipt, 'stock', { pond_id: item, species_id: item, quantity: 1, mode: 'simple' }, { batch_id: receipt }]);
      await db.exec('SET ROLE authenticated');
      assert.equal((await action('stock_aquaculture_batch', params, { aquaculture: '0' })).batch_id, receipt);
      await assert.rejects(action('stock_aquaculture_batch', { ...params, p_quantity: 2 }, {}), /Request ID reused/);
      await assert.rejects(action('stock_aquaculture_batch', { ...params, p_request_id: item, _rules_snapshot: { seed_cash: 0 } }, { aquaculture: await revision('aquaculture') }), /Farm rules changed/);
      await db.exec('RESET ROLE'); assert.equal((await query("SELECT * FROM public.effects WHERE action='stock'")).length, 0);
    });
    await t.test('anonymous callers cannot read snapshots or invoke actions', async () => {
      await db.exec('SET ROLE anon'); await assert.rejects(query("SELECT public.get_game_catalog_snapshot('shop')"), /permission denied/); await db.exec('RESET ROLE');
    });
  } finally { await db.close(); }
});
