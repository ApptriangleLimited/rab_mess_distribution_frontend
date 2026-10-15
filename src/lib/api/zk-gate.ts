import { apiJson } from "@/lib/api/client";

export type ZkGateStatus = "accepted" | "not_allowed" | "rfid_not_found";

export type ZkGateRow = {
  name: string;
  rab_id: string;
  rfid?: string;
  punched_at: string;
  allowed: boolean;
  status?: ZkGateStatus;
};

export type ZkGateSnapshot = {
  reachable: boolean;
  host: string;
  port: number;
  error: string;
  syncing: boolean;
  enrolled: number;
  removed: number;
  skipped: number;
  last_sync: string | null;
  date: string;
  rows: ZkGateRow[];
  started?: boolean;
};

export function fetchZkGate() {
  return apiJson<ZkGateSnapshot>("/api/v1/zk/gate");
}

export function syncZkGate() {
  return apiJson<ZkGateSnapshot>("/api/v1/zk/sync", { method: "POST" });
}
