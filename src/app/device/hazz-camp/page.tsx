"use client";

import { DeviceBoard } from "@/components/zk/device-board";
import { fetchHazzDisplay } from "@/lib/api/zk-gate";

export default function HazzCampDevicePage() {
  return <DeviceBoard title="Haji camp" loadDisplay={fetchHazzDisplay} />;
}
