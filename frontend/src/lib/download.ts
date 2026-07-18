import { api } from './api';

/**
 * Download a binary response from an authenticated API endpoint. We can't use a
 * plain `<a href>` because the request needs the Bearer token, so we fetch the
 * blob via axios and trigger a client-side save.
 */
export async function downloadAuthed(path: string, filename: string): Promise<void> {
  const res = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
