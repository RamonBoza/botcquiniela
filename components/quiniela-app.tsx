'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Building2,
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
import {
  BotcJsonScriptImporter,
  troubleBrewing,
  type ImportedCharacter,
  type ImportedScript,
} from '@/lib/botc-script-importer';

type View =
  | 'auth'
  | 'dashboard'
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
const scores = [
  ['Marta', 11],
  ['Ramón', 10],
  ['Pere', 9],
  ['Alex', 7],
] as const;

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
  const [org, setOrg] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [gameId, setGameId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setPerson(data.user.displayName);
          setView('dashboard');
        }
      })
      .catch(() => undefined);
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
        view === 'results'
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
          onDone={(displayName) => {
            setPerson(displayName);
            setView('dashboard');
          }}
        />
      )}
      {view === 'dashboard' && (
        <LiveOrganizationDashboard
          selectOrganization={(id, orgName) => {
            setOrganizationId(id);
            setOrg(orgName);
          }}
          createGame={(id, orgName) => {
            setOrganizationId(id);
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
            fetch(`/api/games/prediction?gameId=${game.id}`)
              .then((r) => r.json())
              .then((data) => setSelected(data.characterIds ?? []));
            setView('play');
          }}
          results={() => setView('results')}
        />
      )}
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
          fileRef={fileRef}
          importFile={importFile}
          create={async () => {
            const response = await fetch('/api/games', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                organizationId,
                name,
                script,
                playerCount: players,
              }),
            });
            const data = await response.json();
            if (!response.ok) {
              setError(data.error ?? 'No se ha podido crear la quiniela.');
              return;
            }
            setGameId(data.game.id);
            setStatus('OPEN');
            setView('host');
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
          selected={selected}
          setSelected={setSelected}
          saved={saved}
          save={async () => {
            const response = await fetch('/api/games/prediction', {
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
          name={`${name} · ${org}`}
          players={players}
          status={status}
          setStatus={async (next) => {
            if (next === 'LOCKED') {
              const response = await fetch('/api/games/manage', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ gameId, action: 'lock' }),
              });
              if (response.ok) setStatus('LOCKED');
            }
          }}
          script={script}
          actual={actual}
          setActual={setActual}
          finish={async () => {
            const response = await fetch('/api/games/manage', {
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
        <Results script={script} actual={actual} selected={selected} />
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
                : 'QUINIELA'}
        </div>
        <span className="size-10" />
      </div>
    </header>
  );
}

function AccountAccess({ onDone }: { onDone: (name: string) => void }) {
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
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: register ? 'register' : 'login',
          displayName: name,
          username,
          password,
        }),
      });
      const data = await response
        .json()
        .catch(() => ({ error: 'El servicio no ha podido completar la solicitud.' }));
      if (!response.ok) {
        setMessage(data.error ?? 'No se ha podido iniciar la sesión.');
        return;
      }
      onDone(data.user.displayName);
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
  scriptName: string;
  charactersJson: string;
  playerCount: number;
  status: 'OPEN' | 'LOCKED' | 'FINISHED';
  predictionCount: number;
};
function LiveOrganizationDashboard({
  selectOrganization,
  createGame,
  joinGame,
  results,
}: {
  selectOrganization: (id: string, name: string) => void;
  createGame: (id: string, name: string) => void;
  joinGame: (game: LiveGame) => void;
  results: () => void;
}) {
  const [organizations, setOrganizations] = useState<LiveOrganization[]>([]);
  const [games, setGames] = useState<LiveGame[]>([]);
  const [active, setActive] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [invite, setInvite] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    const [orgResponse, gameResponse] = await Promise.all([
      fetch('/api/organizations'),
      fetch('/api/games'),
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
  const createOrg = async () => {
    const response = await fetch('/api/organizations', {
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
    const response = await fetch('/api/organizations/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: active }),
    });
    const data = await response.json();
    if (response.ok) setInvite(data.code);
    else setMessage(data.error);
  };
  const join = async () => {
    const response = await fetch('/api/organizations/join', {
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
  return (
    <section className="mx-auto max-w-2xl px-5 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[.15em]">
          <MoonStar className="size-4 text-[#d9ae5f]" /> QUINIELA CLOCKTOWER
        </div>
        <button
          onClick={() =>
            fetch('/api/auth', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ action: 'logout' }),
            }).then(() => location.reload())
          }
          className="text-xs text-zinc-500"
        >
          Cerrar sesión
        </button>
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
            {current?.role === 'ADMIN' && (
              <button
                onClick={makeInvite}
                className="grid size-11 shrink-0 place-items-center rounded-xl border bg-white/[.03] text-[#d9ae5f]"
                aria-label="Crear invitación"
              >
                <UserPlus />
              </button>
            )}
          </div>
          {invite && (
            <div className="mt-5 rounded-2xl border border-[#d9ae5f]/25 bg-[#d9ae5f]/5 p-5">
              <p className="text-sm font-bold">Código de invitación</p>
              <code className="mt-3 flex h-11 items-center rounded-lg bg-black/25 px-3 text-lg tracking-widest text-[#d9ae5f]">
                {invite}
              </code>
            </div>
          )}
          <div className="mt-8 grid grid-cols-2 gap-3">
            {current?.role === 'ADMIN' && (
              <Button
                onClick={() => createGame(current.id, current.name)}
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
              .filter((g) => g.organizationId === active)
              .map((game) => (
                <button
                  key={game.id}
                  onClick={() =>
                    game.status === 'FINISHED' ? results() : joinGame(game)
                  }
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
                        {game.scriptName} · {game.playerCount} jugadores
                      </p>
                    </div>
                    <span className="h-fit rounded-full bg-[#d9ae5f]/10 px-3 py-1 text-xs text-[#d9ae5f]">
                      {game.predictionCount} apuestas
                    </span>
                  </div>
                </button>
              ))}
            {games.filter((g) => g.organizationId === active).length === 0 && (
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
          disabled={!p.name || !p.players || !p.script.characters.length}
          onClick={p.create}
          className="h-14 w-full bg-[#d9ae5f] text-base font-extrabold text-[#17120a] hover:bg-[#e5bd72]"
        >
          Crear para la organización <Sparkles className="ml-1" />
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
  const standard = roleDistribution(p.playerCount);
  const toggle = (id: string) =>
    p.setSelected(
      p.selected.includes(id)
        ? p.selected.filter((x) => x !== id)
        : [...p.selected, id],
    );
  return (
    <section className="pb-36">
      <div className="mx-auto max-w-5xl px-4 pt-8">
        <div className="mx-auto max-w-xl text-center">
          <StatePill status="OPEN" />
          <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-[.2em] text-zinc-500">
            Lunes, 14 de septiembre
          </p>
          <h1 className="display text-4xl font-bold leading-none sm:text-5xl">
            {p.title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Elige los personajes que crees que formarán parte de la partida. Tu
            selección será secreta hasta el final.
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
                Distribución estándar. Algunos personajes pueden modificarla.
              </p>
            </div>
            <ScrollText className="size-5 shrink-0 text-[#d9ae5f]" />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {groups.map((g, i) => {
              const current = Number(counts[g.role]);
              const target = standard[i];
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
        </div>
        <CharacterGrid
          script={p.script}
          selected={p.selected}
          toggle={toggle}
        />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/8 bg-[#100e14]/92 p-4 backdrop-blur-xl">
        <div className="mx-auto max-w-xl">
          {p.saved ? (
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
}: {
  script: ImportedScript;
  selected: string[];
  toggle: (id: string) => void;
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
                  label={group.singular}
                  color={group.color}
                  toggle={toggle}
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
  label,
  color,
  toggle,
}: {
  char: ImportedCharacter;
  active: boolean;
  label: string;
  color: string;
  toggle: (id: string) => void;
}) {
  return (
    <button
      data-selected={active}
      onClick={() => toggle(char.id)}
      className="character-card min-h-28 rounded-xl border bg-[#19161f] px-3 py-4 text-center"
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
      <small className="mt-1 block text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </small>
    </button>
  );
}

function Host(p: {
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
  if (setup)
    return (
      <section className="mx-auto max-w-5xl px-4 py-8">
        <StatePill status={p.status} />
        <h1 className="display mt-4 text-4xl font-bold">
          Introduce el setup real
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-400">
          Marca los personajes que realmente formaron parte del setup. Tú
          decides qué cuenta como “en juego”.
        </p>
        <CharacterGrid
          script={p.script}
          selected={p.actual}
          toggle={(id) =>
            p.setActual(
              p.actual.includes(id)
                ? p.actual.filter((x) => x !== id)
                : [...p.actual, id],
            )
          }
        />
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
              11 <span className="text-lg text-zinc-500">/ {p.players}</span>
            </p>
          </div>
        </div>
        <Progress
          value={11 / p.players}
          className="mt-4 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-indicator]]:bg-[#d9ae5f]"
        />
        <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
          <LockKeyhole className="size-3.5" /> Las elecciones permanecen ocultas
          para todos.
        </p>
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
  script,
  actual,
  selected,
}: {
  script: ImportedScript;
  actual: string[];
  selected: string[];
}) {
  const [reveal, setReveal] = useState<string | null>(null);
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
        {scores.map(([player, score], i) => (
          <button
            key={player}
            onClick={() => setReveal(player)}
            className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left ${i === 0 ? 'border-[#d9ae5f]/35 bg-[#d9ae5f]/8' : 'bg-white/[.025]'}`}
          >
            <span
              className={`display grid size-10 place-items-center rounded-full text-xl font-bold ${i === 0 ? 'bg-[#d9ae5f] text-[#17120a]' : 'bg-white/5'}`}
            >
              {i === 0 ? <Crown className="size-5" /> : i + 1}
            </span>
            <b className="flex-1">{player}</b>
            <span className="display text-xl font-bold">
              {score}{' '}
              <small className="font-sans text-xs font-normal text-zinc-500">
                puntos
              </small>
            </span>
          </button>
        ))}
      </div>
      <h2 className="mt-12 text-xs font-extrabold uppercase tracking-[.2em] text-[#d9ae5f]">
        Setup de la partida
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {script.characters
          .filter((c) => actual.includes(c.id))
          .map((c) => (
            <div
              key={c.id}
              className="rounded-lg border bg-white/[.025] p-3 text-sm font-semibold"
            >
              {c.localizedName ?? c.name}
            </div>
          ))}
      </div>
      {reveal && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5"
          onClick={() => setReveal(null)}
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
                  Quiniela de {reveal}
                </h2>
              </div>
              <button
                onClick={() => setReveal(null)}
                className="grid size-9 place-items-center rounded-full bg-white/5"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-6 space-y-2">
              {script.characters
                .filter((c) => selected.includes(c.id) || actual.includes(c.id))
                .map((c) => {
                  const guessed = selected.includes(c.id),
                    was = actual.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded-lg border bg-white/[.025] p-3"
                    >
                      <span
                        className={`grid size-6 place-items-center rounded-full ${guessed && was ? 'bg-emerald-400/15 text-emerald-400' : guessed ? 'bg-red-400/15 text-red-400' : 'bg-blue-400/15 text-blue-300'}`}
                      >
                        {guessed && was ? (
                          <Check className="size-3.5" />
                        ) : guessed ? (
                          <X className="size-3.5" />
                        ) : (
                          <span>•</span>
                        )}
                      </span>
                      <span className="flex-1 text-sm font-semibold">
                        {c.localizedName ?? c.name}
                      </span>
                      <small className="text-zinc-500">
                        {guessed && was
                          ? 'Acertado'
                          : guessed
                            ? 'No estaba'
                            : 'No predicho'}
                      </small>
                    </div>
                  );
                })}
            </div>
            <p className="display mt-6 text-center text-2xl font-bold">
              {selected.filter((id) => actual.includes(id)).length} /{' '}
              {actual.length} aciertos
            </p>
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
