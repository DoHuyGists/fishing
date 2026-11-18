import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { PGlite } from '@electric-sql/pglite';

test('distribution geometry matches real weights and keeps the original total after dragging', async () => {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true, hmr: false, watch: null } });
  try {
    const { fitDistribution, distributionCell, distributionLake, polygonArea, distributionWeights, warpDistributionPoint, unwarpDistributionPoint } = await server.ssrLoadModule('/src/utils/speciesDistribution.ts');
    const { boundaryShapes, createSpeciesBoundary, speciesBoundaryPolygon, validSpeciesBoundary, pointInSpeciesBoundary, storedSpeciesBoundary } = await server.ssrLoadModule('/src/utils/speciesDistributionBoundary.ts');
    const lakeArea = polygonArea(distributionLake);
    const rectangle = speciesBoundaryPolygon(createSpeciesBoundary('rect'));
    const pair = fitDistribution([
      { id: 'left', color: '', seed: { x: 180, y: 200 }, power: 0 },
      { id: 'right', color: '', seed: { x: 420, y: 200 }, power: 0 },
    ], { left: 1, right: 1 }, rectangle);
    const curved = pair.map(zone => distributionCell(zone, pair, rectangle));
    const [left, right] = pair.map(zone => ({ ...zone, seed: warpDistributionPoint(zone.seed) }));
    const score = point => {
      const p = warpDistributionPoint(point);
      return 2 * (right.seed.x - left.seed.x) * p.x + 2 * (right.seed.y - left.seed.y) * p.y
        - (right.seed.x ** 2 + right.seed.y ** 2 - left.seed.x ** 2 - left.seed.y ** 2 + left.power - right.power);
    };
    const edge = curved[0].polygon.filter(point => Math.abs(score(point)) < 1e-6);
    assert.ok(edge.length > 20, 'the shared boundary is sampled along its curve');
    const first = edge[0], last = edge.at(-1);
    assert.ok(edge.some(point => Math.abs((last.x - first.x) * (point.y - first.y) - (last.y - first.y) * (point.x - first.x)) / Math.hypot(last.x - first.x, last.y - first.y) > 3), 'the dividing boundary visibly bends away from a straight line');
    for (const cell of curved) {
      assert.ok(Math.abs(polygonArea(cell.polygon) - cell.area) / polygonArea(rectangle) < 0.001, 'rendered curved area matches the weight');
      for (const point of cell.polygon) {
        const restored = unwarpDistributionPoint(warpDistributionPoint(point));
        assert.ok(Math.hypot(point.x - restored.x, point.y - restored.y) < 1e-9);
      }
    }
    for (const weights of [[100, 50, 25, 0], [0, 0], [7], Array.from({ length: 15 }, (_, i) => i + 1), [10000, 1, 0.01]]) {
      const rates = Object.fromEntries(weights.map((weight, i) => [String(i), weight]));
      const zones = weights.map((_, i) => ({ id: String(i), color: '', seed: { x: 300 + 160 * Math.cos(i * 2.4), y: 200 + 100 * Math.sin(i * 2.4) }, power: 0 }));
      const fitted = fitDistribution(zones, rates);
      const cells = fitted.map(zone => distributionCell(zone, fitted));
      const total = weights.reduce((a, b) => a + b, 0);
      assert.equal(fitted.length, weights.filter(weight => weight > 0).length);
      for (const cell of cells) assert.ok(Math.abs(cell.area / lakeArea - rates[cell.id] / total) < 0.001, JSON.stringify({ weights, id: cell.id, actual: cell.area / lakeArea }));
      if (!fitted.length) continue;
      assert.ok(Math.abs(cells.reduce((sum, cell) => sum + cell.area, 0) - lakeArea) < 1e-6);
      fitted[0].power += 3000;
      const edited = distributionWeights(fitted.map(zone => distributionCell(zone, fitted)), total);
      assert.ok(Math.abs(Object.values(edited).reduce((a, b) => a + b, 0) - total) < 1e-8);
      assert.ok(Object.values(edited).every(value => value >= 0 && Number.isFinite(value)));
    }
    const concave = createSpeciesBoundary();
    concave.nodes[0].x = 360;
    const boundaries = [...boundaryShapes.map(shape => createSpeciesBoundary(shape)), concave, { ...createSpeciesBoundary('rect'), width: 160, height: 120 }];
    for (const boundary of boundaries) {
      assert.equal(validSpeciesBoundary(boundary), true);
      const polygon = speciesBoundaryPolygon(boundary);
      const weights = { a: 100, b: 50, c: 25 };
      const zones = Object.keys(weights).map((id, i) => ({ id, color: '', power: 0, seed: pointInSpeciesBoundary({ x: 220 + i * 75, y: 200 }, polygon) }));
      const fitted = fitDistribution(zones, weights, polygon);
      const cells = fitted.map(zone => distributionCell(zone, fitted, polygon));
      const area = polygonArea(polygon);
      assert.ok(Math.abs(cells.reduce((sum, cell) => sum + cell.area, 0) - area) < 1e-6, boundary.shape);
      for (const cell of cells) assert.ok(Math.abs(cell.area / area - weights[cell.id] / 175) < 0.001, boundary.shape);
    }
    for (const value of [null, {}, { ...concave, nodes: [] }, { ...concave, nodes: concave.nodes.map(() => ({ x: 0, y: 0 })) }, { ...createSpeciesBoundary('circle'), width: 200 }]) assert.equal(validSpeciesBoundary(value), false);
    assert.deepEqual(storedSpeciesBoundary([{ boundary: null }, { boundary: concave }]), concave);
  } finally { await server.close(); }
});

