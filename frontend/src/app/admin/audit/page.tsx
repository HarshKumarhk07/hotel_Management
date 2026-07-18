'use client';

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, Card, CenteredSpinner, EmptyState } from '@/components/ui/primitives';
import { api } from '@/lib/api';

interface AuditEntry {
  _id: string;
  action: string;
  actorEmail?: string;
  role?: string;
  ip?: string;
  browser?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

function AuditInner() {
  const [action, setAction] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', action, actorEmail, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (action) params.set('action', action);
      if (actorEmail) params.set('actorEmail', actorEmail);
      const res = await api.get<{ data: { logs: AuditEntry[] }; meta: { totalPages: number; total: number } }>(
        `/audit?${params}`,
      );
      return res.data;
    },
  });

  const logs = data?.data.logs ?? [];
  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900">Audit log</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Filter by action (e.g. LOGIN_SUCCESS)"
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.target.value.toUpperCase());
          }}
        />
        <Input
          className="max-w-xs"
          placeholder="Filter by actor email"
          value={actorEmail}
          onChange={(e) => {
            setPage(1);
            setActorEmail(e.target.value);
          }}
        />
      </div>

      {isLoading ? (
        <CenteredSpinner />
      ) : logs.length === 0 ? (
        <EmptyState title="No entries" description="No audit entries match these filters." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Actor</th>
                <th className="px-4 py-2">IP</th>
                <th className="px-4 py-2">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((l) => (
                <tr key={l._id}>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-zinc-500">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-800">{l.action}</td>
                  <td className="px-4 py-2 text-zinc-600">{l.actorEmail ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">{l.ip ?? '—'}</td>
                  <td className="px-4 py-2">
                    <Badge className={l.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {l.success ? 'OK' : 'Fail'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Page {page} of {totalPages} · {data?.meta.total ?? 0} entries
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAuditPage() {
  return (
    <AdminShell>
      <AuditInner />
    </AdminShell>
  );
}
