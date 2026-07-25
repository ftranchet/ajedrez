// Conexión con Lichess (RF-1.4): el token personal que habilita jugar contra
// los bots Maia.
//
// El token se guarda **solo en este dispositivo** y queda fuera de la
// exportación (ver `ui/lichessToken.ts`). La tarjeta lo dice de forma explícita
// en vez de dejarlo a la confianza: el usuario está pegando una credencial de
// su cuenta en una app local-first, y merece saber a dónde va.
import { useEffect, useState } from 'react';
import { LichessError, lichessClient } from '../../services/lichess/lichessClient';
import { clearLichessToken, readLichessToken, writeLichessToken } from '../lichessToken';
import { SectionHeading } from './SectionHeading';
import { t } from '../i18n/es';

const URL_TOKEN =
  'https://lichess.org/account/oauth/token/create?scopes[]=challenge:write&scopes[]=board:play&description=ELOmax';

type Estado = 'sin-token' | 'verificando' | 'conectado' | 'invalido';

export function LichessCard() {
  const [token, setToken] = useState('');
  // El estado inicial ya refleja si hay token guardado, así que el efecto no
  // necesita fijarlo de nuevo: solo resuelve la verificación.
  const [estado, setEstado] = useState<Estado>(() => (readLichessToken() ? 'verificando' : 'sin-token'));
  const [usuario, setUsuario] = useState('');

  // Al abrir Ajustes se revalida el token guardado: uno revocado en Lichess
  // seguiría figurando como conectado hasta el primer desafío fallido.
  useEffect(() => {
    const guardado = readLichessToken();
    if (!guardado) return;
    let alive = true;
    void lichessClient
      .cuenta(guardado)
      .then(({ username }) => {
        if (!alive) return;
        setUsuario(username);
        setEstado('conectado');
      })
      .catch(() => {
        if (alive) setEstado('invalido');
      });
    return () => {
      alive = false;
    };
  }, []);

  async function conectar() {
    const limpio = token.trim();
    if (limpio === '') return;
    setEstado('verificando');
    try {
      const { username } = await lichessClient.cuenta(limpio);
      writeLichessToken(limpio);
      setUsuario(username);
      setToken('');
      setEstado('conectado');
    } catch (error) {
      setEstado('invalido');
      if (error instanceof LichessError && error.motivo === 'sin-conexion') setUsuario('');
    }
  }

  function desconectar() {
    clearLichessToken();
    setUsuario('');
    setEstado('sin-token');
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-4">
      <div>
        <SectionHeading>{t.ajustes.lichessTitulo}</SectionHeading>
        <p className="m-0 mt-1 text-sm text-secondary">{t.ajustes.lichessTexto}</p>
      </div>

      <p className="m-0 rounded-md border border-info/35 bg-info-subtle p-3 text-xs text-secondary">
        {t.ajustes.lichessPrivacidad}
      </p>

      {estado === 'conectado' ? (
        <>
          <p className="m-0 text-sm text-success">{t.ajustes.lichessConectado.replace('{usuario}', usuario)}</p>
          <button onClick={desconectar} className="btn-secondary">
            {t.ajustes.lichessDesconectar}
          </button>
        </>
      ) : (
        <>
          <a
            href={URL_TOKEN}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
          >
            {t.ajustes.lichessEnlace}
          </a>
          <label className="flex flex-col gap-1 text-sm text-secondary">
            {t.ajustes.lichessLabel}
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoComplete="off"
              className="min-h-11 rounded-lg border border-subtle bg-surface px-3 py-2 font-mono text-primary"
            />
          </label>
          {estado === 'invalido' && (
            <p role="alert" className="m-0 text-xs text-error-text">{t.ajustes.lichessInvalido}</p>
          )}
          <button
            onClick={() => void conectar()}
            disabled={token.trim() === '' || estado === 'verificando'}
            className="btn-secondary"
          >
            {estado === 'verificando' ? t.ajustes.lichessVerificando : t.ajustes.lichessGuardar}
          </button>
        </>
      )}
    </section>
  );
}
