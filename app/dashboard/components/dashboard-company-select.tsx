'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setCompanyIdCookie, getCompanyIdFromClient } from '@/lib/company-cookie';

export function DashboardCompanySelect() {
  const { data: session } = useSession();
  const router = useRouter();
  const tCommon = useTranslations('common');

  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId] = useState('');

  const isSuper = session?.user?.role === 'super';

  useEffect(() => {
    if (!isSuper) return;
    fetch('/api/companies')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setCompanies(data);
        const current = getCompanyIdFromClient();
        if (current && data.some((c: { id: string }) => c.id === current)) {
          setCompanyId(current);
        } else if (data.length > 0) {
          setCompanyId(data[0].id);
        }
      });
  }, [isSuper]);

  if (!isSuper || companies.length === 0) return null;

  function handleChange(value: string) {
    setCompanyId(value);
    setCompanyIdCookie(value);
    router.refresh();
  }

  return (
    <Select value={companyId} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder={tCommon('selectCompany')} />
      </SelectTrigger>
      <SelectContent>
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
