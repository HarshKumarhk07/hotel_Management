'use client';

import { useQuery } from '@tanstack/react-query';
import { SiteFooter } from '@/components/site/SiteFooter';
import { CenteredSpinner } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import Image from 'next/image';

interface GalleryImage {
  _id: string;
  url: string;
  title: string;
  description?: string;
  category?: string;
}

export default function GalleryPage() {
  const { data: imagesData, isLoading } = useQuery<{ data: { images: GalleryImage[] } }>({
    queryKey: ['public-gallery'],
    queryFn: () => api.get('/gallery').then(res => res.data),
  });

  const images = imagesData?.data?.images || [];
  return (
    <main className="min-h-screen bg-[#FAF9F6] selection:bg-[#D4AF37]/20 flex flex-col pt-24">
      <div className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full">
        {/* Header Section */}
        <section className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-serif text-zinc-900 uppercase tracking-widest font-bold mb-4">
            Gallery
          </h1>
          <p className="max-w-2xl mx-auto text-zinc-500 text-sm md:text-base leading-relaxed">
            Take a visual journey through The Page Hotel. Discover our stunning architecture, beautifully appointed rooms, and world-class amenities designed for your ultimate relaxation.
          </p>
        </section>

        {/* Masonry-style Grid */}
        {isLoading ? (
          <div className="py-20 flex justify-center"><CenteredSpinner /></div>
        ) : images.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-200">
            <h3 className="text-lg font-bold text-zinc-900">Coming Soon</h3>
            <p className="text-sm text-zinc-500 mt-1">Our gallery is currently being updated. Please check back later.</p>
          </div>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
            {images.map((img) => (
              <div key={img._id} className="relative h-64 sm:h-80 w-full overflow-hidden rounded-2xl group bg-zinc-100">
                <Image 
                  src={img.url}
                  alt={img.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 text-center">
                  <span className="text-white font-serif uppercase tracking-widest text-sm font-semibold border-b border-[#D4AF37] pb-1 mb-2">
                    {img.title}
                  </span>
                  {img.description && (
                    <span className="text-white/90 text-xs font-sans max-w-xs">{img.description}</span>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
