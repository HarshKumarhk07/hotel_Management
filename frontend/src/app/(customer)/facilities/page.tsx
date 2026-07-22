import { SiteFooter } from '@/components/site/SiteFooter';
import { Card } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Utensils, Wifi, Car, Flower2 as SpaIcon, Dumbbell, Coffee, Martini, Wine, Music, Bell } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  title: 'Facilities | The Page Hotel',
  description: 'Explore the world-class facilities and services available at The Page Hotel.',
};

export default function FacilitiesPage() {
  return (
    <main className="min-h-screen bg-[#FAF9F6] selection:bg-[#D4AF37]/20 flex flex-col pt-24">
      <div className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full">
        {/* Header Section */}
        <section className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-serif text-zinc-900 uppercase tracking-widest font-bold mb-4">
            Our Facilities
          </h1>
          <p className="max-w-2xl mx-auto text-zinc-500 text-sm md:text-base leading-relaxed">
            Experience unparalleled luxury with our comprehensive range of services and world-class amenities designed to make your stay unforgettable.
          </p>
        </section>

        {/* Featured Facilities */}
        <section className="space-y-12 mb-20">
          <div className="flex flex-col md:flex-row items-center gap-8 bg-white rounded-3xl overflow-hidden shadow-xl border border-zinc-100">
            <div className="relative h-64 md:h-[400px] w-full md:w-1/2">
              <Image 
                src="https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&q=80" 
                alt="Fine Dining" 
                fill 
                className="object-cover"
              />
            </div>
            <div className="p-8 md:p-12 md:w-1/2 space-y-4">
              <div className="h-10 w-10 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mb-2">
                <Utensils className="h-5 w-5 text-[#D4AF37]" />
              </div>
              <h2 className="text-2xl font-serif text-zinc-900 font-bold uppercase tracking-wide">
                Signature Restaurant
              </h2>
              <p className="text-zinc-600 text-sm leading-relaxed">
                Indulge in a culinary journey at our signature restaurant, where our award-winning chefs prepare exquisite dishes using the finest seasonal ingredients. 
              </p>
              <div className="pt-4">
                <Link href="/restaurant/book">
                  <Button className="bg-zinc-950 hover:bg-zinc-800 text-white font-bold uppercase tracking-widest px-8">
                    Book a Table
                  </Button>
                </Link>
              </div>
            </div>
          </div>


          <div className="flex flex-col md:flex-row items-center gap-8 bg-white rounded-3xl overflow-hidden shadow-xl border border-zinc-100">
            <div className="relative h-64 md:h-[400px] w-full md:w-1/2">
              <Image 
                src="https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&q=80" 
                alt="Digital Concierge" 
                fill 
                className="object-cover"
              />
            </div>
            <div className="p-8 md:p-12 md:w-1/2 space-y-4">
              <div className="h-10 w-10 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mb-2">
                <Bell className="h-5 w-5 text-[#D4AF37]" />
              </div>
              <h2 className="text-2xl font-serif text-zinc-900 font-bold uppercase tracking-wide">
                Digital Concierge
              </h2>
              <p className="text-zinc-600 text-sm leading-relaxed">
                Experience seamless service with our digital concierge. Order in-room dining, request housekeeping, or access hotel services directly from your smartphone via QR code.
              </p>
              <div className="pt-4">
                <Link href="/services">
                  <Button className="bg-[#D4AF37] hover:bg-[#AE963C] text-white font-bold uppercase tracking-widest px-8">
                    Access Services
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* All Amenities List */}
        <section className="mb-20">
          <h2 className="text-2xl font-serif text-zinc-900 font-bold uppercase tracking-wide text-center mb-10">
            All Amenities
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { icon: Wifi, label: 'High-Speed Wi-Fi' },
              { icon: Car, label: 'Valet Parking' },
              { icon: Coffee, label: '24/7 Cafe' },
              { icon: Martini, label: 'Lounge Bar' },
              { icon: Wine, label: 'Wine Cellar' },
              { icon: Music, label: 'Live Entertainment' },
              { icon: Utensils, label: 'In-Room Dining' },
              { icon: Bell, label: '24/7 Reception' },
            ].map((item, idx) => (
              <Card key={idx} className="p-6 text-center space-y-3 bg-white border-zinc-200 rounded-2xl hover:border-[#D4AF37] transition-colors">
                <item.icon className="h-8 w-8 text-[#D4AF37] mx-auto" />
                <p className="font-bold text-zinc-900 text-xs uppercase tracking-wide">{item.label}</p>
              </Card>
            ))}
          </div>
        </section>

      </div>
      <SiteFooter />
    </main>
  );
}
