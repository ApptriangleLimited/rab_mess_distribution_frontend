import type { ZkGateStatus } from "@/lib/api/zk-gate";

const CLIPS: Record<ZkGateStatus, string> = {
  accepted: "/sounds/punch/accepted.wav",
  already_accepted: "/sounds/punch/duplicate.wav",
  rfid_not_found: "/sounds/punch/not-found.wav",
  not_allowed: "/sounds/punch/not-allowed.wav",
};

const PHRASES: Record<ZkGateStatus, string> = {
  accepted: "Accepted",
  already_accepted: "Duplicate",
  rfid_not_found: "Not found",
  not_allowed: "Not allowed",
};

let audio: AudioContext | null = null;
let armed = false;
const players = new Map<string, HTMLAudioElement>();

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audio) audio = new Ctx();
  return audio;
}

function clip(src: string): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  let el = players.get(src);
  if (!el) {
    el = new Audio(src);
    el.preload = "auto";
    el.volume = 1;
    players.set(src, el);
  }
  return el;
}

function maleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred = [
    /microsoft david/i,
    /google uk english male/i,
    /english united states/i,
    /daniel/i,
    /alex/i,
    /male/i,
  ];
  for (const match of preferred) {
    const voice = voices.find((item) => match.test(item.name));
    if (voice) return voice;
  }
  return voices.find((item) => item.lang.toLowerCase().startsWith("en")) ?? voices[0] ?? null;
}

function speak(status: ZkGateStatus): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(PHRASES[status]);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  utterance.pitch = 0.72;
  utterance.volume = 1;
  const voice = maleVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return true;
}

function tone(
  ctx: AudioContext,
  master: GainNode,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.95, start + 0.015);
  gain.gain.setValueAtTime(0.95, start + duration * 0.55);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playTone(status: ZkGateStatus): void {
  const ctx = context();
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime + 0.02;
  const master = ctx.createGain();
  master.gain.setValueAtTime(1, now);
  master.connect(ctx.destination);
  if (status === "accepted") {
    tone(ctx, master, 523, now, 0.16, "square");
    tone(ctx, master, 659, now, 0.16, "square");
    tone(ctx, master, 784, now + 0.14, 0.34, "square");
    tone(ctx, master, 1046, now + 0.14, 0.34, "square");
    return;
  }
  if (status === "already_accepted") {
    tone(ctx, master, 494, now, 0.14, "square");
    tone(ctx, master, 370, now, 0.14, "square");
    tone(ctx, master, 494, now + 0.18, 0.14, "square");
    tone(ctx, master, 370, now + 0.18, 0.14, "square");
    tone(ctx, master, 294, now + 0.36, 0.28, "square");
    return;
  }
  if (status === "rfid_not_found") {
    tone(ctx, master, 988, now, 0.12, "square");
    tone(ctx, master, 740, now, 0.12, "square");
    tone(ctx, master, 988, now + 0.16, 0.12, "square");
    tone(ctx, master, 988, now + 0.32, 0.16, "square");
    return;
  }
  tone(ctx, master, 196, now, 0.42, "sawtooth");
  tone(ctx, master, 146, now + 0.08, 0.46, "square");
  tone(ctx, master, 98, now + 0.2, 0.4, "square");
}

export function punchSoundIsArmed(): boolean {
  return armed;
}

export function armPunchSound(): void {
  armed = true;
  const ctx = context();
  if (ctx) void ctx.resume().then(() => {
    if (ctx.state === "running") armed = true;
  });
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    const warmup = new SpeechSynthesisUtterance(" ");
    warmup.volume = 0;
    window.speechSynthesis.speak(warmup);
  }
  for (const src of Object.values(CLIPS)) {
    const el = clip(src);
    if (!el) continue;
    el.muted = true;
    void el
      .play()
      .then(() => {
        el.pause();
        el.currentTime = 0;
        el.muted = false;
        el.volume = 1;
        armed = true;
      })
      .catch(() => {
        el.muted = false;
        el.volume = 1;
      });
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => armPunchSound());
  window.addEventListener("keydown", () => armPunchSound());
  window.speechSynthesis?.addEventListener("voiceschanged", () => {
    window.speechSynthesis.getVoices();
  });
}

/** Male voice: Accepted / Duplicate / Not found. Browsers stay silent until the screen is tapped once. */
export function playPunchStatus(status: ZkGateStatus): void {
  const el = clip(CLIPS[status]);
  if (el) {
    el.muted = false;
    el.volume = 1;
    el.currentTime = 0;
    void el
      .play()
      .then(() => {
        armed = true;
      })
      .catch(() => {
        if (!speak(status)) playTone(status);
      });
    return;
  }
  if (!speak(status)) playTone(status);
}
