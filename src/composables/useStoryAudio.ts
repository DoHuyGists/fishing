import { onUnmounted, watch } from 'vue';
import type { StoryPlaybackStore } from '../stores/storyPlayback';

/** Owned by one mounted player; audio never survives the player or a scene voice. */
export function useStoryAudio(store: StoryPlaybackStore) {
  let bgm: HTMLAudioElement | null = null, voice: HTMLAudioElement | null = null, sfx: HTMLAudioElement | null = null;
  let context: AudioContext | null = null, drone: OscillatorNode | null = null, gain: GainNode | null = null;
  let bgmUrl = store.initialBgm, voicePending = false, generation = 0;
  const transient = new Set<OscillatorNode>();
  function stopTrack(track: HTMLAudioElement | null) { if (track) { track.pause(); track.removeAttribute('src'); track.load(); } }
  function stopBgm() { stopTrack(bgm); bgm = null; drone?.stop(); drone?.disconnect(); drone = null; gain?.disconnect(); gain = null; }
  function play(track: HTMLAudioElement | null) { if (track) void track.play().catch(() => {}); }
  function tone(url: string, loop: boolean) {
    try {
      context ??= new AudioContext();
      void context.resume().catch(() => {});
      const oscillator = context.createOscillator(), volume = context.createGain();
      oscillator.type = loop ? 'sine' : 'triangle';
      oscillator.frequency.value = url.includes('impact') ? 65 : url.includes('storm') ? 82 : loop ? 130.81 : 660;
      volume.gain.value = loop ? 0.018 : 0.06;
      oscillator.connect(volume); volume.connect(context.destination); oscillator.start();
      if (loop) { drone = oscillator; gain = volume; }
      else {
        transient.add(oscillator); volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.4); oscillator.stop(context.currentTime + 0.45);
        oscillator.onended = () => { transient.delete(oscillator); oscillator.disconnect(); volume.disconnect(); };
      }
    } catch { /* Silent media fallback on devices without Web Audio. */ }
  }
  function make(url: string, loop = false) {
    const audio = new Audio(url); audio.loop = loop; audio.volume = loop ? 0.24 : 0.75;
    return audio;
  }
  watch(() => store.sequence, () => {
    generation++;
    stopTrack(voice); stopTrack(sfx); voice = sfx = null; voicePending = true; store.voicePlaying = false;
    if (store.node?.audio.bgm !== undefined && store.node.audio.bgm !== bgmUrl) { stopBgm(); bgmUrl = store.node.audio.bgm; }
  }, { immediate: true, flush: 'sync' });
  watch(() => [store.sequence, store.started, store.muted, store.paused, store.completed, store.overlay] as const, () => {
    const suspended = store.muted || store.paused || store.completed || !store.started || Boolean(store.overlay);
    if (suspended) { bgm?.pause(); voice?.pause(); sfx?.pause(); if (context) void context.suspend().catch(() => {}); return; }
    if (context) void context.resume().catch(() => {});
    if (bgmUrl.startsWith('builtin:')) { if (!drone) tone(bgmUrl, true); }
    else if (bgmUrl && !bgm) {
      bgm = make(bgmUrl, true);
      const current = generation;
      bgm.onerror = () => { if (current === generation && !store.muted && !store.paused && !store.completed) tone('builtin:dawn', true); };
    }
    play(bgm); play(voice); play(sfx);
    if (!voicePending) return;
    voicePending = false;
    const audio = store.node?.audio;
    if (audio?.voice && !audio.voice.startsWith('builtin:')) {
      voice = make(audio.voice);
      const current = generation;
      voice.onplaying = () => { if (current === generation) store.voicePlaying = true; };
      voice.onended = voice.onerror = () => { if (current === generation) store.voicePlaying = false; };
      play(voice);
    }
    if (audio?.sfx?.startsWith('builtin:')) tone(audio.sfx, false);
    else if (audio?.sfx) { sfx = make(audio.sfx); play(sfx); }
  }, { immediate: true });
  onUnmounted(() => {
    generation++; stopBgm(); stopTrack(voice); stopTrack(sfx);
    for (const oscillator of transient) { oscillator.stop(); oscillator.disconnect(); }
    transient.clear(); if (context) void context.close().catch(() => {});
  });
}
