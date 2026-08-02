"use client";

import { useMemo } from "react";
import { useStore } from "@/hooks/use-store";
import {
  createUser,
  filterUsers,
  findUserByRabId,
  getUser,
  updateUser,
  type UserFilters,
  type UserInput,
} from "@/lib/store/users";

export function useUsers(filters?: UserFilters) {
  const state = useStore();
  const users = useMemo(
    () => (filters ? filterUsers(state.users, filters) : state.users),
    [state.users, filters],
  );
  return {
    users,
    allUsers: state.users,
    createUser,
    updateUser,
    getUser,
    findUserByRabId,
  };
}
