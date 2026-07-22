'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { ChefHat, Utensils, ArrowRight } from 'lucide-react';
import { CenteredSpinner } from '@/components/ui/primitives';

interface Kitchen {
  id: string;
  name: string;
  description?: string;
  isOpen: boolean;
  isActive: boolean;
}

export default function GenericMenuPage() {
  const { data: kitchens, isLoading } = useQuery<Kitchen[]>({
    queryKey: ['public-kitchens'],
    queryFn: async () => {
      const res = await api.get<{ data: { kitchens: Kitchen[] } }>('/kitchens/public');
      return res.data.data.kitchens;
    },
  });

  return (
    <div className="min-h-screen bg-neutral-950 pt-28 pb-20 relative overflow-hidden">
      {/* Premium background effects */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
      <div className="absolute -top-[300px] -right-[300px] w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-[20%] -left-[200px] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
        <header className="mb-16 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 mb-6 backdrop-blur-md">
            <Utensils className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-white mb-6 tracking-tight">Culinary Excellence</h1>
          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto font-light">
            Discover our masterfully crafted menus, spanning authentic local flavors to contemporary global gastronomy.
          </p>
        </header>

        {isLoading ? (
          <CenteredSpinner />
        ) : !kitchens || kitchens.length === 0 ? (
          <div className="text-center py-24 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md">
            <p className="text-xl text-neutral-400 font-light">No menus available at the moment.</p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {kitchens.map((kitchen) => (
              <Link 
                key={kitchen.id} 
                href={`/k/${kitchen.id}`}
                className="group relative flex flex-col rounded-3xl overflow-hidden bg-white/5 border border-white/10 p-8 shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:bg-white/10 hover:border-white/30 backdrop-blur-sm"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none group-hover:scale-150 transform origin-top-right">
                  <ChefHat className="h-32 w-32 text-white" />
                </div>
                
                <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white transition-transform duration-500 group-hover:scale-110 group-hover:bg-white group-hover:text-neutral-950">
                  <ChefHat className="h-7 w-7" />
                </div>
                
                <h2 className="text-3xl font-serif text-white mb-3 group-hover:text-primary transition-colors">{kitchen.name}</h2>
                
                {kitchen.description ? (
                  <p className="mt-3 text-neutral-400 font-light leading-relaxed line-clamp-3 relative z-10">{kitchen.description}</p>
                ) : (
                  <p className="mt-3 text-neutral-500 italic font-light relative z-10">Experience the finest ingredients and culinary artistry at {kitchen.name}.</p>
                )}
                
                <div className="mt-auto pt-10 flex items-center justify-end relative z-10">
                  <div className="flex items-center text-sm uppercase tracking-widest font-medium text-white/80 group-hover:text-white transition-colors">
                    Explore Menu
                    <ArrowRight className="ml-3 h-5 w-5 transition-transform duration-500 group-hover:translate-x-2" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
