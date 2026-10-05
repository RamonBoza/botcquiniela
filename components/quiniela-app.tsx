'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  Clipboard,
  Crown,
  FileJson,
  KeyRound,
  LockKeyhole,
  MoonStar,
  Plus,
  ScrollText,
  Share2,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { AdminPanel } from '@/components/admin-panel';
import {
  apiFetch,
  clearDevelopmentSession,
  saveDevelopmentSession,
} from '@/lib/client-api';
import {
  BotcJsonScriptImporter,
  troubleBrewing,
  type ImportedCharacter,
  type ImportedScript,
} from '@/lib/botc-script-importer';
import {
  getLegionDistribution,
  getSetupLimits,
  LEGION_ID,
  MAX_VILLAGE_IDIOTS,
  validateSetupSelection,
  VILLAGE_IDIOT_ID,
} from '@/lib/setup-rules';

type View =
  | 'auth'
  | 'dashboard'
  | 'admin'
  | 'welcome'
  | 'create'
  | 'host'
  | 'join'
  | 'play'
  | 'results';
const groups = [
  {
    role: 'TOWNSFOLK',
    label: 'Aldeanos',
    singular: 'Aldeano',
    color: '#5ba9d6',
  },
  {
    role: 'OUTSIDER',
    label: 'Forasteros',
    singular: 'Forastero',
    color: '#77aee7',
  },
  { role: 'MINION', label: 'Esbirros', singular: 'Esbirro', color: '#df6265' },
  { role: 'DEMON', label: 'Demonios', singular: 'Demonio', color: '#bd343d' },
] as const;

const roleAppearance: Record<
  string,
  { label: string; card: string; badge: string }
> = {
  TOWNSFOLK: {
    label: 'Aldeano',
    card: 'border-[#43a047]/45 bg-[#2e7d32]/25',
    badge: 'bg-[#43a047]/25 text-[#a5d6a7]',
  },
  OUTSIDER: {
    label: 'Forastero',
    card: 'border-[#2e7d32]/55 bg-[#1b5e20]/35',
    badge: 'bg-[#2e7d32]/30 text-[#81c784]',
  },
  MINION: {
    label: 'Esbirro',
    card: 'border-[#e53935]/45 bg-[#c62828]/25',
    badge: 'bg-[#e53935]/25 text-[#ef9a9a]',
  },
  DEMON: {
    label: 'Demonio',
    card: 'border-[#b71c1c]/60 bg-[#7f0000]/40',
    badge: 'bg-[#b71c1c]/35 text-[#ffcdd2]',
  },
};

function getRoleAppearance(role: string) {
  return (
    roleAppearance[role] ?? {
      label: role,
      card: 'border-white/10 bg-white/[.025]',
      badge: 'bg-white/5 text-zinc-300',
    }
  );
}
export function QuinielaApp() {
  const [view, setView] = useState<View>('auth');
  const [script, setScript] = useState<ImportedScript>(troubleBrewing);
  const [name, setName] = useState('Clocktower — 14 septiembre');
  const [players, setPlayers] = useState(14);
  const [status, setStatus] = useState<'OPEN' | 'LOCKED' | 'FINISHED'>('OPEN');
  const [selected, setSelected] = useState<string[]>([]);
  const [actual, setActual] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [person, setPerson] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [org, setOrg] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [gameId, setGameId] = useState('');
  const [superAdmin, setSuperAdmin] = useState(false);
  const sessionUserId = useRef('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    apiFetch('/api/auth')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          sessionUserId.current = data.user.id;
          setPerson(data.user.displayName);
          setSuperAdmin(Boolean(data.user.isSuperAdmin));
          setView('dashboard');
        }
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const verifySession = () => {
      if (document.visibilityState !== 'visible' || !sessionUserId.current)
        return;
      apiFetch('/api/auth')
        .then((response) => response.json())
        .then((data) => {
          if (data.user?.id !== sessionUserId.current) location.reload();
        })
        .catch(() => undefined);
    };
    window.addEventListener('focus', verifySession);
    document.addEventListener('visibilitychange', verifySession);
    return () => {
      window.removeEventListener('focus', verifySession);
      document.removeEventListener('visibilitychange', verifySession);
    };
  }, []);
  const enter = () => {
    if (!person.trim()) {
      setError('Escribe tu nombre para continuar.');
      return;
    }
    localStorage.setItem('quiniela-clocktower-nombre', person.trim());
    setView('play');
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      setScript(
        await new BotcJsonScriptImporter().import(
          JSON.parse(await file.text()),
        ),
      );
      setError('');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se ha podido importar el guion.',
      );
    }
  };
  const goBack = () =>
    setView(
      view === 'play' ||
        view === 'join' ||
        view === 'create' ||
        view === 'host' ||
        view === 'results' ||
        view === 'admin'
        ? 'dashboard'
        : 'welcome',
    );
  return (
    <main className="app-shell paper-noise min-h-svh">
      {view !== 'welcome' && view !== 'auth' && view !== 'dashboard' && (
        <Topbar view={view} back={goBack} />
      )}
      {view === 'auth' && (
        <AccountAccess
          onDone={(user) => {
            sessionUserId.current = user.id;
            setPerson(user.displayName);
            setSuperAdmin(Boolean(user.isSuperAdmin));
            setView('dashboard');
          }}
        />
      )}
      {view === 'dashboard' && (
        <LiveOrganizationDashboard
          signedInAs={person}
          openAdmin={superAdmin ? () => setView('admin') : undefined}
          selectOrganization={(id, orgName) => {
            setOrganizationId(id);
            setOrg(orgName);
          }}
          createGame={(id, orgName, selectedSeasonId) => {
            setOrganizationId(id);
            setSeasonId(selectedSeasonId);
            setOrg(orgName);
            setView('create');
          }}
          joinGame={(game) => {
            setGameId(game.id);
            setOrganizationId(game.organizationId);
            setName(game.name);
            setPlayers(game.playerCount);
            setStatus(game.status);
            setScript({
              name: game.scriptName,
              source: 'BOTC_JSON',
              characters: JSON.parse(game.charactersJson),
            });
            apiFetch(`/api/games/prediction?gameId=${game.id}`)
              .then((r) => r.json())
              .then((data) => {
                setSelected(data.characterIds ?? []);
                setSaved(Boolean(data.characterIds?.length));
                if (data.status) setStatus(data.status);
              });
            setView('play');
          }}
          manageGame={(game) => {
            setGameId(game.id);
            setOrganizationId(game.organizationId);
            setName(game.name);
            setPlayers(game.playerCount);
            setStatus(game.status);
            setActual([]);
            setScript({
              name: game.scriptName,
              source: 'BOTC_JSON',
              characters: JSON.parse(game.charactersJson),
            });
            setView('host');
          }}
          results={(game) => {
            setGameId(game.id);
            setName(game.name);
            setScript({
              name: game.scriptName,
              source: 'BOTC_JSON',
              characters: JSON.parse(game.charactersJson),
            });
            setView('results');
          }}
        />
      )}
      {view === 'admin' && <AdminPanel />}
      {view === 'welcome' && (
        <Welcome
          onCreate={() => setView('create')}
          onJoin={() => setView('join')}
          onDemo={() => setView('results')}
        />
      )}
      {view === 'create' && (
        <Create
          name={name}
          setName={setName}
          players={players}
          setPlayers={setPlayers}
          script={script}
          error={error}
          creating={creating}
          fileRef={fileRef}
          importFile={importFile}
          create={async () => {
            setCreating(true);
            setError('');
            try {
              const response = await apiFetch('/api/games', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  organizationId,
                  seasonId,
                  name,
                  script,
                  playerCount: players,
                }),
              });
              const data = await response.json().catch(() => ({}));
              if (!response.ok) {
                setError(data.error ?? 'No se ha podido crear la quiniela.');
                return;
              }
              setGameId(data.game.id);
              setStatus('OPEN');
              setView('host');
            } catch {
              setError(
                'No se ha podido conectar con el servidor. Inténtalo de nuevo.',
              );
            } finally {
              setCreating(false);
            }
          }}
        />
      )}
      {view === 'join' && (
        <Join name={person} setName={setPerson} error={error} enter={enter} />
      )}
      {view === 'play' && (
        <Selector
          title={name}
          script={script}
          playerCount={players}
          status={status}
          selected={selected}
          setSelected={(next) => {
            setSelected(next);
            setSaved(false);
          }}
          saved={saved}
          save={async () => {
            const response = await apiFetch('/api/games/prediction', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ gameId, characterIds: selected }),
            });
            if (response.ok) setSaved(true);
          }}
          mode="prediction"
        />
      )}
      {view === 'host' && (
        <Host
          gameId={gameId}
          name={`${name} · ${org}`}
          players={players}
          status={status}
          setStatus={async (next) => {
            if (next === 'LOCKED' || next === 'OPEN') {
              const response = await apiFetch('/api/games/manage', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  gameId,
                  action: next === 'LOCKED' ? 'lock' : 'reopen',
                }),
              });
              if (response.ok) setStatus(next);
            }
          }}
          script={script}
          actual={actual}
          setActual={setActual}
          finish={async () => {
            const response = await apiFetch('/api/games/manage', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                gameId,
                action: 'finish',
                actualCharacterIds: actual,
              }),
            });
            if (response.ok) {
              setStatus('FINISHED');
              setView('results');
            }
          }}
        />
      )}
      {view === 'results' && (
        <Results gameId={gameId} script={script} fallbackActual={actual} />
      )}
    </main>
  );
}

