import client from './client';

export interface FrappeUser {
  name: string;
  full_name: string;
  email: string;
  user_image: string | null;
  roles: string[];
}

export async function login(usr: string, pwd: string): Promise<void> {
  const res = await client.post('/api/method/login', { usr, pwd });
  if (res.data.message !== 'Logged In') {
    throw new Error('Login failed');
  }
}

export async function logout(): Promise<void> {
  await client.get('/api/method/logout');
}

export async function getCurrentUser(): Promise<FrappeUser> {
  const sessionRes = await client.get('/api/method/frappe.realtime.get_user_info');
  const username = sessionRes.data.message?.user;
  if (!username || username === 'Guest') throw new Error('Not logged in');

  // Fetch full User doc — roles child table is included automatically
  const userRes = await client.get(`/api/resource/User/${encodeURIComponent(username)}`);
  const doc = userRes.data.data;

  // roles child table: [{role: "System Manager"}, ...]
  const roles: string[] = (doc.roles || []).map((r: { role: string }) => r.role);

  return {
    name: doc.name,
    full_name: doc.full_name,
    email: doc.email,
    user_image: doc.user_image || null,
    roles,
  };
}
