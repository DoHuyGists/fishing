import supabase from '../database/connection';
import { healthSlots } from './healthEquipment';
import type { BodyEquipmentSet } from '../types/model/health';

export const supabaseBodyEquipmentRepository = {
  async fetchSets(): Promise<BodyEquipmentSet[]> {
    const { data, error } = await supabase.from('user_body_equipments').select('*').order('created_at').order('id');
    if (error) throw new Error(error.message);
    return data as BodyEquipmentSet[];
  },
  async createSet() {
    const { data, error } = await supabase.rpc('create_body_equipment_set').single<BodyEquipmentSet>();
    if (error) throw new Error(error.message);
    return data;
  },
  async saveSet(set: BodyEquipmentSet) {
    const parameters = Object.fromEntries(healthSlots.map(slot => [`p_${slot}`, set[slot].map(item => ({ inventory_id: item.inventory_id }))]));
    const { error } = await supabase.rpc('save_body_equipment_set', { p_set_id: set.id, ...parameters });
    if (error) throw new Error(error.message);
  },
  async chooseSet(id: string) {
    const { error } = await supabase.rpc('switch_body_equipment', { p_set_id: id });
    if (error) throw new Error(error.message);
  },
};
