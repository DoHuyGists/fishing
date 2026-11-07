import { defineStore } from "pinia";

const birdSounds = Object.values(import.meta.glob<string>("/public/sound/bird/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
}));

export const useFishingBackgroundSoundStore = defineStore("fishingBackgroundSound", () => {
  let active = false;
  let audio: HTMLAudioElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSound: string | undefined;
  let waitingForGesture = false;
  let generation = 0;
  let nextPlayAt = 0;

  function randomDelay(min: number, max: number) {
    return min + Math.random() * (max - min);
  }

  function clearPlayback() {
    generation++;
    clearTimeout(timer);
    timer = undefined;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio = null;
    }
  }

  function schedule(initial = false) {
    if (!active || document.hidden || waitingForGesture || timer !== undefined || audio) return;
    const delay = Math.max(
      initial ? randomDelay(8_000, 20_000) : randomDelay(90_000, 180_000),
      nextPlayAt - Date.now(),
    );
    nextPlayAt = Date.now() + delay;
    timer = setTimeout(() => {
      timer = undefined;
      void play();
    }, delay);
  }

  async function play() {
    if (!active || document.hidden || audio || !birdSounds.length) return;
    const choices = birdSounds.filter((sound) => sound !== lastSound);
    const available = choices.length ? choices : birdSounds;
    const source = available[Math.floor(Math.random() * available.length)]!;
    const current = new Audio(source);
    const request = generation;
    audio = current;
    current.volume = randomDelay(0.2, 0.35);
    const finish = () => {
      if (audio !== current) return;
      clearPlayback();
      schedule();
    };
    current.onended = finish;
    current.onerror = finish;
    try {
      await current.play();
      if (request === generation) {
        lastSound = source;
        nextPlayAt = Date.now() + randomDelay(90_000, 180_000);
      }
    } catch (err) {
      if (request !== generation) return;
      clearPlayback();
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        waitingForGesture = true;
      } else {
        schedule();
      }
    }
  }

  function onInteraction() {
    if (!active || document.hidden || !waitingForGesture) return;
    waitingForGesture = false;
    void play();
  }

  function onVisibilityChange() {
    if (document.hidden) clearPlayback();
    else schedule(true);
  }

  function start() {
    if (active) return;
    active = true;
    document.addEventListener("pointerdown", onInteraction);
    document.addEventListener("keydown", onInteraction);
    document.addEventListener("visibilitychange", onVisibilityChange);
    schedule(true);
  }

  function stop() {
    active = false;
    waitingForGesture = false;
    clearPlayback();
    document.removeEventListener("pointerdown", onInteraction);
    document.removeEventListener("keydown", onInteraction);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  return { start, stop };
});