test('distribution store loads the whole lake, preserves drafts on failure, and synchronizes saved rows', async () => {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true, hmr: false, watch: null }, define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
  } });
  try {
    const { useSpeciesInAreaStore } = await server.ssrLoadModule('/src/components/admin/species-in-area-management/admin-species-in-area-store.ts');
    const { supabaseSpeciesInAreaRepository: repository } = await server.ssrLoadModule('/src/data/supabaseSpeciesInAreaRepository.ts');
    // Exercise actual repository pagination, including a server cap lower than
    // the requested page size, before replacing persistence for the store test.
    const originalFetch = globalThis.fetch;
    const offsets = [];
    globalThis.fetch = async input => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.origin, 'https://example.supabase.co');
      assert.equal(url.searchParams.get('area_id'), 'eq.lake');
      const offset = Number(url.searchParams.get('offset'));
      offsets.push(offset);
      return Response.json(Array.from({ length: Math.max(0, Math.min(80, 550 - offset)) }, (_, i) => ({
        id: String(offset + i), area_id: 'lake', species_id: String(offset + i), weight_rate: 100,
      })));
    };
    try {
      const full = await repository.fetchDistribution('lake');
      assert.equal(full.length, 550);
      assert.deepEqual(offsets, [0, 80, 160, 240, 320, 400, 480, 550]);
    } finally { globalThis.fetch = originalFetch; }
    setActivePinia(createPinia());
    const store = useSpeciesInAreaStore();
    const rows = Array.from({ length: 15 }, (_, i) => ({ id: String(i), areaId: 'lake', speciesId: String(i), weightRate: 100, depthScopeId: 'depth' }));
    store.rows = rows.slice(0, 10).map(row => ({ ...row }));
    repository.fetchDistribution = async areaId => { assert.equal(areaId, 'lake'); return rows.map(row => ({ ...row })); };
    await store.loadDistribution('lake');
    assert.equal(store.distributions.lake.loading, false);
    assert.equal(store.distributions.lake.loaded, true);
    assert.equal(store.distributions.lake.rows.length, 15);
    const { createSpeciesBoundary } = await server.ssrLoadModule('/src/utils/speciesDistributionBoundary.ts');
    const boundary = createSpeciesBoundary('hex');
    store.setDistributionBoundary('lake', boundary);
    assert.equal(store.distributions.lake.originalBoundary.shape, 'natural');
    store.setDistributionWeights('lake', { 0: 55.5, 14: 0 });
    repository.updateDistribution = async () => { throw new Error('Conflict'); };
    await store.saveDistribution('lake');
    assert.equal(store.distributions.lake.weights[0], 55.5);
    assert.equal(store.rows[0].weightRate, 100);
    assert.equal(store.distributions.lake.error, 'Conflict');
    let calls = 0;
    repository.updateDistribution = async (area, weights) => {
      calls++;
      assert.equal(area, 'lake'); assert.equal(weights.length, 15);
      assert.equal(weights[0].previousWeightRate, 100);
      assert.equal(weights[14].weightRate, 0);
      assert.equal(Object.hasOwn(weights[0], 'depthScopeId'), false);
      assert.deepEqual(weights[0].boundary, boundary);
      assert.equal(weights[0].previousBoundary, null);
    };
    await store.saveDistribution('lake');
    assert.equal(store.rows[0].weightRate, 55.5);
    assert.equal(store.distributions.lake.rows[0].depthScopeId, 'depth');
    assert.equal(store.distributions.lake.saved, true);
    assert.equal(store.distributions.lake.originalBoundary.shape, 'hex');
    store.setDistributionBoundary('lake', createSpeciesBoundary('rect'));
    for (const invalid of [null, -1, NaN, Infinity]) {
      store.setDistributionWeights('lake', { 0: invalid });
      await store.saveDistribution('lake');
      assert.equal(calls, 1);
    }
    store.resetDistribution('lake');
    assert.equal(store.distributions.lake.weights[0], 55.5);
    assert.equal(store.distributions.lake.boundary.shape, 'hex');
  } finally { await server.close(); }
});

