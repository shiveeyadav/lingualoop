// Browser fetch helper for JSON POSTs to our API.
export async function postJson(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(data || {}),
  });
  let json = {};
  try {
    json = await res.json();
  } catch (_) {
    json = {};
  }
  if (!res.ok) {
    const err = new Error(json.error || 'Request failed (' + res.status + ')');
    err.status = res.status;
    throw err;
  }
  return json;
}
