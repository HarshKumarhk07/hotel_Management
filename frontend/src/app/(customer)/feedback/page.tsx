'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heart, Star, Send, CheckCircle2, ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { Field, Input, FieldError } from '@/components/ui/input';
import { api, apiErrorMessage } from '@/lib/api';
import { SiteFooter } from '@/components/site/SiteFooter';

const feedbackSchema = z.object({
  guestName: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().trim().min(10, 'Phone must be at least 10 digits'),
  roomNumber: z.string().trim().optional(),
  category: z.enum(['ROOM', 'FOOD', 'VALET', 'GENERAL']),
  rating: z.number().min(1).max(5),
  comment: z.string().trim().min(5, 'Feedback comment must be at least 5 characters').max(1000),
});

type FeedbackForm = z.infer<typeof feedbackSchema>;

// Inner component — uses useSearchParams, must be inside <Suspense>
function FeedbackForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillRoom = searchParams.get('room') || '';

  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FeedbackForm>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      category: 'GENERAL',
      rating: 5,
      roomNumber: prefillRoom,
    },
  });

  // Load guest details if authenticated
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data?.data?.user) {
          setValue('guestName', res.data.data.user.name);
          setValue('phone', res.data.data.user.phone || '');
          if (res.data.data.user.email) {
            setValue('email', res.data.data.user.email);
          }
        }
      } catch {
        // Degrade gracefully
      }
    };
    fetchMe();
  }, [setValue]);

  // Sync state rating with form value
  useEffect(() => {
    setValue('rating', selectedRating);
  }, [selectedRating, setValue]);

  const feedbackMutation = useMutation({
    mutationFn: (data: FeedbackForm) => api.post('/feedback', data),
    onSuccess: () => {
      setSuccess(true);
      reset();
    },
    onError: (err) => {
      setError(apiErrorMessage(err, 'Could not submit feedback.'));
    },
  });

  const onSubmit = (values: FeedbackForm) => {
    setError(null);
    feedbackMutation.mutate(values);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans">
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors text-xs font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>

        <div className="text-center mb-8 space-y-2">
          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight flex items-center justify-center gap-2">
            <Heart className="h-6 w-6 text-red-500 fill-red-500" /> Share Your Experience
          </h1>
          <p className="text-zinc-500 text-sm">Help us improve our hospitality and services</p>
        </div>

        <Card className="p-6 md:p-8">
          {success ? (
            <div className="text-center py-8 space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-zinc-900">Thank You!</h3>
                <p className="text-zinc-500 text-sm max-w-md mx-auto">
                  Your feedback has been submitted successfully. We appreciate you taking the time to share your review.
                </p>
              </div>
              <div className="pt-4">
                <Button onClick={() => router.push('/')} variant="outline" size="sm">
                  Back to Home
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Guest Name" error={errors.guestName?.message}>
                  <Input placeholder="John Doe" {...register('guestName')} />
                </Field>

                <Field label="Mobile Number" error={errors.phone?.message}>
                  <Input placeholder="9876543210" {...register('phone')} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Email Address (Optional)" error={errors.email?.message}>
                  <Input placeholder="john@example.com" {...register('email')} />
                </Field>

                <Field label="Room Number (Optional)" error={errors.roomNumber?.message}>
                  <Input placeholder="101" {...register('roomNumber')} />
                </Field>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Feedback Category</label>
                <select
                  {...register('category')}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                >
                  <option value="GENERAL">General Services</option>
                  <option value="ROOM">Room Stay &amp; Housekeeping</option>
                  <option value="FOOD">Dining &amp; Restaurant</option>
                  <option value="VALET">Valet Parking</option>
                </select>
              </div>

              {/* Star Rating Selector */}
              <div className="flex flex-col items-center justify-center gap-2 py-4 border-y border-zinc-100">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Your Rating</span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSelectedRating(star)}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(null)}
                      className="p-1 focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-8 w-8 transition-colors ${
                          star <= (hoveredStar ?? selectedRating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-zinc-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-semibold text-zinc-500">
                  {selectedRating === 5 && 'Excellent!'}
                  {selectedRating === 4 && 'Good'}
                  {selectedRating === 3 && 'Average'}
                  {selectedRating === 2 && 'Poor'}
                  {selectedRating === 1 && 'Terrible'}
                </span>
              </div>

              <Field label="Comments" error={errors.comment?.message}>
                <textarea
                  rows={4}
                  placeholder="Share details of your experience..."
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                  {...register('comment')}
                />
              </Field>

              <Button type="submit" className="w-full" disabled={feedbackMutation.isPending}>
                {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
                <Send className="ml-2 h-4 w-4" />
              </Button>
            </form>
          )}
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}

// Default export wraps the inner component in Suspense (required for useSearchParams)
export default function GuestFeedbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 flex items-center justify-center text-zinc-400 text-sm">Loading...</div>}>
      <FeedbackForm />
    </Suspense>
  );
}
