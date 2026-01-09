"use client";

import React, { useMemo, useState } from 'react';

type Props = {
  rides: any[];
  pageSize?: number;
  onOpenRide?: (ride: any) => void;
};

export default function RidesTable({ rides, pageSize = 8, onOpenRide }: Props) {
  const [page, setPage] = useState(1);

  const paged = useMemo(() => rides.slice(0, page * pageSize), [rides, page, pageSize]);
  const canLoadMore = rides.length > paged.length;

  return (
    <div>
      <div className="space-y-3">
        {paged.map((r) => (
          <div key={r.id} className="p-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-semibold">{r.startLocation || 'Unknown'} → {r.endLocation || 'Unknown'}</div>
                <div className="text-xs text-muted-foreground">{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : (r.createdAt?.seconds ? new Date(r.createdAt.seconds*1000).toLocaleString() : '')}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 text-sm rounded bg-slate-800" onClick={() => onOpenRide?.(r)}>Details</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-center">
        {canLoadMore ? (
          <button className="px-4 py-2 rounded bg-primary text-white" onClick={() => setPage((p) => p + 1)}>Load more</button>
        ) : (
          <div className="text-sm text-muted-foreground">No more rides</div>
        )}
      </div>
    </div>
  );
}
