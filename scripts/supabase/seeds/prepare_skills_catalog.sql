-- Catalog preparation only. Does not activate fishing effects or change RPCs.
-- Existing IDs, maximum levels and remaining skill investments are preserved.
BEGIN;

-- Prevent concurrent upgrades or catalog edits during the safety checks.
LOCK TABLE public.user_profile, public.skills, public.user_skills IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.skills) <> 20
     AND (SELECT count(*) FROM public.skills) <> 12 THEN
    RAISE EXCEPTION 'Unexpected skills catalog size; review before preparing';
  END IF;
  IF (SELECT count(*) FROM public.skills WHERE code = ANY(ARRAY[
    'xp_boost','fast_bite','shiny_hunter','rare_fish','big_fish','escape_reduction',
    'hook_mastery','rod_mastery','line_mastery','bait_mastery','bait_saver','weather_mastery'
  ])) <> 12 THEN
    RAISE EXCEPTION 'Expected twelve retained skills';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.skills WHERE code <> ALL(ARRAY[
      'xp_boost','fast_bite','shiny_hunter','rare_fish','big_fish','escape_reduction',
      'hook_mastery','rod_mastery','line_mastery','bait_mastery','bait_saver','weather_mastery',
      'catch_rate','fishing_luck','variant_hunter','heavy_fish','star_fish',
      'cash_boost','deep_fishing','shallow_fishing'
    ])
  ) THEN
    RAISE EXCEPTION 'Unexpected skill code; review before preparing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_skills us JOIN public.skills s ON s.id = us.skill_id
    WHERE s.code = ANY(ARRAY[
      'catch_rate','fishing_luck','variant_hunter','heavy_fish','star_fish',
      'cash_boost','deep_fishing','shallow_fishing'
    ])
  ) THEN
    RAISE EXCEPTION 'Retired skills have player investments; refund before removing';
  END IF;
END;
$$;

DELETE FROM public.skills WHERE code = ANY(ARRAY[
  'catch_rate','fishing_luck','variant_hunter','heavy_fish','star_fish',
  'cash_boost','deep_fishing','shallow_fishing'
]);

UPDATE public.skills s
SET sort_order = v.position, description = v.description,
    effect_per_level = v.effects::jsonb, is_disabled = false, updated_at = now()
FROM (VALUES
  ('xp_boost', 1, 'Tăng lượng kinh nghiệm nhận được khi câu cá.', '{"xp_bonus":2}'),
  ('fast_bite', 2, 'Giảm thời gian chờ cá cắn câu.', '{"bite_time_reduction":3}'),
  ('shiny_hunter', 3, 'Tăng cơ hội gặp cá Shiny, bao gồm biến thể Golden và Mutated.', '{"shiny_rate_bonus":0.2}'),
  ('rare_fish', 4, 'Tăng trọng số xuất hiện của cá Rare, Epic và Legendary trong các loài đủ điều kiện tại bãi câu.', '{"rare_fish_bonus":1}'),
  ('big_fish', 5, 'Tăng cơ hội gặp cá nặng hơn trong giới hạn trọng lượng của từng loài.', '{"big_fish_bonus":1.5}'),
  ('escape_reduction', 6, 'Tăng thời gian cho phép dây câu bị chùng trước khi cá thoát.', '{"slack_escape_time_bonus":1}'),
  ('hook_mastery', 7, 'Tăng chỉ số mắc câu của móc câu.', '{"hook_efficiency_bonus":2}'),
  ('rod_mastery', 8, 'Tăng tải trọng tối đa của cần câu.', '{"rod_efficiency_bonus":2}'),
  ('line_mastery', 9, 'Tăng sức chịu căng của dây câu.', '{"line_strength_bonus":2}'),
  ('bait_mastery', 10, 'Tăng khả năng thu hút các nhóm cá phù hợp với mồi câu.', '{"bait_efficiency_bonus":1.5}'),
  ('bait_saver', 11, 'Có cơ hội không tiêu hao mồi sau mỗi lần câu.', '{"bait_save_chance":2}'),
  ('weather_mastery', 12, 'Giảm một phần tác động bất lợi của thời tiết khi câu cá.', '{"weather_penalty_reduction":2}')
) AS v(code, position, description, effects)
WHERE s.code = v.code;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.skills) <> 12
     OR (SELECT count(*) FROM public.skills WHERE NOT is_disabled) <> 12 THEN
    RAISE EXCEPTION 'Expected exactly twelve enabled skills';
  END IF;
END;
$$;

COMMIT;
