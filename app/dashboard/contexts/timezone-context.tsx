'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useCompanyId } from '../hooks/use-company-id';

const TimezoneContext = createContext<string>('browser');

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const companyId = useCompanyId();
  const [timezone, setTimezone] = useState<string>('browser');

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/company-settings?companyId=${companyId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.timezone) setTimezone(data.timezone);
      });
  }, [companyId]);

  return <TimezoneContext.Provider value={timezone}>{children}</TimezoneContext.Provider>;
}

export function useTimezone() {
  return useContext(TimezoneContext);
}
