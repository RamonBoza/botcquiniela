'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Crown,
  Gamepad2,
  History,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/client-api';

type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  organizationCount: number | string;
  isSuperAdmin: boolean;
};
type AdminOrganization = {
  id: string;
  name: string;
  slug: string;
  memberCount: number | string;
  gameCount: number | string;
};
type AdminMembership = {
  id: string;
  organizationId: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  username: string;
  displayName: string;
};
type AdminGame = {
  id: string;
  name: string;
  status: string;
  playerCount: number;
  organizationName: string;
  predictionCount: number | string;
};
type AuditEntry = {
  id: string;
  action: string;
  targetType: string;
  detailsJson: string;
  createdAt: number | string;
  actorUsername: string;
};
type AdminData = {
  users: AdminUser[];
  organizations: AdminOrganization[];
  memberships: AdminMembership[];
  games: AdminGame[];
  auditLog: AuditEntry[];
};

const actionLabels: Record<string, string> = {
  createUser: 'Creó un usuario',
  deleteUser: 'Eliminó un usuario',
  createOrganization: 'Creó una organización',
  deleteOrganization: 'Eliminó una organización',
  addMember: 'Añadió un miembro',
  removeMember: 'Quitó un miembro',
  setMemberRole: 'Cambió un rol',
  deleteGame: 'Eliminó una quiniela',
};

