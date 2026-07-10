"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/api";
import type { AdminUserRow } from "@/lib/admin/types";
import { btnPrimary, Card, inputCls, PageHeader } from "@/components/admin/ui";

export default function AccountPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [accountMsg, setAccountMsg] = useState("");

  const fetchUsers = useCallback(async () => {
    const res = await adminFetch("/admin/users");
    if (res.ok) setUsers(await res.json());
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleChangePassword() {
    setAccountMsg("");
    const res = await adminFetch("/admin/change-password", {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAccountMsg(data.detail);
      return;
    }
    setAccountMsg("Password updated");
    setCurrentPassword("");
    setNewPassword("");
  }

  async function handleCreateAdmin() {
    setAccountMsg("");
    const res = await adminFetch("/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: newAdminEmail.trim(),
        password: newAdminPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAccountMsg(data.detail);
      return;
    }
    setAccountMsg(`Admin ${data.email} created`);
    setNewAdminEmail("");
    setNewAdminPassword("");
    fetchUsers();
  }

  return (
    <>
      <PageHeader
        title="Account"
        description="Manage your password and admin users."
      />

      <div className="flex flex-col gap-6 max-w-xl">
        {accountMsg && (
          <p
            className={`text-sm px-1 ${
              accountMsg.includes("updated") || accountMsg.includes("created")
                ? "text-emerald-400"
                : "text-red-400"
            }`}
          >
            {accountMsg}
          </p>
        )}

        <Card className="p-6 flex flex-col gap-4">
          <h2 className="text-sm font-medium text-zinc-200">Change password</h2>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            className={inputCls}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            autoComplete="new-password"
            className={inputCls}
          />
          <button
            onClick={handleChangePassword}
            disabled={!currentPassword || !newPassword}
            className={`${btnPrimary} self-start`}
          >
            Update password
          </button>
        </Card>

        <Card className="p-6 flex flex-col gap-4">
          <h2 className="text-sm font-medium text-zinc-200">Admin users</h2>
          <div className="flex flex-col gap-0">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between text-sm py-3 border-b border-white/[0.06] last:border-0"
              >
                <span className="text-zinc-300">{u.email}</span>
                <span className="text-xs text-zinc-600">
                  {new Date(u.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 pt-2 border-t border-white/[0.06]">
            <p className="text-xs text-zinc-500">Add a new admin</p>
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="new-admin@example.com"
              className={inputCls}
            />
            <input
              type="password"
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              placeholder="Password (min 8 characters)"
              autoComplete="new-password"
              className={inputCls}
            />
            <button
              onClick={handleCreateAdmin}
              disabled={!newAdminEmail.trim() || !newAdminPassword}
              className={`${btnPrimary} self-start`}
            >
              Create admin
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}
