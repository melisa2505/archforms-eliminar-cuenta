const $ = id => document.getElementById(id);
let config;
let session = null;
let busy = false;
let deletionStarted = false;
let refreshToken = null;
let expiresAt = 0;

function message(error) {
 const text = typeof error?.message === 'string' ? error.message : 'No se pudo completar la operación.';
 if (/invalid.login|invalid.credentials/i.test(text)) return 'El correo o la contraseña no son correctos.';
 if (/email.not.confirmed/i.test(text)) return 'Confirma tu correo de ArchForms antes de iniciar sesión.';
 if (/Failed to fetch|NetworkError|Load failed|timeout|aborted/i.test(text)) return 'No se pudo conectar. Revisa tu conexión y vuelve a intentarlo.';
 if (/token.*expired|JWT.*expired|refresh.token/i.test(text)) return 'La sesión venció. Vuelve a verificar tu cuenta para continuar.';
 return text;
}
function showError(error) {
 $('error').textContent = `${deletionStarted ? 'El borrado no se completó. Reintenta para continuarlo. ' : ''}${message(error)}`;
 $('error').hidden = false;
}
function setBusy(value) {
 busy = value;
 for (const element of document.querySelectorAll('input, form button')) element.disabled = value;
 $('delete-button').disabled = value || $('confirmation').value !== 'ELIMINAR';
 $('cancel-button').textContent = deletionStarted ? 'Cerrar sesión' : 'Cancelar';
}
function acceptSession(data) {
 if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string' || !data.user?.id) throw new Error('El servicio no devolvió una sesión válida.');
 session = {token: data.access_token, user: data.user};
 refreshToken = data.refresh_token;
 expiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
}
async function request(path, {method = 'POST', body, authenticated = true} = {}) {
 if (authenticated && !session) throw new Error('Verifica tu cuenta antes de continuar.');
 const headers = {'apikey': config.publishableKey, 'Content-Type': 'application/json'};
 if (authenticated) headers.Authorization = `Bearer ${session.token}`;
 const response = await fetch(`${config.url}${path}`, {method, headers, ...(body === undefined ? {} : {body: JSON.stringify(body)}), credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(45000)});
 const text = await response.text();
 let data;
 try { data = text ? JSON.parse(text) : null; } catch { throw new Error('El servicio devolvió una respuesta no válida.'); }
 if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `Error del servicio (${response.status}).`);
 return data;
}
async function ensureSession() {
 if (!session) throw new Error('Verifica tu cuenta antes de continuar.');
 if (Date.now() >= expiresAt - 60000) acceptSession(await request('/auth/v1/token?grant_type=refresh_token', {authenticated: false, body: {refresh_token: refreshToken}}));
}
async function clearSession() {
 const previous = session;
 session = null; refreshToken = null; expiresAt = 0;
 $('password').value = ''; $('confirmation').value = ''; $('account-email').textContent = '';
 if (previous) {
  try { await fetch(`${config.url}/auth/v1/logout?scope=local`, {method: 'POST', headers: {apikey: config.publishableKey, Authorization: `Bearer ${previous.token}`}, credentials: 'omit', signal: AbortSignal.timeout(10000)}); } catch { /* Tokens are already discarded locally; no persistent browser session. */ }
 }
}
$('login-form').addEventListener('submit', async event => {
 event.preventDefault();
 if (busy) return;
 $('error').hidden = true;
 if (!$('login-form').reportValidity()) return;
 setBusy(true); $('progress').textContent = 'Verificando tu cuenta…';
 try {
  const password = $('password').value;
  $('password').value = '';
  acceptSession(await request('/auth/v1/token?grant_type=password', {authenticated: false, body: {email: $('email').value.trim(), password}}));
  $('account-email').textContent = session.user.email;
  $('login-form').hidden = true; $('verified').hidden = false;
  $('progress').textContent = ''; $('confirmation').focus();
 } catch (error) { $('progress').textContent = ''; showError(error); }
 finally { setBusy(false); if (session) $('confirmation').focus(); }
});
$('confirmation').addEventListener('input', () => { $('delete-button').disabled = busy || $('confirmation').value !== 'ELIMINAR'; });
$('cancel-button').addEventListener('click', async () => {
 if (busy) return;
 setBusy(true); await clearSession();
 $('verified').hidden = true; $('login-form').hidden = false;
 $('progress').textContent = deletionStarted ? 'El borrado iniciado debe completarse. Vuelve a verificar tu cuenta o solicita ayuda por correo.' : '';
 $('error').hidden = true; setBusy(false); $('email').focus();
});
$('delete-form').addEventListener('submit', async event => {
 event.preventDefault();
 if (busy || !session || $('confirmation').value !== 'ELIMINAR') return;
 setBusy(true); $('error').hidden = true;
 try {
  deletionStarted = true;
  while (true) {
   await ensureSession(); $('progress').textContent = 'Eliminando los archivos de tu cuenta…';
   const files = await request('/rest/v1/rpc/begin_account_deletion_v1', {body: {confirmation: 'ELIMINAR'}});
   if (!Array.isArray(files)) throw new Error('La lista de archivos no es válida.');
   if (!files.length) break;
   const buckets = new Map();
   for (const file of files) {
    if (!file || typeof file.bucket !== 'string' || typeof file.path !== 'string') throw new Error('Una referencia de archivo no es válida.');
    buckets.set(file.bucket, [...(buckets.get(file.bucket) || []), file.path]);
   }
   for (const [bucket, paths] of buckets) {
    await ensureSession();
    await request(`/storage/v1/object/${encodeURIComponent(bucket)}`, {method: 'DELETE', body: {prefixes: paths}});
   }
  }
  await ensureSession(); $('progress').textContent = 'Eliminando la cuenta y sus datos asociados…';
  await request('/rest/v1/rpc/delete_my_account_v1', {body: {confirmation: 'ELIMINAR'}});
  await clearSession();
  $('verified').hidden = true; $('login-form').hidden = true; $('progress').textContent = '';
  $('security-note').hidden = true; $('success').hidden = false;
  $('success').setAttribute('tabindex', '-1'); $('success').focus();
 } catch (error) { $('progress').textContent = ''; showError(error); }
 finally { setBusy(false); }
});

try {
 const response = await fetch('config.json', {cache: 'no-store', credentials: 'omit'});
 if (!response.ok) throw new Error('No se pudo cargar la conexión con ArchForms. Puedes solicitar el borrado por correo.');
 config = await response.json();
 const endpoint = new URL(config.url);
 if (!/^sb_publishable_/.test(config.publishableKey) || endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.supabase.co')) throw new Error('La configuración del servicio no es válida.');
 config.url = endpoint.origin;
 $('online-flow').hidden = false;
} catch (error) {
 $('online-flow').hidden = false; $('login-form').hidden = true;
 showError(error);
}
