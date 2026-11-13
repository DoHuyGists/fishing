export interface UserProfile {
  id: string;
  experience_point: number;
  skill_points: number;
  level: number;
  inventory_capacity: number;
  equipment_capacity: number;
  fishing_net_capacity: number;
  species_storage_capacity: number;
  pond_slot: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  country_id: string;
  update_country_cooldown: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  onboarding_completed: boolean;
  language: string | null;
}
