import { useStore } from '@/app/store';

export function useDashboard() {
  const telemetry = useStore((s) => s.telemetry);
  const summary = useStore((s) => s.summary());
  const activeSiteId = useStore((s) => s.activeSiteId);
  const sites = useStore((s) => s.sites);
  const activeSite = sites.find((s) => s.id === activeSiteId);

  return { telemetry, summary, activeSite };
}
