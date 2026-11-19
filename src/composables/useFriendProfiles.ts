import { computed } from "vue";
import { useAuthStore } from "../stores/auth";
import { useFriendStore } from "../stores/player-friend-store";
import { useCountryStore } from "../stores/player-country-store";
import type { UserFriend } from "../types/model/friend";

const avatarGradients = [
  "from-emerald-600 to-teal-700", "from-blue-600 to-cyan-700", "from-amber-600 to-orange-700",
  "from-violet-600 to-purple-700", "from-rose-600 to-pink-700", "from-teal-600 to-emerald-800",
];

export function useFriendProfiles() {
  const auth = useAuthStore();
  const friendStore = useFriendStore();
  const countryStore = useCountryStore();
  const currentUserId = computed(() => auth.userId);
  const filteredFriends = computed(() => friendStore.acceptedFriends);
  const receivedRequests = computed(() => friendStore.getReceivedRequests(currentUserId.value));
  const sentRequests = computed(() => friendStore.getSentRequests(currentUserId.value));
  const filteredPlayers = computed(() => friendStore.profiles.filter(profile => profile.id !== currentUserId.value));
  const searchQuery = computed(() => friendStore.search);
  const getProfile = (id: string) => friendStore.profilesMap.get(id);
  const getFriendProfile = (record: UserFriend) => getProfile(record.user_id === currentUserId.value ? record.friend_id : record.user_id);
  const getSenderProfile = (record: UserFriend) => getProfile(record.user_id);
  const getRecipientProfile = (record: UserFriend) => getProfile(record.friend_id);
  const getRelation = (id: string) => friendStore.getFriendshipWithUser(id, currentUserId.value);
  function getAvatarGradient(id: string) {
    return avatarGradients[id ? (id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % avatarGradients.length : 0];
  }
  function formatUuid(id: string) {
    return !id || id.length < 12 ? id : `${id.slice(0, 8)}...${id.slice(-4)}`;
  }
  return { friendStore, countryStore, currentUserId, filteredFriends, receivedRequests, sentRequests,
    filteredPlayers, searchQuery, getFriendProfile, getSenderProfile, getRecipientProfile,
    getRelation, getAvatarGradient, formatUuid };
}