export function AdminPanel() {
  const [data, setData] = useState<AdminData | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [newUser, setNewUser] = useState({
    displayName: '',
    username: '',
    password: '',
  });
  const [newOrganization, setNewOrganization] = useState('');
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const response = await apiFetch('/api/admin');
    const body = await response
      .json()
      .catch(() => ({ error: 'No se ha podido cargar la administración.' }));
    if (response.ok) setData(body);
    else setMessage(body.error);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (
    payload: Record<string, unknown>,
    confirmation?: string,
  ) => {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await apiFetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response
        .json()
        .catch(() => ({ error: 'El servidor no ha completado la acción.' }));
      if (!response.ok) {
        setMessage(body.error);
        return;
      }
      setMessage('Cambio guardado.');
      await load();
    } catch {
      setMessage('No se ha podido conectar con el servidor.');
    } finally {
      setBusy(false);
    }
  };
  if (!data)
    return (
      <section className="mx-auto max-w-5xl px-5 py-10">
        <p className="text-sm text-zinc-400">
          {message || 'Cargando administración…'}
        </p>
      </section>
    );
  return (
    <section className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex items-start gap-4">
        <span className="grid size-12 place-items-center rounded-xl bg-[#d9ae5f]/10 text-[#d9ae5f]">
          <Shield />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#d9ae5f]">
            Control global
          </p>
          <h1 className="display text-4xl font-bold">
            Panel de superadministración
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Gestiona toda la comunidad desde un único lugar.
          </p>
        </div>
      </div>
      {message && (
        <p
          className={`mt-5 rounded-xl border p-3 text-sm ${message === 'Cambio guardado.' ? 'border-emerald-500/20 text-emerald-400' : 'border-red-500/20 text-red-400'}`}
        >
          {message}
        </p>
      )}
      <div className="mt-7 grid grid-cols-3 gap-3">
        {[
          { Icon: Users, value: data.users.length, label: 'Usuarios' },
          {
            Icon: Building2,
            value: data.organizations.length,
            label: 'Organizaciones',
          },
          { Icon: Gamepad2, value: data.games.length, label: 'Quinielas' },
        ].map(({ Icon, value, label }) => (
          <div
            key={String(label)}
            className="rounded-2xl border bg-white/[.025] p-4"
          >
            <Icon className="size-5 text-[#d9ae5f]" />
            <b className="display mt-3 block text-3xl">{String(value)}</b>
            <span className="text-xs text-zinc-500">{String(label)}</span>
          </div>
        ))}
      </div>

      <AdminSection icon={<UserPlus />} title="Crear usuario">
        <div className="grid gap-2 md:grid-cols-4">
          <Input
            placeholder="Nombre visible"
            value={newUser.displayName}
            onChange={(e) =>
              setNewUser({ ...newUser, displayName: e.target.value })
            }
          />
          <Input
            placeholder="Usuario"
            value={newUser.username}
            onChange={(e) =>
              setNewUser({ ...newUser, username: e.target.value })
            }
          />
          <Input
            type="password"
            placeholder="Contraseña temporal"
            value={newUser.password}
            onChange={(e) =>
              setNewUser({ ...newUser, password: e.target.value })
            }
          />
          <Button
            disabled={busy}
            onClick={async () => {
              await act({ action: 'createUser', ...newUser });
              setNewUser({ displayName: '', username: '', password: '' });
            }}
          >
            Crear usuario
          </Button>
        </div>
      </AdminSection>

      <AdminSection icon={<Users />} title="Usuarios">
        <div className="space-y-2">
          {data.users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-black/10 p-3"
            >
              <div>
                <p className="flex items-center gap-2 text-sm font-bold">
                  {user.displayName}
                  {user.isSuperAdmin && (
                    <Crown className="size-4 text-[#d9ae5f]" />
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  @{user.username} · {user.organizationCount} organizaciones
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled={busy || user.isSuperAdmin}
                onClick={() =>
                  act(
                    { action: 'deleteUser', userId: user.id },
                    `¿Eliminar definitivamente a @${user.username}? Se borrarán sus sesiones, membresías y apuestas.`,
                  )
                }
              >
                <Trash2 /> Eliminar
              </Button>
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection icon={<Building2 />} title="Organizaciones">
        <div className="mb-4 flex gap-2">
          <Input
            placeholder="Nueva organización"
            value={newOrganization}
            onChange={(e) => setNewOrganization(e.target.value)}
          />
          <Button
            disabled={busy}
            onClick={async () => {
              await act({
                action: 'createOrganization',
                name: newOrganization,
              });
              setNewOrganization('');
            }}
          >
            Crear
          </Button>
        </div>
        <div className="space-y-4">
          {data.organizations.map((org) => (
            <div key={org.id} className="rounded-2xl border bg-black/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="display text-2xl font-bold">{org.name}</h3>
                  <p className="text-xs text-zinc-500">
                    {org.memberCount} miembros · {org.gameCount} quinielas
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    act(
                      { action: 'deleteOrganization', organizationId: org.id },
                      `¿Eliminar ${org.name}? También se eliminarán sus quinielas, apuestas e invitaciones.`,
                    )
                  }
                >
                  <Trash2 /> Eliminar
                </Button>
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  placeholder="Usuario que quieres añadir"
                  value={memberNames[org.id] ?? ''}
                  onChange={(e) =>
                    setMemberNames({ ...memberNames, [org.id]: e.target.value })
                  }
                />
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    await act({
                      action: 'addMember',
                      organizationId: org.id,
                      username: memberNames[org.id],
                    });
                    setMemberNames({ ...memberNames, [org.id]: '' });
                  }}
                >
                  <UserPlus /> Añadir
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {data.memberships
                  .filter((member) => member.organizationId === org.id)
                  .map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white/[.025] p-3"
                    >
                      <div>
                        <p className="text-sm font-bold">
                          {member.displayName}
                        </p>
                        <p className="text-xs text-zinc-600">
                          @{member.username}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={member.role}
                          disabled={busy}
                          onChange={(e) =>
                            void act({
                              action: 'setMemberRole',
                              organizationId: org.id,
                              userId: member.userId,
                              role: e.target.value,
                            })
                          }
                          className="h-8 rounded-lg border bg-[#19161f] px-2 text-xs"
                        >
                          <option value="MEMBER">Miembro</option>
                          <option value="ADMIN">Administrador</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busy}
                          aria-label={`Quitar a ${member.displayName}`}
                          onClick={() =>
                            act(
                              {
                                action: 'removeMember',
                                organizationId: org.id,
                                userId: member.userId,
                              },
                              `¿Quitar a ${member.displayName} de ${org.name}?`,
                            )
                          }
                        >
                          <Trash2 className="text-red-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection icon={<Gamepad2 />} title="Quinielas">
        <div className="space-y-2">
          {data.games.map((game) => (
            <div
              key={game.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-black/10 p-3"
            >
              <div>
                <p className="text-sm font-bold">{game.name}</p>
                <p className="text-xs text-zinc-500">
                  {game.organizationName} · {game.status} ·{' '}
                  {game.predictionCount} apuestas
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() =>
                  act(
                    { action: 'deleteGame', gameId: game.id },
                    `¿Eliminar la quiniela ${game.name} y todas sus apuestas?`,
                  )
                }
              >
                <Trash2 /> Eliminar
              </Button>
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection icon={<History />} title="Actividad administrativa">
        <div className="space-y-2">
          {data.auditLog.length === 0 ? (
            <p className="text-sm text-zinc-600">
              Todavía no hay acciones registradas.
            </p>
          ) : (
            data.auditLog.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border-b border-white/5 py-2 text-sm"
              >
                <b>@{entry.actorUsername}</b>{' '}
                <span className="text-zinc-400">
                  {actionLabels[entry.action] ?? entry.action}
                </span>
                <time className="ml-2 text-xs text-zinc-600">
                  {new Date(Number(entry.createdAt)).toLocaleString('es-ES')}
                </time>
              </div>
            ))
          )}
        </div>
      </AdminSection>
    </section>
  );
}

function AdminSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 rounded-2xl border bg-white/[.02] p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#d9ae5f]">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
