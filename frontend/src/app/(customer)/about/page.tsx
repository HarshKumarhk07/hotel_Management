import { SiteFooter } from '@/components/site/SiteFooter';
import { Card } from '@/components/ui/primitives';
import { Leaf, Award, Shield, Users } from 'lucide-react';
import Image from 'next/image';

export const metadata = {
  title: 'About Us | The Page Hotel',
  description: 'Learn more about The Page Hotel, our history, values, and commitment to providing a luxurious stay.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#FAF9F6] selection:bg-[#D4AF37]/20 flex flex-col pt-24">
      <div className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full">
        {/* Header Section */}
        <section className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-serif text-zinc-900 uppercase tracking-widest font-bold mb-4">
            Our Story
          </h1>
          <p className="max-w-2xl mx-auto text-zinc-500 text-sm md:text-base leading-relaxed">
            Welcome to The Page Hotel, a sanctuary of elegance and unmatched hospitality. Since our inception, we have redefined luxury living by combining timeless architecture with modern sophistication.
          </p>
        </section>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20 items-center">
          <div className="space-y-6">
            <h2 className="text-2xl font-serif text-zinc-900 font-bold uppercase tracking-wide">
              A Heritage of Hospitality
            </h2>
            <p className="text-zinc-600 text-sm leading-relaxed">
              Every detail at The Page Hotel has been curated to offer our guests a seamless experience. From our meticulously designed suites to our world-class dining, our goal is to create an environment where luxury feels effortless. 
            </p>
            <p className="text-zinc-600 text-sm leading-relaxed">
              Our dedicated staff works around the clock to ensure your stay is not just comfortable, but memorable. We believe that true hospitality lies in anticipating the needs of our guests and exceeding their expectations.
            </p>
          </div>
          <div className="relative h-[400px] w-full rounded-2xl overflow-hidden shadow-2xl">
            <Image 
              src="https://images.unsplash.com/photo-1542314831-c6a420325142?auto=format&fit=crop&q=80" 
              alt="The Page Hotel Exterior" 
              fill 
              className="object-cover"
            />
          </div>
        </section>

        {/* Values Section */}
        <section className="mb-20">
          <h2 className="text-2xl font-serif text-zinc-900 font-bold uppercase tracking-wide text-center mb-10">
            Our Core Values
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-8 text-center space-y-4 hover:shadow-lg transition-shadow bg-white rounded-3xl border-zinc-200">
              <div className="mx-auto h-12 w-12 bg-[#D4AF37]/10 rounded-full flex items-center justify-center">
                <Award className="h-6 w-6 text-[#D4AF37]" />
              </div>
              <h3 className="font-bold text-zinc-900 uppercase tracking-wide text-sm">Excellence</h3>
              <p className="text-xs text-zinc-500">Uncompromising standards in every aspect of our service.</p>
            </Card>
            <Card className="p-8 text-center space-y-4 hover:shadow-lg transition-shadow bg-white rounded-3xl border-zinc-200">
              <div className="mx-auto h-12 w-12 bg-[#D4AF37]/10 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-[#D4AF37]" />
              </div>
              <h3 className="font-bold text-zinc-900 uppercase tracking-wide text-sm">Community</h3>
              <p className="text-xs text-zinc-500">Fostering a welcoming environment for guests and staff alike.</p>
            </Card>
            <Card className="p-8 text-center space-y-4 hover:shadow-lg transition-shadow bg-white rounded-3xl border-zinc-200">
              <div className="mx-auto h-12 w-12 bg-[#D4AF37]/10 rounded-full flex items-center justify-center">
                <Leaf className="h-6 w-6 text-[#D4AF37]" />
              </div>
              <h3 className="font-bold text-zinc-900 uppercase tracking-wide text-sm">Sustainability</h3>
              <p className="text-xs text-zinc-500">Committed to environmentally conscious practices and green living.</p>
            </Card>
            <Card className="p-8 text-center space-y-4 hover:shadow-lg transition-shadow bg-white rounded-3xl border-zinc-200">
              <div className="mx-auto h-12 w-12 bg-[#D4AF37]/10 rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6 text-[#D4AF37]" />
              </div>
              <h3 className="font-bold text-zinc-900 uppercase tracking-wide text-sm">Integrity</h3>
              <p className="text-xs text-zinc-500">Honesty and transparency in all our interactions.</p>
            </Card>
          </div>
        </section>

      </div>
      <SiteFooter />
    </main>
  );
}
