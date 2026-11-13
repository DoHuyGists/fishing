import type { PlayerSnapshot } from '../types/model/playerRefresh';
import { catalogRequestBody } from './requestBody.ts';

// Installed after Pinia. Capture the owner before sending a mutation so a late
// response from a previous login cannot refresh the next user's stores.
let capture: ((snapshots: PlayerSnapshot[]) => () => void) | undefined;
export function setMutationRefreshHandler(handler: typeof capture) { capture = handler; }

const rewards: PlayerSnapshot[] = ['currency', 'profile', 'countries'];
const mutations: Record<string, PlayerSnapshot[]> = {
  submit_challenge: ['profile', 'countries'], submit_tension_challenge: ['profile', 'countries'],
  claim_daily_reward: rewards, claim_fishing_pass_reward: rewards, claim_badge_reward: rewards,
  complete_hour_mission: rewards, redeem_code: rewards, spin_wheel: rewards,
  use_inventory_item: rewards, purchase_item: ['currency'], buy_equipment_set: ['currency'],
  purchase_fishing_pass: ['currency'], craft_blueprint: ['currency'],
  upgrade_skill: ['profile'], change_faction: ['currency', 'profile'], join_faction: ['profile'],
  convert_currency: ['currency'], update_my_identity: ['profile'],
  update_my_country: ['profile', 'countries'], complete_my_onboarding: ['profile', 'countries'],
  buy_species_with_history: ['currency'], list_species_on_market: ['currency'],
  user_enter_area: ['area'], user_leave_area: ['area'], user_complete_fishing: ['area', 'currency', 'profile', 'countries'],
  respond_team_invite: ['area'], join_team: ['area'], leave_team: ['area'], close_team: ['area'],
  purchase_pond_slot: ['currency', 'profile'], stock_aquaculture_batch: ['currency'],
  sell_aquaculture_fish: ['currency'],
};

export function createMutationRefreshFetch(baseUrl: string, transport: typeof fetch): typeof fetch {
  const origin = new URL(baseUrl).origin;
  return async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url ?? String(input));
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    let rpc: string | undefined = url.pathname.split('/rest/v1/rpc/')[1];
    const wrapper = url.origin === origin && method === 'POST' && rpc === 'execute_game_catalog_action';
    // Capture the login before reading an asynchronous Request body. Populate
    // the captured list before invoking the notifier, after resolving the RPC.
    const snapshots = url.origin === origin && method === 'POST' && rpc ? wrapper ? [] as PlayerSnapshot[] : mutations[rpc] : undefined;
    const notify = snapshots ? capture?.(snapshots) : undefined;
    if (wrapper) {
      const body = await catalogRequestBody(input, init);
      rpc = typeof body.p_action === 'string' ? body.p_action : undefined;
      snapshots?.push(...(rpc ? mutations[rpc] ?? [] : []));
    }
    const response = await transport(input, init);
    if (notify && snapshots?.length && response.ok) {
      // Some RPCs return a business failure in an HTTP 200 response.
      try {
        const result = await response.clone().json();
        if (result?.success !== false) notify();
      } catch {
        if (response.status === 204) notify();
      }
    }
    return response;
  };
}
