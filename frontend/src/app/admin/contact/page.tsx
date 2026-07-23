'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, MailOpen, Trash2, Calendar, Phone, User, CheckCircle2 } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Card, CenteredSpinner, Badge } from '@/components/ui/primitives';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

interface ContactMessage {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function AdminContactPage() {
  const qc = useQueryClient();

  const { data: messagesData, isLoading } = useQuery<{ data: { messages: ContactMessage[] } }>({
    queryKey: ['admin-contact-messages'],
    queryFn: () => api.get('/contact').then(r => r.data),
  });

  const messages = messagesData?.data?.messages || [];

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/contact/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-contact-messages'] });
      toast.success('Message marked as read');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contact/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-contact-messages'] });
      toast.success('Message deleted successfully');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 font-sans">Contact Messages</h1>
          <p className="text-sm text-zinc-500 mt-0.5 font-sans">View and manage inquiries sent by guests from the Contact Us page.</p>
        </div>

        {isLoading ? (
          <CenteredSpinner />
        ) : messages.length === 0 ? (
          <Card className="py-24 text-center border-dashed border-zinc-200">
            <Mail className="mx-auto h-12 w-12 text-zinc-300 mb-4" />
            <h3 className="text-zinc-700 font-serif font-bold text-lg">No Messages Found</h3>
            <p className="text-xs text-zinc-400 mt-1">There are currently no contact messages to display.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {messages.map((msg) => (
              <Card key={msg._id} className={`p-5 flex flex-col justify-between transition-shadow hover:shadow-md ${!msg.isRead ? 'border-brand/30 bg-brand/5' : 'bg-white'}`}>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-zinc-900 text-sm">{msg.name}</h3>
                        {!msg.isRead && (
                          <span className="flex h-2 w-2 rounded-full bg-brand" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 font-medium">{msg.subject}</p>
                    </div>
                    <Badge className={msg.isRead ? 'bg-zinc-100 text-zinc-500' : 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20'}>
                      {msg.isRead ? 'Read' : 'New'}
                    </Badge>
                  </div>

                  <div className="text-xs text-zinc-600 space-y-1.5 font-sans">
                    <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-zinc-400" /> {msg.email}</p>
                    {msg.phone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-zinc-400" /> {msg.phone}</p>}
                    <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-zinc-400" /> {new Date(msg.createdAt).toLocaleString()}</p>
                  </div>

                  <div className="bg-white/50 p-3 rounded-lg border border-zinc-100/50 text-xs text-zinc-700 leading-relaxed font-sans max-h-32 overflow-y-auto">
                    {msg.message}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-100 flex gap-2">
                  {!msg.isRead && (
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
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className={`font-sans text-xs flex-1 ${msg.isRead ? 'w-full' : ''} text-red-600 hover:bg-red-50 border-red-200`}
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
      </div>
    </AdminShell>
  );
}