function Topbar({ view, back }: { view: View; back: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#100e14]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <button
          onClick={back}
          className="grid size-10 place-items-center rounded-full text-zinc-400 hover:bg-white/5"
          aria-label="Volver"
        >
          <ChevronLeft />
        </button>
        <div className="flex items-center gap-2 text-xs font-bold tracking-[.14em]">
          <MoonStar className="size-4 text-[#d9ae5f]" />
          {view === 'create'
            ? 'NUEVA QUINIELA'
            : view === 'host'
              ? 'MESA DEL NARRADOR'
              : view === 'results'
                ? 'RESULTADOS'
                : view === 'admin'
                  ? 'SUPERADMINISTRACIÓN'
                  : 'QUINIELA'}
        </div>
        <span className="size-10" />
      </div>
    </header>
  );
}

function AccountAccess({
  onDone,
}: {
  onDone: (user: {
    id: string;
    displayName: string;
    isSuperAdmin?: boolean;
  }) => void;
}) {
  const [register, setRegister] = useState(true);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (
      (register && !name.trim()) ||
      username.trim().length < 3 ||
      password.length < 8
    ) {
      setMessage(
        'Completa los campos. La contraseña debe tener al menos 8 caracteres.',
      );
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await apiFetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: register ? 'register' : 'login',
          displayName: name,
          username,
          password,
        }),
      });
      const data = await response.json().catch(() => ({
        error: 'El servicio no ha podido completar la solicitud.',
      }));
      if (!response.ok) {
        setMessage(data.error ?? 'No se ha podido iniciar la sesión.');
        return;
      }
      saveDevelopmentSession(data.sessionToken);
      onDone(data.user);
    } catch {
      setMessage('No se puede conectar con el servicio. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-5 py-10">
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full border border-[#d9ae5f]/30 bg-[#d9ae5f]/8">
          <KeyRound className="size-7 text-[#d9ae5f]" />
        </span>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-[#d9ae5f]">
          Tu identidad en la villa
        </p>
        <h1 className="display mt-2 text-5xl font-bold">
          {register ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          {register
            ? 'Sin redes sociales ni SSO. Solo lo necesario para jugar.'
            : 'Entra para ver tus organizaciones y quinielas.'}
        </p>
      </div>
      <div className="mt-8 space-y-3">
        {register && (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre visible"
            className="h-13 border-white/10 bg-white/[.04] px-4"
          />
        )}
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Nombre de usuario"
          autoComplete="username"
          className="h-13 border-white/10 bg-white/[.04] px-4"
        />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          autoComplete={register ? 'new-password' : 'current-password'}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="h-13 border-white/10 bg-white/[.04] px-4"
        />
        {message && <p className="text-sm text-red-400">{message}</p>}
        <Button
          disabled={busy}
          onClick={submit}
          className="h-14 w-full bg-[#d9ae5f] text-base font-extrabold text-[#17120a]"
        >
          {busy ? 'Conectando…' : register ? 'Crear cuenta' : 'Entrar'}
        </Button>
      </div>
      <button
        onClick={() => {
          setRegister(!register);
          setMessage('');
        }}
        className="mt-6 text-sm text-zinc-400 hover:text-[#d9ae5f]"
      >
        {register ? 'Ya tengo cuenta' : 'Quiero crear una cuenta'}
      </button>
    </section>
  );
}

function OrganizationDashboard({
  organization,
  setOrganization,
  createGame,
  joinGame,
  results,
}: {
  organization: string;
  setOrganization: (v: string) => void;
  createGame: () => void;
  joinGame: () => void;
  results: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  return (
    <section className="mx-auto max-w-2xl px-5 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[.15em]">
          <MoonStar className="size-4 text-[#d9ae5f]" /> QUINIELA CLOCKTOWER
        </div>
        <span className="grid size-9 place-items-center rounded-full bg-[#d9ae5f] text-sm font-black text-[#17120a]">
          R
        </span>
      </header>
      <div className="mt-9 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#d9ae5f]">
            Tu organización
          </p>
          <h1 className="display mt-1 text-4xl font-bold">{organization}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
            <Users className="size-4" /> 18 miembros · Eres administrador
          </p>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="grid size-11 shrink-0 place-items-center rounded-xl border bg-white/[.03] text-[#d9ae5f]"
          aria-label="Invitar miembros"
        >
          <UserPlus />
        </button>
      </div>
      {showInvite && (
        <div className="mt-5 rounded-2xl border border-[#d9ae5f]/25 bg-[#d9ae5f]/5 p-5">
          <p className="text-sm font-bold">Invita a la organización</p>
          <div className="mt-3 flex gap-2">
            <code className="flex h-11 flex-1 items-center rounded-lg bg-black/25 px-3 text-sm tracking-widest text-[#d9ae5f]">
              TERRASSA7
            </code>
            <button
              className="grid size-11 place-items-center rounded-lg bg-[#d9ae5f] text-[#17120a]"
              aria-label="Copiar código"
            >
              <Clipboard className="size-4" />
            </button>
            <button
              className="grid size-11 place-items-center rounded-lg bg-white/10"
              aria-label="Compartir invitación"
            >
              <Share2 className="size-4" />
            </button>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Comparte el enlace, el QR o el código. Los nuevos miembros
            aparecerán aquí.
          </p>
        </div>
      )}
      <div className="mt-8 grid grid-cols-2 gap-3">
        <Button
          onClick={createGame}
          className="h-13 bg-[#d9ae5f] font-extrabold text-[#17120a]"
        >
          <Plus /> Crear quiniela
        </Button>
        <Button
          onClick={joinGame}
          variant="outline"
          className="h-13 border-white/10 bg-white/[.03]"
        >
          <Users /> Participar
        </Button>
      </div>
      <h2 className="mt-10 text-xs font-bold uppercase tracking-[.18em] text-zinc-500">
        Quinielas de la organización
      </h2>
      <div className="mt-4 space-y-3">
        <button
          onClick={joinGame}
          className="w-full rounded-2xl border border-[#d9ae5f]/25 bg-[#d9ae5f]/5 p-5 text-left"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#d9ae5f]">
                Abierta
              </span>
              <h3 className="display mt-1 text-2xl font-bold">
                Clocktower — 14 septiembre
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Trouble Brewing · 14 jugadores
              </p>
            </div>
            <span className="rounded-full bg-[#d9ae5f]/10 px-3 py-1 text-xs text-[#d9ae5f]">
              11 / 14
            </span>
          </div>
        </button>
        <button
          onClick={results}
          className="w-full rounded-2xl border bg-white/[.025] p-5 text-left"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Finalizada
          </span>
          <h3 className="display mt-1 text-2xl font-bold">
            Clocktower — 7 septiembre
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Bad Moon Rising · Ver resultados
          </p>
        </button>
      </div>
      <button
        onClick={() => setShowCreate(!showCreate)}
        className="mt-8 flex items-center gap-2 text-sm text-zinc-400"
      >
        <Building2 className="size-4" /> Crear otra organización
      </button>
      {showCreate && (
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Nombre de la organización"
            className="h-11 border-white/10 bg-white/[.03]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value) {
                setOrganization(e.currentTarget.value);
                setShowCreate(false);
              }
            }}
          />
          <Button onClick={() => setShowCreate(false)}>Crear</Button>
        </div>
      )}
    </section>
  );
}

type LiveOrganization = {
  id: string;
  name: string;
  slug: string;
  role: 'ADMIN' | 'MEMBER';
  memberCount: number;
};
type LiveGame = {
  id: string;
  code: string;
  name: string;
  organizationId: string;
  seasonId: string;
  seasonName: string;
  scriptName: string;
  charactersJson: string;
  playerCount: number;
  status: 'OPEN' | 'LOCKED' | 'FINISHED';
  predictionCount: number;
};
type LiveSeason = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'CLOSED';
  startsAt: number;
  endsAt: number | null;
  gameCount: number;
  prizeText: string | null;
  penaltyText: string | null;
};
type SeasonStanding = {
  userId: string;
  displayName: string;
  points: number;
  gamesPlayed: number;
};
function LiveOrganizationDashboard({
  signedInAs,
  openAdmin,
  selectOrganization,
  createGame,
  joinGame,
  manageGame,
  results,
}: {
  signedInAs: string;
  openAdmin?: () => void;
  selectOrganization: (id: string, name: string) => void;
  createGame: (id: string, name: string, seasonId: string) => void;
  joinGame: (game: LiveGame) => void;
  manageGame: (game: LiveGame) => void;
  results: (game: LiveGame) => void;
}) {
  const [organizations, setOrganizations] = useState<LiveOrganization[]>([]);
  const [games, setGames] = useState<LiveGame[]>([]);
  const [seasons, setSeasons] = useState<LiveSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [standings, setStandings] = useState<SeasonStanding[]>([]);
  const [newSeason, setNewSeason] = useState('');
  const [newSeasonPrize, setNewSeasonPrize] = useState('');
  const [newSeasonPenalty, setNewSeasonPenalty] = useState('');
  const [seasonPrize, setSeasonPrize] = useState('');
  const [seasonPenalty, setSeasonPenalty] = useState('');
  const [active, setActive] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [invite, setInvite] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    const [orgResponse, gameResponse] = await Promise.all([
      apiFetch('/api/organizations'),
      apiFetch('/api/games'),
    ]);
    if (orgResponse.ok) {
      const data = await orgResponse.json();
      setOrganizations(data.organizations);
      if (!active && data.organizations[0]) {
        setActive(data.organizations[0].id);
        selectOrganization(
          data.organizations[0].id,
          data.organizations[0].name,
        );
      }
    }
    if (gameResponse.ok) setGames((await gameResponse.json()).games);
  };
  useEffect(() => {
    void load();
  }, []);
  const current = organizations.find((o) => o.id === active);
  const activeSeason = seasons.find((season) => season.status === 'ACTIVE');
  const loadSeasons = async (organizationId: string, seasonId?: string) => {
    const query = new URLSearchParams({ organizationId });
    if (seasonId) query.set('seasonId', seasonId);
    const response = await apiFetch(`/api/seasons?${query}`);
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error);
      return;
    }
    setSeasons(data.seasons);
    setSelectedSeasonId(data.selectedSeasonId ?? '');
    setStandings(data.standings);
    const selected = data.seasons.find(
      (season: LiveSeason) => season.id === data.selectedSeasonId,
    );
    setSeasonPrize(selected?.prizeText ?? '');
    setSeasonPenalty(selected?.penaltyText ?? '');
  };
  useEffect(() => {
    if (active) void loadSeasons(active);
  }, [active]);
  useEffect(() => {
    setInvite('');
    if (!active || current?.role !== 'ADMIN') return;
    apiFetch(`/api/organizations/invite?organizationId=${active}`)
      .then((response) => (response.ok ? response.json() : { code: null }))
      .then((data) => setInvite(data.code ?? ''))
      .catch(() => undefined);
  }, [active, current?.role]);
  const createOrg = async () => {
    const response = await apiFetch('/api/organizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: newOrg }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error);
      return;
    }
    setNewOrg('');
    await load();
    setActive(data.organization.id);
    selectOrganization(data.organization.id, data.organization.name);
  };
  const makeInvite = async () => {
    const response = await apiFetch('/api/organizations/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: active }),
    });
    const data = await response.json();
    if (response.ok) {
      setInvite(data.code);
      setMessage('');
    } else setMessage(data.error);
  };
  const join = async () => {
    const response = await apiFetch('/api/organizations/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: joinCode }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error);
      return;
    }
    setJoinCode('');
    setMessage('Te has unido a la organización.');
    await load();
  };
  const createSeason = async () => {
    const response = await apiFetch('/api/seasons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: active,
        name: newSeason,
        prizeText: newSeasonPrize,
        penaltyText: newSeasonPenalty,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error);
      return;
    }
    setNewSeason('');
    setNewSeasonPrize('');
    setNewSeasonPenalty('');
    setMessage(`La temporada «${data.season.name}» ya está activa.`);
    await loadSeasons(active, data.season.id);
  };
  const saveSeasonRewards = async () => {
    const response = await apiFetch('/api/seasons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'updateRewards',
        organizationId: active,
        seasonId: selectedSeasonId,
        prizeText: seasonPrize,
        penaltyText: seasonPenalty,
      }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error);
    setMessage('Premio y penitencia guardados.');
    await loadSeasons(active, selectedSeasonId);
  };
  return (
    <section className="mx-auto max-w-2xl px-5 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[.15em]">
          <MoonStar className="size-4 text-[#d9ae5f]" /> QUINIELA CLOCKTOWER
        </div>
        <div className="flex items-center gap-4">
          <span className="max-w-24 truncate text-[10px] text-zinc-600 sm:max-w-none sm:text-xs">
            Sesión: <b className="text-zinc-400">{signedInAs}</b>
          </span>
          {openAdmin && (
            <button
              onClick={openAdmin}
              className="flex items-center gap-1 text-xs font-bold text-[#d9ae5f]"
            >
              <Crown className="size-4" /> Administrar
            </button>
          )}
          <button
            onClick={() =>
              apiFetch('/api/auth', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'logout' }),
              }).then(() => {
                clearDevelopmentSession();
                location.reload();
              })
            }
            className="text-xs text-zinc-500"
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      {organizations.length === 0 ? (
        <div className="mt-16 rounded-2xl border bg-white/[.025] p-6 text-center">
          <Building2 className="mx-auto size-8 text-[#d9ae5f]" />
          <h1 className="display mt-4 text-4xl font-bold">
            Crea tu organización
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            O únete con el código que te haya enviado un administrador.
          </p>
          <div className="mt-6 flex gap-2">
            <Input
              value={newOrg}
              onChange={(e) => setNewOrg(e.target.value)}
              placeholder="Nombre de la organización"
              className="h-11 bg-white/[.03]"
            />
            <Button onClick={createOrg}>Crear</Button>
          </div>
          <div className="my-5 gold-line" />
          <div className="flex gap-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Código de invitación"
              className="h-11 bg-white/[.03] uppercase"
            />
            <Button variant="outline" onClick={join}>
              Unirme
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-9 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#d9ae5f]">
                Tu organización
              </p>
              <select
                value={active}
                onChange={(e) => {
                  setActive(e.target.value);
                  const org = organizations.find(
                    (o) => o.id === e.target.value,
                  );
                  if (org) selectOrganization(org.id, org.name);
                }}
                className="display mt-1 max-w-full bg-transparent text-4xl font-bold outline-none"
              >
                {organizations.map((o) => (
                  <option key={o.id} value={o.id} className="bg-[#19161f]">
                    {o.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                <Users className="size-4" /> {current?.memberCount ?? 1}{' '}
                miembros ·{' '}
                {current?.role === 'ADMIN' ? 'Administrador' : 'Miembro'}
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border bg-white/[.025] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold">
                  <CalendarDays className="size-4 text-[#d9ae5f]" /> Temporada
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Las quinielas finalizadas acumulan puntos en su temporada.
                </p>
              </div>
              {activeSeason && (
                <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Activa: {activeSeason.name}
                </span>
              )}
            </div>
            {seasons.length > 0 && (
              <select
                value={selectedSeasonId}
                onChange={(event) =>
                  void loadSeasons(active, event.target.value)
                }
                className="mt-4 h-11 w-full rounded-lg border border-white/10 bg-[#19161f] px-3 text-sm font-semibold outline-none"
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name} ·{' '}
                    {season.status === 'ACTIVE' ? 'Activa' : 'Cerrada'} ·{' '}
                    {season.gameCount} quinielas
                  </option>
                ))}
              </select>
            )}
            {current?.role === 'ADMIN' && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={newSeason}
                    onChange={(event) => setNewSeason(event.target.value)}
                    placeholder="Nueva temporada"
                    className="h-11 bg-white/[.03]"
                  />
                  <Button
                    variant="outline"
                    disabled={newSeason.trim().length < 3}
                    onClick={createSeason}
                  >
                    Crear
                  </Button>
                </div>
                {newSeason.trim().length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={newSeasonPrize}
                      onChange={(event) =>
                        setNewSeasonPrize(event.target.value)
                      }
                      placeholder="Premio de la nueva temporada"
                      maxLength={200}
                      className="h-10 bg-white/[.03]"
                    />
                    <Input
                      value={newSeasonPenalty}
                      onChange={(event) =>
                        setNewSeasonPenalty(event.target.value)
                      }
                      placeholder="Penitencia de la nueva temporada"
                      maxLength={200}
                      className="h-10 bg-white/[.03]"
                    />
                  </div>
                )}
              </div>
            )}
            {selectedSeasonId && (
              <div className="mt-4 grid gap-3 border-t border-white/[.06] pt-4 sm:grid-cols-2">
                {current?.role === 'ADMIN' ? (
                  <>
                    <label className="text-xs text-zinc-500">
                      Premio de la temporada
                      <Input
                        value={seasonPrize}
                        onChange={(event) => setSeasonPrize(event.target.value)}
                        placeholder="Ej. cena pagada por el último"
                        className="mt-1.5 h-10 bg-white/[.03]"
                      />
                    </label>
                    <label className="text-xs text-zinc-500">
                      Penitencia de la temporada
                      <Input
                        value={seasonPenalty}
                        onChange={(event) => setSeasonPenalty(event.target.value)}
                        placeholder="Ej. narrar la siguiente partida"
                        className="mt-1.5 h-10 bg-white/[.03]"
                      />
                    </label>
                    <Button
                      variant="outline"
                      onClick={saveSeasonRewards}
                      className="sm:col-span-2"
                    >
                      Guardar premio y penitencia
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-[#d9ae5f]/20 bg-[#d9ae5f]/5 p-4">
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#d9ae5f]">
                        <Trophy className="size-4" /> Premio
                      </p>
                      <p className="mt-2 text-sm text-zinc-200">
                        {seasonPrize || 'Todavía no se ha definido.'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-red-400/15 bg-red-400/5 p-4">
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-300">
                        <ScrollText className="size-4" /> Penitencia
                      </p>
                      <p className="mt-2 text-sm text-zinc-200">
                        {seasonPenalty || 'Todavía no se ha definido.'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="mt-5 rounded-2xl border bg-white/[.025] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[.18em] text-[#d9ae5f]">
                Clasificación de temporada
              </h2>
              <small className="text-zinc-600">Puntos acumulados</small>
            </div>
            <div className="mt-4 space-y-2">
              {standings.map((entry, index) => (
                <div
                  key={entry.userId}
                  className="flex items-center gap-3 rounded-lg border border-white/[.06] bg-black/10 px-3 py-2.5"
                >
                  <span className="display grid size-7 place-items-center rounded-full bg-white/5 font-bold">
                    {index + 1}
                  </span>
                  <b className="min-w-0 flex-1 truncate text-sm">
                    {entry.displayName}
                  </b>
                  <small className="text-zinc-500">
                    {entry.gamesPlayed} partidas
                  </small>
                  <strong className="text-[#d9ae5f]">{entry.points} pts</strong>
                </div>
              ))}
              {standings.length === 0 && (
                <p className="py-2 text-center text-sm text-zinc-600">
                  La clasificación aparecerá al finalizar la primera quiniela.
                </p>
              )}
            </div>
          </div>
          {current?.role === 'ADMIN' && (
            <div className="mt-5 rounded-2xl border border-[#d9ae5f]/25 bg-[#d9ae5f]/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <UserPlus className="size-4 text-[#d9ae5f]" /> Invitar
                    miembros
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {invite
                      ? 'Este código seguirá disponible cuando vuelvas.'
                      : 'Genera un código para que otras personas puedan unirse.'}
                  </p>
                </div>
                {invite && (
                  <button
                    onClick={makeInvite}
                    className="text-xs font-bold text-[#d9ae5f]"
                  >
                    Renovar
                  </button>
                )}
              </div>
              {invite ? (
                <code className="mt-3 flex h-12 items-center justify-center rounded-lg bg-black/25 px-3 text-xl font-bold tracking-[.25em] text-[#d9ae5f]">
                  {invite}
                </code>
              ) : (
                <Button
                  onClick={makeInvite}
                  className="mt-4 w-full bg-[#d9ae5f] font-bold text-[#17120a]"
                >
                  Generar código de invitación
                </Button>
              )}
            </div>
          )}
          <div className="mt-8 grid grid-cols-2 gap-3">
            {current?.role === 'ADMIN' && (
              <Button
                disabled={!activeSeason}
                onClick={() =>
                  activeSeason &&
                  createGame(current.id, current.name, activeSeason.id)
                }
                className="h-13 bg-[#d9ae5f] font-extrabold text-[#17120a]"
              >
                <Plus /> Crear quiniela
              </Button>
            )}
            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Código de organización"
                className="h-13 bg-white/[.03] uppercase"
              />
              <Button variant="outline" onClick={join}>
                Unirme
              </Button>
            </div>
          </div>
          <h2 className="mt-10 text-xs font-bold uppercase tracking-[.18em] text-zinc-500">
            Quinielas de la organización
          </h2>
          <div className="mt-4 space-y-3">
            {games
              .filter(
                (g) =>
                  g.organizationId === active &&
                  g.seasonId === selectedSeasonId,
              )
              .map((game) => (
                <div
                  key={game.id}
                  className="w-full rounded-2xl border bg-white/[.025] p-5 text-left"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#d9ae5f]">
                        {game.status === 'OPEN'
                          ? 'Abierta'
                          : game.status === 'LOCKED'
                            ? 'Cerrada'
                            : 'Finalizada'}
                      </span>
                      <h3 className="display mt-1 text-2xl font-bold">
                        {game.name}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {game.scriptName} · {game.playerCount} jugadores ·{' '}
                        {game.seasonName}
                      </p>
                    </div>
                    <span className="h-fit rounded-full bg-[#d9ae5f]/10 px-3 py-1 text-xs text-[#d9ae5f]">
                      {game.predictionCount} apuestas
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2 border-t border-white/[.06] pt-4">
                    {game.status === 'FINISHED' ? (
                      <Button
                        variant="outline"
                        onClick={() => results(game)}
                        className="flex-1"
                      >
                        Ver resultados
                      </Button>
                    ) : (
                      <>
                        {(game.status === 'OPEN' ||
                          game.status === 'LOCKED') && (
                          <Button
                            variant="outline"
                            onClick={() => joinGame(game)}
                            className="flex-1"
                          >
                            {game.status === 'OPEN'
                              ? 'Hacer o modificar mi apuesta'
                              : 'Ver mi apuesta'}
                          </Button>
                        )}
                        {current?.role === 'ADMIN' && (
                          <Button
                            onClick={() => manageGame(game)}
                            className="flex-1 bg-[#d9ae5f] font-bold text-[#17120a]"
                          >
                            {game.status === 'OPEN'
                              ? 'Gestionar y cerrar'
                              : 'Finalizar partida'}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            {games.filter(
              (g) =>
                g.organizationId === active && g.seasonId === selectedSeasonId,
            ).length === 0 && (
              <p className="rounded-xl border border-dashed p-5 text-center text-sm text-zinc-600">
                Todavía no hay quinielas.
              </p>
            )}
          </div>
          <div className="mt-8 flex gap-2">
            <Input
              value={newOrg}
              onChange={(e) => setNewOrg(e.target.value)}
              placeholder="Nueva organización"
              className="h-11 bg-white/[.03]"
            />
            <Button variant="outline" onClick={createOrg}>
              <Building2 className="size-4" /> Crear
            </Button>
          </div>
        </>
      )}
      {message && <p className="mt-4 text-sm text-[#d9ae5f]">{message}</p>}
    </section>
  );
}

function Welcome({
  onCreate,
  onJoin,
  onDemo,
}: {
  onCreate: () => void;
  onJoin: () => void;
  onDemo: () => void;
}) {
  return (
    <section className="mx-auto flex min-h-svh max-w-lg flex-col justify-between px-5 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[.16em]">
          <MoonStar className="size-4 text-[#d9ae5f]" /> QUINIELA CLOCKTOWER
        </div>
        <button
          onClick={onDemo}
          className="text-xs text-zinc-500 hover:text-[#d9ae5f]"
        >
          Ver resultados
        </button>
      </div>
      <div className="py-14 text-center">
        <div className="mx-auto mb-8 grid size-24 place-items-center rounded-full border border-[#d9ae5f]/30 bg-[#d9ae5f]/5 shadow-[0_0_80px_rgba(160,51,56,.24)]">
          <MoonStar className="size-11 text-[#d9ae5f]" />
        </div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[.25em] text-[#d9ae5f]">
          La noche guarda un secreto
        </p>
        <h1 className="display text-6xl font-bold leading-[.85] sm:text-7xl">
          Predice el
          <br />
          grimorio
        </h1>
        <p className="mx-auto mt-7 max-w-sm text-sm leading-6 text-zinc-400">
          Elige quién estará en juego antes de que empiece la partida. Nadie
          verá tu quiniela hasta el final.
        </p>
      </div>
      <div className="space-y-3">
        <Button
          onClick={onJoin}
          className="h-14 w-full bg-[#d9ae5f] text-base font-extrabold text-[#17120a] hover:bg-[#e5bd72]"
        >
          <Users className="mr-1" /> Entrar en una quiniela
        </Button>
        <Button
          onClick={onCreate}
          variant="outline"
          className="h-14 w-full border-white/10 bg-white/[.03] text-base hover:bg-white/[.07]"
        >
          <Plus className="mr-1" /> Crear una quiniela
        </Button>
        <p className="pt-3 text-center text-[11px] text-zinc-600">
          Hecho para las noches de los lunes
        </p>
      </div>
    </section>
  );
}

function roleDistribution(players: number) {
  const table: Record<number, [number, number, number, number]> = {
    5: [3, 0, 1, 1],
    6: [3, 1, 1, 1],
    7: [5, 0, 1, 1],
    8: [5, 1, 1, 1],
    9: [5, 2, 1, 1],
    10: [7, 0, 2, 1],
    11: [7, 1, 2, 1],
    12: [7, 2, 2, 1],
    13: [9, 0, 3, 1],
    14: [9, 1, 3, 1],
    15: [9, 2, 3, 1],
  };
  return table[Math.max(5, Math.min(15, players))] ?? [9, 2, 3, 1];
}
function Create(p: {
  name: string;
  setName: (v: string) => void;
  players: number;
  setPlayers: (v: number) => void;
  script: ImportedScript;
  error: string;
  creating: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  importFile: (f?: File) => void;
  create: () => void;
}) {
  const distribution = roleDistribution(p.players);
  return (
    <section className="mx-auto max-w-xl px-5 py-9">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d9ae5f]">
        BOTC Tryhard Terrassa
      </p>
      <h1 className="display mt-2 text-5xl font-bold">Nueva quiniela</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Importa el guion y define cuántas personas jugarán. Toda la organización
        podrá participar.
      </p>
      <div className="mt-9 space-y-6">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
            Nombre
          </span>
          <Input
            value={p.name}
            onChange={(e) => p.setName(e.target.value)}
            className="h-12 border-white/10 bg-white/[.03] px-4"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
            Jugadores
          </span>
          <Input
            type="number"
            min={5}
            max={15}
            value={p.players}
            onChange={(e) => p.setPlayers(Number(e.target.value))}
            className="h-12 border-white/10 bg-white/[.03] px-4"
          />
        </label>
        <div className="rounded-xl border bg-white/[.025] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Distribución base
            </p>
            <span className="text-[10px] text-zinc-600">
              Puede variar por setup
            </span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {groups.map((group, i) => (
              <div key={group.role} className="text-center">
                <b
                  className="display block text-2xl"
                  style={{ color: group.color }}
                >
                  {distribution[i]}
                </b>
                <small className="text-[9px] uppercase tracking-wide text-zinc-500">
                  {group.label}
                </small>
              </div>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
            Guion de Blood on the Clocktower
          </span>
          <input
            ref={p.fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => p.importFile(e.target.files?.[0])}
          />
          <button
            onClick={() => p.fileRef.current?.click()}
            className="flex w-full items-center gap-4 rounded-xl border border-dashed border-[#d9ae5f]/35 bg-[#d9ae5f]/5 p-4 text-left"
          >
            <span className="grid size-11 place-items-center rounded-lg bg-[#d9ae5f]/10 text-[#d9ae5f]">
              <FileJson />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm">{p.script.name}</b>
              <small className="text-zinc-500">
                {p.script.characters.length} personajes · Pulsa para cambiar
              </small>
            </span>
            <Check className="size-5 text-emerald-400" />
          </button>
          {p.error && <p className="mt-2 text-sm text-red-400">{p.error}</p>}
        </div>
        <Button
          disabled={
            p.creating || !p.name || !p.players || !p.script.characters.length
          }
          onClick={p.create}
          className="h-14 w-full bg-[#d9ae5f] text-base font-extrabold text-[#17120a] hover:bg-[#e5bd72]"
        >
          {p.creating ? 'Creando…' : 'Crear para la organización'}{' '}
          {!p.creating && <Sparkles className="ml-1" />}
        </Button>
      </div>
    </section>
  );
}

function Join(p: {
  name: string;
  setName: (v: string) => void;
  error: string;
  enter: () => void;
}) {
  return (
    <section className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-md flex-col justify-center px-5 py-10">
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full border border-[#d9ae5f]/30 bg-[#d9ae5f]/8">
          <MoonStar className="size-7 text-[#d9ae5f]" />
        </span>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.2em] text-[#d9ae5f]">
          Código RAVEN42
        </p>
        <h1 className="display mt-2 text-5xl font-bold">¿Cómo te llamas?</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Usaremos este nombre para la clasificación final.
        </p>
      </div>
      <Input
        autoFocus
        value={p.name}
        onChange={(e) => p.setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && p.enter()}
        placeholder="Tu nombre"
        className="mt-9 h-14 border-white/10 bg-white/[.04] px-4 text-center text-lg"
      />
      {p.error && (
        <p className="mt-2 text-center text-sm text-red-400">{p.error}</p>
      )}
      <Button
        onClick={p.enter}
        className="mt-4 h-14 bg-[#d9ae5f] text-base font-extrabold text-[#17120a] hover:bg-[#e5bd72]"
      >
        Entrar en la quiniela
      </Button>
      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-zinc-500">
        <LockKeyhole className="size-3.5" /> Tus elecciones serán secretas
      </div>
    </section>
  );
}

function Selector(p: {
  title: string;
  script: ImportedScript;
  playerCount: number;
  status: 'OPEN' | 'LOCKED' | 'FINISHED';
  selected: string[];
  setSelected: (s: string[]) => void;
  saved: boolean;
  save: () => void;
  mode: 'prediction' | 'actual';
}) {
  const counts = useMemo(
    () =>
      Object.fromEntries(
        groups.map((g) => [
          g.role,
          p.script.characters.filter(
            (c) => c.type === g.role && p.selected.includes(c.id),
          ).length,
        ]),
      ),
    [p.script, p.selected],
  );
  const setupLimits = getSetupLimits(p.playerCount, p.selected);
  const selectionLimitReached =
    p.mode === 'prediction' && p.selected.length >= p.playerCount;
  const toggle = (id: string) => {
    if (p.status !== 'OPEN') return;
    if (!p.selected.includes(id) && selectionLimitReached) return;
    const next = p.selected.includes(id)
      ? p.selected.filter((x) => x !== id)
      : [...p.selected, id];
    if (
      !validateSetupSelection({
        playerCount: p.playerCount,
        selectedIds: next,
        characters: p.script.characters,
      }).valid
    )
      return;
    p.setSelected(next);
  };
  return (
    <section className="pb-36">
      <div className="mx-auto max-w-5xl px-4 pt-8">
        <div className="mx-auto max-w-xl text-center">
          <StatePill status={p.status} />
          <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-[.2em] text-zinc-500">
            Lunes, 14 de septiembre
          </p>
          <h1 className="display text-4xl font-bold leading-none sm:text-5xl">
            {p.title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            {p.status === 'OPEN'
              ? 'Elige los personajes que crees que formarán parte de la partida. Puedes modificar y volver a guardar tu apuesta hasta el cierre.'
              : 'Esta es tu apuesta guardada. Ya no puede modificarse mientras la quiniela permanezca cerrada.'}
          </p>
          <div className="my-7 gold-line" />
          <div className="grid grid-cols-2 gap-3 text-left">
            <Stat label="Jugadores" value={String(p.playerCount)} />
            <Stat label="Guion" value={p.script.name} />
          </div>
        </div>
        <div className="mt-9 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[.16em] text-zinc-500">
              Tu predicción
            </p>
            <p className="display mt-1 text-2xl font-bold">
              Has elegido {p.selected.length} de {p.playerCount}
            </p>
            {selectionLimitReached && (
              <p className="mt-1 text-xs font-semibold text-[#d9ae5f]">
                Máximo alcanzado. Quita un personaje para elegir otro.
              </p>
            )}
          </div>
          <Sparkles className="mb-1 size-5 text-[#d9ae5f]" />
        </div>
        <Progress
          value={Math.min(p.selected.length / p.playerCount, 1)}
          className="mt-3 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-white/8 [&_[data-slot=progress-indicator]]:bg-[#d9ae5f]"
        />
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
          {groups.map((g) => (
            <span key={g.role}>
              <i
                className="mr-1.5 inline-block size-1.5 rounded-full"
                style={{ background: g.color }}
              />
              {g.label} <b className="text-zinc-200">{counts[g.role]}</b>
            </span>
          ))}
        </div>
        <div className="mt-7 rounded-2xl border border-[#d9ae5f]/20 bg-[#d9ae5f]/5 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#d9ae5f]">
                Guía para {p.playerCount} jugadores
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Distribución estándar. Los poderes pueden modificar el setup;
                los bonus se calcularán con los roles que realmente entren en
                juego.
              </p>
            </div>
            <ScrollText className="size-5 shrink-0 text-[#d9ae5f]" />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {groups.map((g, i) => {
              const current = Number(counts[g.role]);
              const target = setupLimits[g.role];
              return (
                <div
                  key={g.role}
                  className={`rounded-xl border p-2 text-center ${current === target ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-white/5 bg-black/10'}`}
                >
                  <b
                    className="display block text-2xl"
                    style={{ color: g.color }}
                  >
                    {current}
                    <span className="text-sm text-zinc-600">/{target}</span>
                  </b>
                  <small className="block truncate text-[9px] uppercase tracking-wide text-zinc-500">
                    {g.label}
                  </small>
                  {current === target && (
                    <Check className="mx-auto mt-1 size-3 text-emerald-400" />
                  )}
                </div>
              );
            })}
          </div>
          {p.selected.includes(LEGION_ID) && (
            <p className="mt-3 text-xs leading-5 text-[#d9ae5f]">
              Setup de Legion: se recomienda{' '}
              {getLegionDistribution(p.playerCount).legion} Legion y{' '}
              {getLegionDistribution(p.playerCount).good} personajes buenos,
              que pueden ser aldeanos o forasteros en cualquier combinación.
              No hay esbirros ni otros demonios.
            </p>
          )}
        </div>
        <CharacterGrid
          script={p.script}
          selected={p.selected}
          toggle={toggle}
          selectionLimitReached={
            selectionLimitReached || p.status !== 'OPEN'
          }
          disabledCharacterIds={new Set(
            p.script.characters
              .filter((character) => !p.selected.includes(character.id))
              .filter(
                (character) =>
                  !validateSetupSelection({
                    playerCount: p.playerCount,
                    selectedIds: [...p.selected, character.id],
                    characters: p.script.characters,
                  }).valid,
              )
              .map((character) => character.id),
          )}
        />
        {p.script.characters.some(
          (character) => character.id === VILLAGE_IDIOT_ID,
        ) && (
          <VillageIdiotCopies
            selected={p.selected}
            setSelected={p.setSelected}
            playerCount={p.playerCount}
            characters={p.script.characters}
            disabled={p.status !== 'OPEN'}
          />
        )}
        {p.script.characters.some(
          (character) => character.id === LEGION_ID,
        ) && (
          <LegionCopies
            selected={p.selected}
            setSelected={p.setSelected}
            playerCount={p.playerCount}
            characters={p.script.characters}
            disabled={p.status !== 'OPEN'}
          />
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/8 bg-[#100e14]/92 p-4 backdrop-blur-xl">
        <div className="mx-auto max-w-xl">
          {p.status !== 'OPEN' ? (
            <div className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#d9ae5f]/25 bg-[#d9ae5f]/10 px-3 text-center text-sm font-semibold text-[#d9ae5f]">
              <LockKeyhole className="size-4" /> Quiniela cerrada · vista en modo lectura
            </div>
          ) : p.saved ? (
            <div className="flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 text-center text-sm font-semibold text-emerald-300">
              <Check className="size-4" /> Quiniela guardada. Puedes modificarla
              hasta el cierre.
            </div>
          ) : (
            <Button
              onClick={p.save}
              className="h-12 w-full bg-[#d9ae5f] text-sm font-extrabold text-[#17120a] hover:bg-[#e5bd72]"
            >
              <LockKeyhole className="mr-1" /> Guardar mi quiniela
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function CharacterGrid({
  script,
  selected,
  toggle,
  selectionLimitReached = false,
  disabledCharacterIds = new Set<string>(),
}: {
  script: ImportedScript;
  selected: string[];
  toggle: (id: string) => void;
  selectionLimitReached?: boolean;
  disabledCharacterIds?: Set<string>;
}) {
  return (
    <div className="mt-10 space-y-10">
      {groups.map((group) => {
        const chars = script.characters.filter((c) => c.type === group.role);
        return chars.length ? (
          <section key={group.role}>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/8" />
              <h2
                className="text-[11px] font-extrabold uppercase tracking-[.22em]"
                style={{ color: group.color }}
              >
                {group.label}
              </h2>
              <span className="h-px flex-1 bg-white/8" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {chars.map((char) => (
                <CharacterCard
                  key={char.id}
                  char={char}
                  active={selected.includes(char.id)}
                  count={selected.filter((id) => id === char.id).length}
                  label={group.singular}
                  color={group.color}
                  toggle={toggle}
                  disabled={
                    !selected.includes(char.id) &&
                    (selectionLimitReached || disabledCharacterIds.has(char.id))
                  }
                />
              ))}
            </div>
          </section>
        ) : null;
      })}
    </div>
  );
}
function CharacterCard({
  char,
  active,
  count,
  label,
  color,
  toggle,
  disabled = false,
}: {
  char: ImportedCharacter;
  active: boolean;
  count: number;
  label: string;
  color: string;
  toggle: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <button
      data-selected={active}
      onClick={() => toggle(char.id)}
      disabled={disabled}
      className="character-card min-h-28 rounded-xl border bg-[#19161f] px-3 py-4 text-center disabled:cursor-not-allowed disabled:opacity-40"
      aria-pressed={active}
    >
      <span
        className="mx-auto mb-3 grid size-8 place-items-center rounded-full border"
        style={{
          borderColor: active ? '#d9ae5f' : '#36313d',
          color: active ? '#17120a' : color,
          background: active ? '#d9ae5f' : 'transparent',
        }}
      >
        {active ? (
          <Check className="size-4 stroke-[3]" />
        ) : (
          <MoonStar className="size-4" />
        )}
      </span>
      <strong className="display block text-lg leading-tight">
        {char.localizedName ?? char.name}
      </strong>
      {count > 1 && (
        <span className="mt-1 inline-block rounded-full bg-[#d9ae5f]/15 px-2 py-0.5 text-xs font-bold text-[#d9ae5f]">
          ×{count}
        </span>
      )}
      <small className="mt-1 block text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </small>
    </button>
  );
}

function VillageIdiotCopies({
  selected,
  setSelected,
  playerCount,
  characters,
  disabled = false,
}: {
  selected: string[];
  setSelected: (selected: string[]) => void;
  playerCount: number;
  characters: ImportedCharacter[];
  disabled?: boolean;
}) {
  const count = selected.filter((id) => id === VILLAGE_IDIOT_ID).length;
  if (count === 0) return null;
  const withAnother = [...selected, VILLAGE_IDIOT_ID];
  const canAdd =
    !disabled &&
    count < MAX_VILLAGE_IDIOTS &&
    validateSetupSelection({
      playerCount,
      selectedIds: withAnother,
      characters,
    }).valid;
  const removeOne = () => {
    const next = [...selected];
    next.splice(next.lastIndexOf(VILLAGE_IDIOT_ID), 1);
    setSelected(next);
  };
  return (
    <div className="mt-5 rounded-xl border border-[#5ba9d6]/25 bg-[#5ba9d6]/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#77aee7]">
            Regla especial · Village Idiot
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            Has elegido {count}. Puedes incluir hasta {MAX_VILLAGE_IDIOTS}.
          </p>
          {count > 1 && (
            <p className="mt-1 text-xs text-zinc-500">
              Una de las copias extra estará borracha.
            </p>
          )}
        </div>
        {!disabled && (
          <div className="flex gap-2">
            {count > 1 && (
              <Button type="button" variant="outline" onClick={removeOne}>
                − Quitar uno
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={!canAdd}
              onClick={() => setSelected(withAnother)}
            >
              + Añadir otro
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function LegionCopies({
  selected,
  setSelected,
  playerCount,
  characters,
  disabled = false,
}: {
  selected: string[];
  setSelected: (selected: string[]) => void;
  playerCount: number;
  characters: ImportedCharacter[];
  disabled?: boolean;
}) {
  const count = selected.filter((id) => id === LEGION_ID).length;
  if (count === 0) return null;
  const distribution = getLegionDistribution(playerCount);
  const withAnother = [...selected, LEGION_ID];
  const canAdd =
    !disabled &&
    count < distribution.legion &&
    validateSetupSelection({
      playerCount,
      selectedIds: withAnother,
      characters,
    }).valid;
  const removeOne = () => {
    const next = [...selected];
    next.splice(next.lastIndexOf(LEGION_ID), 1);
    setSelected(next);
  };
  return (
    <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-red-300">
            Regla especial · Legion
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            Has elegido {count}. Setup recomendado: {distribution.legion}{' '}
            Legion y {distribution.good} personajes buenos.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Los buenos pueden ser aldeanos o forasteros. No entran esbirros ni
            otros demonios.
          </p>
        </div>
        {!disabled && (
          <div className="flex gap-2">
            {count > 1 && (
              <Button type="button" variant="outline" onClick={removeOne}>
                − Quitar uno
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={!canAdd}
              onClick={() => setSelected(withAnother)}
            >
              + Añadir Legion
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Host(p: {
  gameId: string;
  name: string;
  players: number;
  status: 'OPEN' | 'LOCKED' | 'FINISHED';
  setStatus: (s: 'OPEN' | 'LOCKED' | 'FINISHED') => void;
  script: ImportedScript;
  actual: string[];
  setActual: (s: string[]) => void;
  finish: () => void;
}) {
  const [setup, setSetup] = useState(false);
  const [members, setMembers] = useState<
    {
      userId: string;
      displayName: string;
      username: string;
      hasPrediction: boolean;
      predictionUpdatedAt: number | null;
    }[]
  >([]);
  const [membersError, setMembersError] = useState('');
  const loadMembers = () => {
    if (!p.gameId) return;
    setMembersError('');
    apiFetch(`/api/games/manage?gameId=${encodeURIComponent(p.gameId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? 'No se ha podido cargar la participación.');
        setMembers(data.members ?? []);
      })
      .catch((reason) =>
        setMembersError(
          reason instanceof Error
            ? reason.message
            : 'No se ha podido cargar la participación.',
        ),
      );
  };
  useEffect(() => {
    loadMembers();
  }, [p.gameId, p.status]);
  const completedMembers = members.filter((member) => member.hasPrediction);
  const pendingMembers = members.filter((member) => !member.hasPrediction);
  if (setup)
    return (
      <section className="mx-auto max-w-5xl px-4 py-8">
        <StatePill status={p.status} />
        <h1 className="display mt-4 text-4xl font-bold">
          Introduce el setup real
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-400">
          Marca los personajes que realmente formaron parte del setup. Tú
          decides qué cuenta como “en juego”; esta selección es la que se usa
          para contemplar variaciones provocadas por poderes.
        </p>
        <p className="mt-3 text-sm font-semibold text-[#d9ae5f]">
          {p.actual.length} de {p.players} personajes
        </p>
        <CharacterGrid
          script={p.script}
          selected={p.actual}
          toggle={(id) => {
            if (p.actual.includes(id)) {
              const next = [...p.actual];
              next.splice(next.lastIndexOf(id), 1);
              p.setActual(next);
              return;
            }
            const next = [...p.actual, id];
            if (
              validateSetupSelection({
                playerCount: p.players,
                selectedIds: next,
                characters: p.script.characters,
                allowDuplicates: p.script.characters.some(
                  (character) => character.id === 'atheist',
                ),
              }).valid
            )
              p.setActual(next);
          }}
          selectionLimitReached={p.actual.length >= p.players}
        />
        {p.script.characters.some(
          (character) => character.id === VILLAGE_IDIOT_ID,
        ) &&
          !p.script.characters.some(
            (character) => character.id === 'atheist',
          ) && (
            <VillageIdiotCopies
              selected={p.actual}
              setSelected={p.setActual}
              playerCount={p.players}
              characters={p.script.characters}
            />
          )}
        {p.script.characters.some(
          (character) => character.id === LEGION_ID,
        ) && (
          <LegionCopies
            selected={p.actual}
            setSelected={p.setActual}
            playerCount={p.players}
            characters={p.script.characters}
          />
        )}
        {p.script.characters.some((character) => character.id === 'atheist') &&
          p.actual.length > 0 && (
            <div className="mt-6 rounded-xl border border-[#d9ae5f]/20 bg-[#d9ae5f]/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#d9ae5f]">
                Excepción del Ateo · duplicados permitidos
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...new Set(p.actual)].map((id) => {
                  const character = p.script.characters.find(
                    (candidate) => candidate.id === id,
                  );
                  const count = p.actual.filter((value) => value === id).length;
                  const duplicated = [...p.actual, id];
                  const canDuplicate = validateSetupSelection({
                    playerCount: p.players,
                    selectedIds: duplicated,
                    characters: p.script.characters,
                    allowDuplicates: true,
                  }).valid;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!canDuplicate}
                      onClick={() => p.setActual(duplicated)}
                      className="rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      {character?.localizedName ?? character?.name ?? id} ×{count}{' '}
                      <b className="text-[#d9ae5f]">+ duplicar</b>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        <Button
          onClick={p.finish}
          className="mt-10 h-14 w-full bg-[#d9ae5f] text-base font-extrabold text-[#17120a]"
        >
          Finalizar y mostrar resultados
        </Button>
      </section>
    );
  return (
    <section className="mx-auto max-w-xl px-5 py-9">
      <StatePill status={p.status} />
      <h1 className="display mt-5 text-5xl font-bold">{p.name}</h1>
      <p className="mt-2 text-sm text-zinc-400">
        {p.script.name} · {p.players} jugadores
      </p>
      <div className="mt-8 rounded-2xl border bg-white/[.025] p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-[#d9ae5f]/10 text-[#d9ae5f]">
            <Users />
          </span>
          <div>
            <p className="text-sm text-zinc-400">Quinielas recibidas</p>
            <p className="display text-3xl font-bold">
              {completedMembers.length}{' '}
              <span className="text-lg text-zinc-500">/ {members.length}</span>
            </p>
          </div>
        </div>
        <Progress
          value={members.length ? completedMembers.length / members.length : 0}
          className="mt-4 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-indicator]]:bg-[#d9ae5f]"
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <LockKeyhole className="size-3.5" /> Solo ves quién ha participado,
            no sus elecciones.
          </p>
          <button
            type="button"
            onClick={loadMembers}
            className="shrink-0 text-xs font-bold text-[#d9ae5f]"
          >
            Actualizar
          </button>
        </div>
        {membersError ? (
          <p className="mt-4 text-sm text-red-300">{membersError}</p>
        ) : (
          <div className="mt-5 grid gap-4 border-t border-white/[.06] pt-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Han apostado · {completedMembers.length}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {completedMembers.map((member) => (
                  <span
                    key={member.userId}
                    className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200"
                  >
                    ✓ {member.displayName}
                  </span>
                ))}
                {completedMembers.length === 0 && (
                  <span className="text-xs text-zinc-600">Todavía nadie.</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Pendientes · {pendingMembers.length}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pendingMembers.map((member) => (
                  <span
                    key={member.userId}
                    className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs text-amber-100"
                  >
                    ⏳ {member.displayName}
                  </span>
                ))}
                {pendingMembers.length === 0 && (
                  <span className="text-xs text-emerald-300">
                    Todo el mundo ha apostado.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-5 rounded-2xl border bg-[#f4efe4] p-6 text-center text-[#17120a]">
        <QRCodeSVG
          value="https://quiniela.example/q/RAVEN42"
          size={190}
          level="M"
          className="mx-auto"
        />
        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-zinc-500">
          Código de la partida
        </p>
        <p className="display mt-1 text-4xl font-bold tracking-[.12em]">
          RAVEN42
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-black/5 text-xs font-bold">
            <Clipboard className="size-4" /> Copiar enlace
          </button>
          <button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-black/5 text-xs font-bold">
            <Share2 className="size-4" /> Compartir
          </button>
        </div>
      </div>
      {p.status === 'OPEN' ? (
        <Button
          onClick={() => p.setStatus('LOCKED')}
          variant="outline"
          className="mt-6 h-14 w-full border-red-400/25 bg-red-400/5 text-red-300 hover:bg-red-400/10"
        >
          <LockKeyhole /> Cerrar quiniela
        </Button>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-[#d9ae5f]/20 bg-[#d9ae5f]/5 p-4 text-center text-sm text-[#d9ae5f]">
            🔒 Quiniela cerrada. ¡A jugar!
          </div>
          <Button
            onClick={() => p.setStatus('OPEN')}
            variant="outline"
            className="h-12 w-full"
          >
            Reabrir apuestas
          </Button>
          <Button
            onClick={() => setSetup(true)}
            className="h-14 w-full bg-[#d9ae5f] text-base font-extrabold text-[#17120a]"
          >
            Introducir resultado
          </Button>
        </div>
      )}
    </section>
  );
}

function Results({
  gameId,
  script,
  fallbackActual,
}: {
  gameId: string;
  script: ImportedScript;
  fallbackActual: string[];
}) {
  type RankingEntry = {
    userId: string;
    displayName: string;
    characterIds: string[];
    score: number;
    breakdown: {
      hits: number;
      townsfolkBonus: number;
      outsiderBonus: number;
      minionBonus: number;
      fullHouse15Bonus: number;
      total: number;
    };
  };
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [actual, setActual] = useState(fallbackActual);
  const [loading, setLoading] = useState(Boolean(gameId));
  const [resultsError, setResultsError] = useState('');
  const [revealUserId, setRevealUserId] = useState<string | null>(null);
  const reveal = ranking.find((entry) => entry.userId === revealUserId);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      setResultsError(
        'Selecciona una quiniela finalizada para ver sus resultados.',
      );
      return;
    }
    setLoading(true);
    setResultsError('');
    apiFetch(`/api/games/results?gameId=${encodeURIComponent(gameId)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error ?? 'No se han podido cargar los resultados.',
          );
        setActual(body.actualCharacterIds ?? []);
        setRanking(body.ranking ?? []);
      })
      .catch((reason) =>
        setResultsError(
          reason instanceof Error
            ? reason.message
            : 'No se han podido cargar los resultados.',
        ),
      )
      .finally(() => setLoading(false));
  }, [gameId]);

  return (
    <section className="mx-auto max-w-2xl px-5 py-9">
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#d9ae5f]/10 text-[#d9ae5f]">
          <Trophy className="size-8" />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[.23em] text-[#d9ae5f]">
          Partida finalizada
        </p>
        <h1 className="display mt-1 text-5xl font-bold">Clasificación</h1>
      </div>
      <div className="mt-8 space-y-2">
        {loading && (
          <p className="rounded-xl border bg-white/[.025] p-5 text-center text-sm text-zinc-400">
            Calculando la clasificación…
          </p>
        )}
        {!loading && resultsError && (
          <p className="rounded-xl border border-red-400/25 bg-red-400/5 p-5 text-center text-sm text-red-300">
            {resultsError}
          </p>
        )}
        {!loading && !resultsError && ranking.length === 0 && (
          <p className="rounded-xl border bg-white/[.025] p-5 text-center text-sm text-zinc-400">
            Nadie presentó una apuesta para esta quiniela.
          </p>
        )}
        {ranking.map((entry, i) => {
          return (
            <button
              key={entry.userId}
              onClick={() => setRevealUserId(entry.userId)}
              className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${i === 0 ? 'border-[#d9ae5f]/35 bg-[#d9ae5f]/8' : 'bg-white/[.025]'}`}
            >
              <span
                className={`display grid size-10 shrink-0 place-items-center rounded-full text-xl font-bold ${i === 0 ? 'bg-[#d9ae5f] text-[#17120a]' : 'bg-white/5'}`}
              >
                {i === 0 ? <Crown className="size-5" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate">{entry.displayName}</b>
                <small className="mt-1 block text-zinc-500">
                  Ver personajes acertados y fallados
                </small>
              </span>
              <span className="display shrink-0 text-xl font-bold">
                {entry.score}{' '}
                <small className="block font-sans text-[10px] font-normal text-zinc-500">
                  puntos
                </small>
              </span>
            </button>
          );
        })}
      </div>
      <h2 className="mt-12 text-xs font-extrabold uppercase tracking-[.2em] text-[#d9ae5f]">
        Setup de la partida
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {script.characters
          .filter((c) => actual.includes(c.id))
          .map((c) => {
            const appearance = getRoleAppearance(c.type);
            return (
              <div
                key={c.id}
                className={`rounded-lg border p-3 ${appearance.card}`}
              >
                <span className="block text-sm font-semibold">
                  {c.localizedName ?? c.name}
                </span>
                <small
                  className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${appearance.badge}`}
                >
                  {appearance.label}
                </small>
              </div>
            );
          })}
      </div>
      {reveal && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5"
          onClick={() => setRevealUserId(null)}
        >
          <div
            className="max-h-[85svh] w-full max-w-lg overflow-auto rounded-t-3xl border bg-[#19161f] p-6 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[#d9ae5f]">
                  Reveal
                </p>
                <h2 className="display text-3xl font-bold">
                  Quiniela de {reveal.displayName}
                </h2>
              </div>
              <button
                onClick={() => setRevealUserId(null)}
                className="grid size-9 place-items-center rounded-full bg-white/5"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-400" /> Acertado
              </span>
              <span className="flex items-center gap-1.5">
                <X className="size-4 text-red-400" /> Apostado, no estaba
              </span>
              <span className="flex items-center gap-1.5">
                <X className="size-4 text-amber-300" /> Estaba, no predicho
              </span>
            </div>
            <div className="mt-6 space-y-2">
              {script.characters
                .filter(
                  (c) =>
                    reveal.characterIds.includes(c.id) || actual.includes(c.id),
                )
                .map((c) => {
                  const guessed = reveal.characterIds.includes(c.id),
                    was = actual.includes(c.id);
                  const appearance = getRoleAppearance(c.type);
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${appearance.card}`}
                    >
                      <span
                        aria-label={guessed && was ? 'Acertado' : 'Fallado'}
                        className={`grid size-9 shrink-0 place-items-center rounded-full border-2 text-xl font-black ${guessed && was ? 'border-emerald-300 bg-emerald-400/25 text-emerald-200' : guessed ? 'border-red-300 bg-red-400/25 text-red-200' : 'border-amber-200 bg-amber-300/25 text-amber-100'}`}
                      >
                        <span aria-hidden="true">
                          {guessed && was ? '✓' : '✕'}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {c.localizedName ?? c.name}
                        </span>
                        <small
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${appearance.badge}`}
                        >
                          {appearance.label}
                        </small>
                      </span>
                      <small
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                          guessed && was
                            ? 'bg-emerald-400/20 text-emerald-200'
                            : guessed
                              ? 'bg-red-400/20 text-red-200'
                              : 'bg-amber-300/20 text-amber-100'
                        }`}
                      >
                        {guessed && was
                          ? '✓ Acertado'
                          : guessed
                            ? '✕ Fallo'
                            : '✕ No predicho'}
                      </small>
                    </div>
                  );
                })}
            </div>
            <p className="display mt-6 text-center text-2xl font-bold">
              {reveal.score} puntos · {reveal.breakdown.hits} / {actual.length}{' '}
              aciertos
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-[10px] font-bold uppercase tracking-wide">
              {reveal.breakdown.townsfolkBonus > 0 && (
                <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-emerald-300">
                  Todos los aldeanos +2
                </span>
              )}
              {reveal.breakdown.outsiderBonus > 0 && (
                <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-emerald-300">
                  Todos los forasteros +1
                </span>
              )}
              {reveal.breakdown.minionBonus > 0 && (
                <span className="rounded-full bg-red-400/10 px-2.5 py-1 text-red-300">
                  Todos los esbirros +1
                </span>
              )}
              {reveal.breakdown.fullHouse15Bonus > 0 && (
                <span className="rounded-full bg-[#d9ae5f]/15 px-2.5 py-1 text-[#d9ae5f]">
                  Pleno al 15 +3
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StatePill({ status }: { status: 'OPEN' | 'LOCKED' | 'FINISHED' }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#d9ae5f]/25 bg-[#d9ae5f]/8 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.18em] text-[#d9ae5f]">
      <span
        className={`size-1.5 rounded-full bg-[#d9ae5f] ${status === 'OPEN' ? 'animate-pulse' : ''}`}
      />
      {status === 'OPEN'
        ? 'Quiniela abierta'
        : status === 'LOCKED'
          ? 'Quiniela cerrada'
          : 'Partida finalizada'}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-white/[.025] p-3">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
