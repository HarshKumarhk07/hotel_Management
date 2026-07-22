import { SiteFooter } from '@/components/site/SiteFooter';
import { Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { ContactForm } from './ContactForm';

export const metadata = {
  title: 'Contact Us | The Page Hotel',
  description: 'Get in touch with The Page Hotel. We are here to assist you with your reservations and inquiries.',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#FAF9F6] selection:bg-[#D4AF37]/20 flex flex-col pt-24">
      <div className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full">
        {/* Header Section */}
        <section className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-serif text-zinc-900 uppercase tracking-widest font-bold mb-4">
            Contact Us
          </h1>
          <p className="max-w-2xl mx-auto text-zinc-500 text-sm md:text-base leading-relaxed">
            We look forward to welcoming you to The Page Hotel. Please reach out if you have any questions, special requests, or require assistance with your booking.
          </p>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20 items-start">
          {/* Contact Information */}
          <div className="space-y-8">
            <h2 className="text-2xl font-serif text-zinc-900 font-bold uppercase tracking-wide">
              Get in Touch
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card className="p-6 bg-white border-zinc-200 rounded-3xl hover:shadow-lg transition-shadow">
                <MapPin className="h-6 w-6 text-[#D4AF37] mb-4" />
                <h3 className="font-bold text-zinc-900 uppercase tracking-wide text-sm mb-2">Location</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  123 Luxury Avenue<br />
                  Beverly Hills, CA 90210
                </p>
              </Card>
              <Card className="p-6 bg-white border-zinc-200 rounded-3xl hover:shadow-lg transition-shadow">
                <Phone className="h-6 w-6 text-[#D4AF37] mb-4" />
                <h3 className="font-bold text-zinc-900 uppercase tracking-wide text-sm mb-2">Phone</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  +1 (555) 123-4567<br />
                  +1 (555) 987-6543
                </p>
              </Card>
              <Card className="p-6 bg-white border-zinc-200 rounded-3xl hover:shadow-lg transition-shadow">
                <Mail className="h-6 w-6 text-[#D4AF37] mb-4" />
                <h3 className="font-bold text-zinc-900 uppercase tracking-wide text-sm mb-2">Email</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  reservations@thepage.com<br />
                  info@thepage.com
                </p>
              </Card>
              <Card className="p-6 bg-white border-zinc-200 rounded-3xl hover:shadow-lg transition-shadow">
                <Clock className="h-6 w-6 text-[#D4AF37] mb-4" />
                <h3 className="font-bold text-zinc-900 uppercase tracking-wide text-sm mb-2">Hours</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Front Desk: 24/7<br />
                  Check-in: 3:00 PM<br />
                  Check-out: 11:00 AM
                </p>
              </Card>
            </div>
          </div>

          {/* Contact Form */}
          <Card className="p-8 bg-white border-zinc-200 rounded-3xl shadow-xl">
            <h2 className="text-2xl font-serif text-zinc-900 font-bold uppercase tracking-wide mb-6">
              Send a Message
            </h2>
            <ContactForm />
          </Card>

        </section>

      </div>
      <SiteFooter />
    </main>
  );
}
