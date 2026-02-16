import { useQuery } from '@tanstack/react-query';
import { billingAPI } from '@/services/api';
import type { Plan } from '@/types';

export function usePlans() {
  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: () => billingAPI.getPlans(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  return { plans: plans || [], isLoading };
}
