import type { ZkGateStatus } from "@/lib/api/zk-gate";

let audio: AudioContext | null = null;
let armed = false;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audio) audio = new Ctx();
  return audio;
}

export function punchSoundIsArmed(): boolean {
  return armed && audio?.state === "running";
}

export function armPunchSound(): void {
  const ctx = context();
  if (!ctx) return;
  void ctx.resume().then(() => {
    armed = ctx.state === "running";
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => armPunchSound());
  window.addEventListener("keydown", () => armPunchSound());
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

/** Loud, distinct tone for each punch result. Browsers stay silent until the screen is tapped once. */
export function playPunchStatus(status: ZkGateStatus): void {
  const ctx = context();
  if (!ctx) return;
  void ctx.resume().then(() => {
    if (ctx.state !== "running") return;
    armed = true;
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
  });
}
