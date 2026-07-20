'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '@/components/admin/AdminShell';
import { Badge, Card, CenteredSpinner, EmptyState } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Heart, MessageSquare, Star, RefreshCw, User, Mail, Phone, Calendar } from 'lucide-react';
import { api } from '@/lib/api';

interface FeedbackItem {
  _id: string;
  guestName: string;
  email?: string;
  phone: string;
  roomNumber?: string;
  category: 'ROOM' | 'FOOD' | 'VALET' | 'GENERAL';
  rating: number;
  comment: string;
  createdAt: string;
}

interface CategoryStat {
  _id: string;
  avgRating: number;
  count: number;
}

interface FeedbackStats {
  categories: CategoryStat[];
  overall: {
    avgRating: number;
    count: number;
  };
}

export default function AdminFeedbackPage() {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  // Fetch feedbacks list
  const { data: feedbackData, isLoading, refetch } = useQuery<{
    data: {
      feedback: FeedbackItem[];
      analytics: FeedbackStats;
    };
  }>({
    queryKey: ['admin-feedbacks', categoryFilter, ratingFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (categoryFilter) p.set('category', categoryFilter);
      if (ratingFilter) p.set('rating', ratingFilter);
      return api.get(`/feedback?${p.toString()}`).then(r => r.data);
    },
  });

  const list = feedbackData?.data?.feedback ?? [];
  const analytics = feedbackData?.data?.analytics;

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4.5 w-4.5 ${
              star <= rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-200'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <AdminShell>
      <div className="space-y-6 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <Heart className="h-6 w-6 text-red-500 fill-red-500" /> Guest Reviews & Feedback
            </h1>
            <p className="text-xs text-zinc-500 mt-1">Review guest feedback, stay quality audits, and dining reviews</p>
          </div>
          <Button onClick={() => void refetch()} variant="outline" size="sm" className="self-start">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        {isLoading ? (
          <CenteredSpinner label="Loading feedback records..." />
        ) : (
          <>
            {/* Analytics Dashboard Header */}
            {analytics && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Overall Rating card */}
                <Card className="p-4 md:col-span-1 border-t-2 border-t-brand flex flex-col justify-between text-center">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Overall Rating</span>
                  <div className="my-2">
                    <span className="text-3xl font-extrabold text-zinc-800">
                      {analytics.overall.avgRating ? analytics.overall.avgRating.toFixed(1) : '0.0'}
                    </span>
                    <span className="text-sm text-zinc-400">/5</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">Based on {analytics.overall.count} reviews</span>
                </Card>

                {/* Categories breakups */}
                {['GENERAL', 'ROOM', 'FOOD', 'VALET'].map((cat) => {
                  const catStat = analytics.categories.find(c => c._id === cat);
                  const avg = catStat?.avgRating ?? 0;
                  const count = catStat?.count ?? 0;

                  return (
                    <Card key={cat} className="p-4 flex flex-col justify-between border-t-2 border-t-zinc-200">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">{cat} Rating</span>
                      <div className="my-2 flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-zinc-800">
                          {avg ? avg.toFixed(1) : '—'}
                        </span>
                        <div className="text-xs text-zinc-400">{count} reviews</div>
                      </div>
                      <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-brand h-full rounded-full transition-all duration-500"
                          style={{ width: `${avg ? (avg / 5) * 100 : 0}%` }}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border rounded-lg text-xs font-semibold px-3 py-2 bg-white text-zinc-700 focus:outline-none"
              >
                <option value="">All Categories</option>
                <option value="GENERAL">General Services</option>
                <option value="ROOM">Room Stay</option>
                <option value="FOOD">Dining / Restaurant</option>
                <option value="VALET">Valet Parking</option>
              </select>

              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="border rounded-lg text-xs font-semibold px-3 py-2 bg-white text-zinc-700 focus:outline-none"
              >
                <option value="">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>

            {list.length === 0 ? (
              <EmptyState
                title="No feedback found"
                description="Guests have not submitted any reviews matching these parameters."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {list.map((item) => (
                  <Card key={item._id} className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center border-b pb-2">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-bold uppercase tracking-wider">
                          <span>{item.category}</span>
                          {item.roomNumber && (
                            <>
                              <span>·</span>
                              <span>Room {item.roomNumber}</span>
                            </>
                          )}
                        </div>
                        {renderStars(item.rating)}
                      </div>

                      <p className="text-xs text-zinc-700 italic font-medium p-3 bg-zinc-50 rounded-lg border">
                        &quot;{item.comment}&quot;
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-zinc-700 flex items-center gap-1">
                          <User className="h-3 w-3 text-zinc-400" /> {item.guestName}
                        </p>
                        <p className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-zinc-400" /> {item.phone}
                        </p>
                      </div>
                      <div className="flex flex-col items-end justify-end">
                        <p className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-zinc-400" />
                          {new Date(item.createdAt).toLocaleDateString('en-IN')}
                        </p>
                        {item.email && (
                          <p className="flex items-center gap-1 truncate max-w-full">
                            <Mail className="h-3 w-3 text-zinc-400" /> {item.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
