-- Run before rpc/equipment/save_body_equipment_set.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_body_equipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_used boolean NOT NULL DEFAULT false,
  head jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(head) = 'array'),
  torso jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(torso) = 'array'),
  hands jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(hands) = 'array'),
  legs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(legs) = 'array'),
  feet jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(feet) = 'array'),
  accessory jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(accessory) = 'array')
);
CREATE INDEX IF NOT EXISTS user_body_equipments_owner ON public.user_body_equipments(user_id, created_at, id);
CREATE UNIQUE INDEX IF NOT EXISTS user_body_equipments_one_active ON public.user_body_equipments(user_id) WHERE is_used;
ALTER TABLE public.user_body_equipments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_body_equipments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_body_equipments TO authenticated;
GRANT ALL ON public.user_body_equipments TO service_role;
DROP POLICY IF EXISTS body_equipment_owner_read ON public.user_body_equipments;
CREATE POLICY body_equipment_owner_read ON public.user_body_equipments FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Protect references even when deletion uses a different RPC or direct SQL.
-- save_body_equipment_set holds SHARE locks on inventory rows until commit.
CREATE OR REPLACE FUNCTION public.protect_body_equipment_inventory() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Allow the existing auth.users ON DELETE CASCADE cleanup.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN RETURN OLD; END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_body_equipments AS equipment
    CROSS JOIN LATERAL jsonb_array_elements(
      equipment.head || equipment.torso || equipment.hands || equipment.legs || equipment.feet || equipment.accessory
    ) AS items(entry)
    WHERE equipment.user_id = OLD.user_id AND items.entry->>'inventory_id' = OLD.id::text
  ) THEN
    RAISE EXCEPTION 'Hãy gỡ vật phẩm và lưu các set trang bị cơ thể trước khi xóa.';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_body_equipment_inventory() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_body_equipment_inventory ON public.user_inventory;
CREATE TRIGGER protect_body_equipment_inventory BEFORE DELETE ON public.user_inventory
  FOR EACH ROW EXECUTE FUNCTION public.protect_body_equipment_inventory();

-- Register endpoints with the optional server feature gate.
DO $$
BEGIN
  IF to_regclass('feature_control.request_rules') IS NOT NULL THEN
    INSERT INTO feature_control.request_rules(feature_key, path, writes_only) VALUES
      ('inventory', 'rpc/create_body_equipment_set', false),
      ('inventory', 'rpc/save_body_equipment_set', false),
      ('inventory', 'rpc/switch_body_equipment', false),
      ('inventory', 'user_body_equipments', true)
    ON CONFLICT (feature_key, path) DO UPDATE SET writes_only = EXCLUDED.writes_only;
  END IF;
END;
$$;
COMMIT;
