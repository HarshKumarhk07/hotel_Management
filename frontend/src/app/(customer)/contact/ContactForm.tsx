'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    subject: '',
    message: ''
  });

  const mutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/contact', {
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      subject: data.subject,
      message: data.message
    }),
    onSuccess: () => {
      setSubmitted(true);
      setFormData({ firstName: '', lastName: '', email: '', subject: '', message: '' });
    },
    onError: (e) => {
      toast.error(apiErrorMessage(e, 'Failed to send message. Please try again.'));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (submitted) {
    return (
      <div className="text-center p-8 bg-green-50 rounded-xl border border-green-200">
        <h3 className="text-green-800 font-bold text-xl mb-2">Message Sent!</h3>
        <p className="text-green-700">Thank you for reaching out. We will get back to you shortly.</p>
        <Button 
          className="mt-6 bg-[#D4AF37] hover:bg-[#AE963C] text-white"
          onClick={() => setSubmitted(false)}
        >
          Send Another Message
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First Name">
          <Input name="firstName" value={formData.firstName} onChange={handleChange} placeholder="John" required />
        </Field>
        <Field label="Last Name">
          <Input name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Doe" required />
        </Field>
      </div>
      <Field label="Email Address">
        <Input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="john@example.com" required />
      </Field>
      <Field label="Subject">
        <Input name="subject" value={formData.subject} onChange={handleChange} placeholder="Reservation Inquiry" required />
      </Field>
      <Field label="Message">
        <textarea
          name="message"
          rows={4}
          required
          minLength={10}
          value={formData.message}
          onChange={handleChange}
          placeholder="How can we help you? (at least 10 characters)"
          className="w-full text-sm rounded-xl border border-zinc-200 p-3 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
        ></textarea>
      </Field>
      <Button 
        type="submit" 
        isLoading={mutation.isPending}
        disabled={mutation.isPending}
        className="w-full bg-[#D4AF37] hover:bg-[#AE963C] text-white font-bold uppercase tracking-widest py-4 rounded-xl mt-4"
      >
        Submit Message
      </Button>
    </form>
  );
}
