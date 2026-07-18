import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiSuccess, PublicMenu } from '@/lib/types';

/** Fetch a kitchen's public, currently-orderable menu. */
export function useMenu(kitchenId: string | undefined) {
  return useQuery({
    queryKey: ['menu', kitchenId],
    enabled: Boolean(kitchenId),
    queryFn: async () => {
      const res = await api.get<ApiSuccess<PublicMenu>>(`/menu/public/${kitchenId}`);
      return res.data.data;
    },
  });
}
