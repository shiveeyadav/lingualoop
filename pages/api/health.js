import { query } from '../../lib/db';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await query('SELECT 1');
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(503).json({ ok: false });
  }
}
