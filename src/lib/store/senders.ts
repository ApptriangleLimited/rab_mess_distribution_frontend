import { getState, setState } from "@/lib/store";
import type { DailyTag, SenderAccount } from "@/lib/types";

export type SenderInput = {
  label: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  routing: string;
  branch: string;
  mapped_tags: DailyTag[];
};

function newId() {
  return `s_${Math.random().toString(36).slice(2, 10)}`;
}

export function listSenders() {
  return getState().senders;
}

export function getSender(id: string) {
  return getState().senders.find((s) => s.id === id) ?? null;
}

export function createSender(input: SenderInput): SenderAccount {
  const sender: SenderAccount = { id: newId(), ...input };
  setState((prev) => ({ ...prev, senders: [...prev.senders, sender] }));
  return sender;
}

export function updateSender(id: string, input: SenderInput): SenderAccount | null {
  const existing = getSender(id);
  if (!existing) return null;
  const updated = { ...existing, ...input };
  setState((prev) => ({
    ...prev,
    senders: prev.senders.map((s) => (s.id === id ? updated : s)),
  }));
  return updated;
}

export function removeSender(id: string) {
  setState((prev) => ({
    ...prev,
    senders: prev.senders.filter((s) => s.id !== id),
  }));
}