test('distribution RPC atomically saves weights and boundaries, checks stale data and preserves depth and other lakes', async () => {
  const db = new PGlite();
  const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  const boundary = { version: 1, shape: 'ellipse', width: 500, height: 300, nodes: [] };
  const weights = (a = 80, b = 20, oldA = 100, oldB = 100, previousBoundary = null) => [
    { species_id: id(2), weight_rate: a, previous_weight_rate: oldA, boundary, previous_boundary: previousBoundary },
    { species_id: id(3), weight_rate: b, previous_weight_rate: oldB, boundary, previous_boundary: previousBoundary },
  ];
  const save = (value, shape = boundary) => db.query('SELECT public.update_species_in_area_distribution($1,$2,$3)', [id(1), JSON.stringify(value), JSON.stringify(shape)]);
  const read = async () => (await db.query('SELECT area_id,species_id,weight_rate::float8 AS rate,depth_scope_id,boundary FROM public.species_in_area ORDER BY area_id,species_id')).rows;
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
      CREATE FUNCTION public.feature_flags_is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('test.admin',true),'')='true' $$;
      CREATE TABLE public.fishing_areas(id uuid PRIMARY KEY);
      CREATE TABLE public.species_in_area(area_id uuid REFERENCES public.fishing_areas(id), species_id uuid, weight_rate numeric, depth_scope_id uuid, PRIMARY KEY(area_id,species_id));
      INSERT INTO public.fishing_areas VALUES('${id(1)}'),('${id(4)}');
      INSERT INTO public.species_in_area VALUES('${id(1)}','${id(2)}',100,'${id(9)}'),('${id(1)}','${id(3)}',100,NULL),('${id(4)}','${id(2)}',500,NULL);
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT SELECT,UPDATE ON public.fishing_areas,public.species_in_area TO authenticated;
      ALTER TABLE public.species_in_area ENABLE ROW LEVEL SECURITY;
      CREATE POLICY read_all ON public.species_in_area FOR SELECT TO authenticated USING (true);
      CREATE POLICY admin_edit ON public.species_in_area FOR UPDATE TO authenticated USING (public.feature_flags_is_admin()) WITH CHECK(public.feature_flags_is_admin());
      SET test.uid='${id(8)}'; SET test.admin='true';
    `);
    const sql = await readFile(new URL('./supabase/migrations/20261118_species_distribution.sql', import.meta.url), 'utf8');
    await db.exec(sql); await db.exec(sql);
    const boundarySql = await readFile(new URL('./supabase/migrations/20261118_species_distribution_boundary.sql', import.meta.url), 'utf8');
    await db.exec(boundarySql); await db.exec(boundarySql);
    await db.exec('SET ROLE authenticated');
    const original = await read();
    for (const invalid of [weights(-1), [weights()[0]], [weights()[0], weights()[0]], weights(80, 20, 99), weights('NaN'), weights(null)]) {
      await assert.rejects(save(invalid));
      assert.deepEqual(await read(), original);
    }
    for (const invalid of [null, {}, { ...boundary, shape: 'other' }, { ...boundary, width: 0 }, { ...boundary, shape: 'natural', nodes: [] }]) {
      await assert.rejects(save(weights(), invalid));
      assert.deepEqual(await read(), original);
    }
    await db.exec("SET test.admin='false'");
    await assert.rejects(save(weights()), /Admin access required/);
    await db.exec("SET test.admin='true'");
    await save(weights());
    const saved = await read();
    assert.deepEqual(saved.map(row => row.rate), [80, 20, 500]);
    assert.equal(saved[0].depth_scope_id, id(9));
    assert.deepEqual(saved[0].boundary, boundary);
    assert.deepEqual(saved[1].boundary, boundary);
    assert.equal(saved[2].boundary, null);
    await assert.rejects(save(weights(80, 20, 80, 20)), /reload/, 'unchanged weights must still detect a concurrent boundary edit');
    await assert.rejects(save(weights()), /reload/);
    assert.deepEqual(await read(), saved);
    await db.exec(`RESET ROLE; INSERT INTO public.species_in_area(area_id,species_id,weight_rate) VALUES('${id(1)}','${id(5)}',5); SET ROLE authenticated;`);
    await assert.rejects(save(weights(1, 99, 80, 20, boundary)), /reload/);
    await db.exec(`RESET ROLE; DELETE FROM public.species_in_area WHERE species_id='${id(5)}'; SET ROLE authenticated;`);
    // Partial permission must roll back even those rows the caller could update.
    await db.exec(`RESET ROLE; DROP POLICY admin_edit ON public.species_in_area;
      CREATE POLICY partial_edit ON public.species_in_area FOR UPDATE TO authenticated USING (species_id='${id(2)}'); SET ROLE authenticated;`);
    await assert.rejects(save(weights(5, 95, 80, 20, boundary)), /could not be updated/);
    assert.deepEqual(await read(), saved);
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(save(weights()), /permission denied/);
  } finally { await db.close(); }
});
