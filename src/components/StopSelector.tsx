'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MapPin } from 'lucide-react';

interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceFromStart: number;
  type: string;
}

interface StopSelectorProps {
  stops: Stop[];
  onSelectStop: (stopId: string, stopName: string) => void;
  triggerText?: string;
  selectedStopId?: string;
}

export default function StopSelector({
  stops,
  onSelectStop,
  triggerText = 'Select Pickup Stop',
  selectedStopId,
}: StopSelectorProps) {
  const [selected, setSelected] = useState<string>(selectedStopId || '');
  const [open, setOpen] = useState(false);

  const handleSelect = () => {
    if (selected) {
      const stop = stops.find((s) => s.id === selected);
      if (stop) {
        onSelectStop(selected, stop.name);
        setOpen(false);
      }
    }
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MapPin className="w-4 h-4" />
          {triggerText}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Your Pickup Stop</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {stops.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No stops available for this route
            </div>
          ) : (
            <RadioGroup value={selected} onValueChange={setSelected}>
              <div className="space-y-3">
                {stops.map((stop) => (
                  <div
                    key={stop.id}
                    className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelected(stop.id)}
                  >
                    <RadioGroupItem value={stop.id} id={stop.id} />
                    <Label
                      htmlFor={stop.id}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-semibold text-sm">{stop.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistance(stop.distanceFromStart)} from start
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!selected}>
            Confirm Selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
