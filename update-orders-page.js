const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/src/app/(customer)/orders/page.tsx');
let content = fs.readFileSync(file, 'utf8');

// Add useQueryClient import
content = content.replace("import { useQuery } from '@tanstack/react-query';", "import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';");

// Add useEffect import
content = content.replace("import { useState } from 'react';", "import { useState, useEffect } from 'react';");

// Add Request Service button
const bannerButtonsOld = `<Button
              onClick={() => router.push('/rooms')}
              className="flex-1 md:flex-none border border-[#D4AF37]/45 text-[#D4AF37] bg-transparent hover:bg-[#D4AF37]/10 text-xs px-5 py-5 rounded-xl uppercase tracking-wider font-extrabold"
            >
              Book Room
            </Button>
            <Button
              onClick={() => router.push('/restaurant/waitlist')}
              className="flex-1 md:flex-none bg-[#D4AF37] hover:bg-[#AE963C] text-zinc-950 text-xs px-5 py-5 rounded-xl uppercase tracking-wider font-extrabold border border-transparent"
            >
              Reserve Table
            </Button>`;
const bannerButtonsNew = `<Button
              onClick={() => router.push('/rooms')}
              className="flex-1 md:flex-none border border-[#D4AF37]/45 text-[#D4AF37] bg-transparent hover:bg-[#D4AF37]/10 text-xs px-5 py-5 rounded-xl uppercase tracking-wider font-extrabold"
            >
              Book Room
            </Button>
            <Button
              onClick={() => router.push('/restaurant/waitlist')}
              className="flex-1 md:flex-none bg-[#D4AF37] hover:bg-[#AE963C] text-zinc-950 text-xs px-5 py-5 rounded-xl uppercase tracking-wider font-extrabold border border-transparent"
            >
              Reserve Table
            </Button>
            <Button
              onClick={() => {
                setActiveTab('tickets');
                setIsTicketModalOpen(true);
              }}
              className="flex-1 md:flex-none bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 text-xs px-5 py-5 rounded-xl uppercase tracking-wider font-extrabold hidden md:flex"
            >
              Request Service
            </Button>`;
content = content.replace(bannerButtonsOld, bannerButtonsNew);

// Add cancel state and auto-fill logic inside DashboardInner
const stateOld = `const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);`;
const stateNew = `const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [bookingToCancel, setBookingToCancel] = useState<CustomerBooking | null>(null);

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(\`/rooms/bookings/\${id}/cancel\`, { reason: cancelReason });
    },
    onSuccess: () => {
      toast.success('Booking cancelled successfully');
      setIsCancelModalOpen(false);
      setBookingToCancel(null);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['my-room-bookings', user?.email] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to cancel booking');
    },
  });`;
content = content.replace(stateOld, stateNew);

// Update useForm to include setValue and add useEffect for auto-select
const useFormOld = `const { register: registerTicket, handleSubmit: handleTicketSubmit, formState: { errors: ticketErrors, isSubmitting: isSubmittingTicket }, reset: resetTicket } = useForm<z.infer<typeof ticketSchema>>({`;
const useFormNew = `const { register: registerTicket, handleSubmit: handleTicketSubmit, formState: { errors: ticketErrors, isSubmitting: isSubmittingTicket }, reset: resetTicket, setValue: setTicketValue } = useForm<z.infer<typeof ticketSchema>>({`;
content = content.replace(useFormOld, useFormNew);

const submitFnOld = `const onTicketSubmit = async (data: z.infer<typeof ticketSchema>) => {`;
const submitFnNew = `useEffect(() => {
    if (bookings) {
      const activeBookings = bookings.filter((b: any) => ['CONFIRMED', 'CHECKED_IN'].includes(b.status));
      if (activeBookings.length === 1) {
        setTicketValue('roomId', activeBookings[0].room._id);
      }
    }
  }, [bookings, setTicketValue]);

  const onTicketSubmit = async (data: z.infer<typeof ticketSchema>) => {`;
content = content.replace(submitFnOld, submitFnNew);

// Add inline Cancel button
const manageStayOld = `<button
                          onClick={() => router.push(\`/rooms/confirm/\${b._id}\`)}
                          className="text-xs font-bold text-[#D4AF37] hover:text-[#AE963C] flex items-center gap-0.5 transition-colors"
                        >
                          Manage stay <ChevronRight className="h-4 w-4" />
                        </button>`;
const manageStayNew = `{['PENDING', 'CONFIRMED'].includes(b.status) && (
                          <button
                            onClick={() => {
                              setBookingToCancel(b);
                              setIsCancelModalOpen(true);
                            }}
                            className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase tracking-wider underline mr-2"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={() => router.push(\`/rooms/confirm/\${b._id}\`)}
                          className="text-xs font-bold text-[#D4AF37] hover:text-[#AE963C] flex items-center gap-0.5 transition-colors"
                        >
                          Manage stay <ChevronRight className="h-4 w-4" />
                        </button>`;
content = content.replace(manageStayOld, manageStayNew);

// Append Cancel Dialog
const footerOld = `</Dialog>
    </div>`;
const footerNew = `</Dialog>
      <Dialog open={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Booking">
        <div className="space-y-4 font-sans">
          <p className="text-sm text-zinc-600">
            Are you sure you want to cancel your booking for Room {bookingToCancel?.room?.roomNumber}?
            {bookingToCancel?.paymentStatus === 'PAID' && ' A refund will be initiated according to our cancellation policy.'}
          </p>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Reason (Optional)</label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why are you cancelling?"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-zinc-900"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>
              Keep Booking
            </Button>
            <Button 
              variant="default" 
              className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              onClick={() => { if(bookingToCancel) cancelMutation.mutate(bookingToCancel._id); }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>`;
content = content.replace(footerOld, footerNew);

fs.writeFileSync(file, content, 'utf8');
console.log('Orders page updated successfully');
