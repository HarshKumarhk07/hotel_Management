'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Mail,
  Trash2,
  Calendar,
  Phone,
  CheckCircle2,
  CheckCheck,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CenteredSpinner, Badge } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

type ContactStatus = 'UNREAD' | 'READ' | 'RESOLVED';

interface ContactMessage {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  isRead: boolean;
  status: ContactStatus;
  resolvedAt?: string;
  createdAt: string;
}

interface ContactListResponse {
  data: { messages: ContactMessage[]; unreadCount: number };
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

const STATUS_FILTERS: { value: '' | ContactStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'UNREAD', label: 'Unread' },
  { value: 'READ', label: 'Read' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const STATUS_BADGE: Record<ContactStatus, string> = {
  UNREAD: 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20',
  READ: 'bg-blue-50 text-blue-700 border-blue-200',
  RESOLVED: 'bg-green-50 text-green-700 border-green-200',
};

const PAGE_SIZE = 12;

export default function AdminContactPage() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | ContactStatus>('');
  const [page, setPage] = useState(1);

  const { data: res, isLoading, isFetching } = useQuery<ContactListResponse>({
    queryKey: ['admin-contact-messages', search, status, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) p.set('search', search);
      if (status) p.set('status', status);
      return api.get(`/contact?${p.toString()}`).then((r) => r.data);
    },
    // Keeps the current page visible while the next one loads, so paging and
    // typing in the search box don't flash an empty list.
    placeholderData: keepPreviousData,
  });

  const messages = res?.data?.messages ?? [];
  const unreadCount = res?.data?.unreadCount ?? 0;
  const meta = res?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const total = meta?.total ?? messages.length;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-contact-messages'] });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/contact/${id}/read`),
    onSuccess: () => {
      invalidate();
      toast.success('Message marked as read');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ContactStatus }) =>
      api.patch(`/contact/${id}/status`, { status: next }),
    onSuccess: (_d, vars) => {
      invalidate();
      toast.success(vars.next === 'RESOLVED' ? 'Message marked as resolved' : 'Message reopened');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contact/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Message deleted successfully');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 font-sans">Contact Messages</h1>
            <p className="text-sm text-zinc-500 mt-0.5 font-sans">
              Enquiries sent by guests from the Contact Us page, newest first.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20">
              {unreadCount} unread
            </Badge>
            <Badge className="bg-zinc-100 text-zinc-600">{total} total</Badge>
          </div>
        </div>

        {/* Search + status filter */}
        <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <form onSubmit={applySearch} className="flex gap-2 flex-1 max-w-md">
            <Input
              placeholder="Search name, email, phone, subject or message…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <Button type="submit" size="sm" className="shrink-0">
              <Search className="h-4 w-4" />
            </Button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value || 'all'}
                onClick={() => {
                  setStatus(f.value);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  status === f.value
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Card>

        {isLoading ? (
          <CenteredSpinner />
        ) : messages.length === 0 ? (
          <Card className="py-24 text-center border-dashed border-zinc-200">
            <Mail className="mx-auto h-12 w-12 text-zinc-300 mb-4" />
            <h3 className="text-zinc-700 font-serif font-bold text-lg">No Messages Found</h3>
            <p className="text-xs text-zinc-400 mt-1">
              {search || status
                ? 'No contact messages match the current search or filter.'
                : 'There are currently no contact messages to display.'}
            </p>
          </Card>
        ) : (
          <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${isFetching ? 'opacity-60' : ''}`}>
            {messages.map((msg) => (
              <Card
                key={msg._id}
                className={`p-5 flex flex-col justify-between transition-shadow hover:shadow-md ${
                  msg.status === 'UNREAD' ? 'border-brand/30 bg-brand/5' : 'bg-white'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-zinc-900 text-sm">{msg.name}</h3>
                        {msg.status === 'UNREAD' && <span className="flex h-2 w-2 rounded-full bg-brand" />}
                      </div>
                      <p className="text-xs text-zinc-500 font-medium">{msg.subject}</p>
                    </div>
                    <Badge className={STATUS_BADGE[msg.status] ?? 'bg-zinc-100 text-zinc-500'}>
                      {msg.status === 'UNREAD' ? 'New' : msg.status === 'READ' ? 'Read' : 'Resolved'}
                    </Badge>
                  </div>

                  <div className="text-xs text-zinc-600 space-y-1.5 font-sans">
                    <p className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-zinc-400" /> {msg.email}
                    </p>
                    {msg.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-zinc-400" /> {msg.phone}
                      </p>
                    )}
                    <p className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-zinc-400" />{' '}
                      {new Date(msg.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-white/50 p-3 rounded-lg border border-zinc-100/50 text-xs text-zinc-700 leading-relaxed font-sans max-h-32 overflow-y-auto">
                    {msg.message}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap gap-2">
                  {msg.status === 'UNREAD' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 font-sans text-xs border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#FAF8F0]"
                      onClick={() => markAsReadMutation.mutate(msg._id)}
                      disabled={markAsReadMutation.isPending}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark Read
                    </Button>
                  )}
                  {msg.status !== 'RESOLVED' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 font-sans text-xs border-green-200 text-green-700 hover:bg-green-50"
                      onClick={() => setStatusMutation.mutate({ id: msg._id, next: 'RESOLVED' })}
                      disabled={setStatusMutation.isPending}
                    >
                      <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Resolve
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 font-sans text-xs"
                      onClick={() => setStatusMutation.mutate({ id: msg._id, next: 'READ' })}
                      disabled={setStatusMutation.isPending}
                    >
                      Reopen
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-sans text-xs flex-1 text-red-600 hover:bg-red-50 border-red-200"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this message?')) {
                        deleteMessageMutation.mutate(msg._id);
                      }
                    }}
                    disabled={deleteMessageMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
            <p className="text-xs text-zinc-500">
              Page {meta?.page ?? page} of {totalPages} · {total} message{total === 1 ? '' : 's'}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isFetching}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isFetching}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
