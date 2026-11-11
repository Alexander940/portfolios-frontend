/**
 * Verificación ejecutable del estado «cuenta pendiente de activación» del
 * login (#34).
 *
 *     npx vite-node tests/checks/login-34-not-activated.ts
 *
 * El backend crea los usuarios con `is_active=false` y responde 401 con el
 * detail «Account is not activated. Please contact an administrator.» al
 * intentar entrar. Antes de #34 ese detail llegaba crudo al mismo cuadro
 * rojo que «credenciales incorrectas». Lo que se protege:
 *
 *   - `transformAxiosError` de ese 401 devuelve el mensaje constante
 *     ACCOUNT_NOT_ACTIVATED (no el detail crudo);
 *   - `isAccountNotActivatedError` lo reconoce, y rechaza el mensaje de
 *     credenciales incorrectas, un detail cualquiera, `null` y `undefined`;
 *   - el 401 de credenciales sigue mapeando a «Incorrect email or password.»
 *     (regresión).
 */
import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '../../src/types';
import {
  isAccountNotActivatedError,
  transformAxiosError,
} from '../../src/lib/apiErrors';

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`ok   ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function fake401(detail: string): AxiosError<ApiErrorResponse> {
  return {
    isAxiosError: true,
    name: 'AxiosError',
    message: 'Request failed with status code 401',
    response: { status: 401, data: { detail } },
  } as unknown as AxiosError<ApiErrorResponse>;
}

const pending = transformAxiosError(
  fake401('Account is not activated. Please contact an administrator.')
);
check(
  '401 not-activated → mensaje constante, no el detail crudo',
  pending.message !== 'Account is not activated. Please contact an administrator.' &&
    pending.message.toLowerCase().includes("isn't activated"),
  pending.message
);
check('401 not-activated → isAccountNotActivatedError = true', isAccountNotActivatedError(pending.message));
check('status 401 conservado', pending.status === 401);

const creds = transformAxiosError(fake401('Incorrect email or password'));
check(
  '401 credenciales → «Incorrect email or password.» (regresión)',
  creds.message === 'Incorrect email or password.',
  creds.message
);
check('401 credenciales → isAccountNotActivatedError = false', !isAccountNotActivatedError(creds.message));

check('detail arbitrario → false', !isAccountNotActivatedError('Something else went wrong'));
check('null → false', !isAccountNotActivatedError(null));
check('undefined → false', !isAccountNotActivatedError(undefined));

if (failures > 0) {
  console.log(`\n${failures} check(s) en rojo`);
  process.exit(1);
}
console.log('\nTODO VERDE');
