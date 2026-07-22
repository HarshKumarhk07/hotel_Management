'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';

export function ContactForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setSubmitted(true);
    }, 1500);
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
          <Input placeholder="John" required />
        </Field>
        <Field label="Last Name">
          <Input placeholder="Doe" required />
        </Field>
      </div>
      <Field label="Email Address">
        <Input type="email" placeholder="john@example.com" required />
      </Field>
      <Field label="Subject">
        <Input placeholder="Reservation Inquiry" required />
      </Field>
      <Field label="Message">
        <textarea 
          rows={4}
          required
          placeholder="How can we help you?"
          className="w-full text-sm rounded-xl border border-zinc-200 p-3 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
        ></textarea>
      </Field>
      <Button 
        type="submit" 
        isLoading={isLoading}
        className="w-full bg-[#D4AF37] hover:bg-[#AE963C] text-white font-bold uppercase tracking-widest py-4 rounded-xl mt-4"
      >
        Submit Message
      </Button>
    </form>
  );
}
