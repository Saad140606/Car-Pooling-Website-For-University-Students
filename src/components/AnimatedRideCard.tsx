"use client";

import { CountdownTimer } from "@/components/CountdownTimer";
import { AnimatedCard } from "@/components/AnimatedCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/Reveal";

interface RideCardProps {
  id: string;
  title: string;
  from: string;
  to: string;
  time: string;
  price: number;
  seats: number;
  seatsBooked: number;
  driver: {
    name: string;
    rating: number;
    verified: boolean;
  };
  expiresIn?: number; // seconds
  status?: "available" | "ending-soon" | "full" | "expired";
  onBook?: () => void;
  delay?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

/**
 * Animated ride card with live countdown timer, hover effects, and status transitions
 */
export function AnimatedRideCard({
  id,
  title,
  from,
  to,
  time,
  price,
  seats,
  seatsBooked,
  driver,
  expiresIn,
  status = "available",
  onBook,
  delay = 0,
}: RideCardProps) {
  const seatsLeft = seats - seatsBooked;
  const isFull = seatsLeft === 0;
  const isEndingSoon = expiresIn ? expiresIn < 300 : false; // 5 minutes

  const statusColors = {
    available: "border-primary/40",
    "ending-soon": "border-yellow-500/40 bg-yellow-500/5",
    full: "border-destructive/40 bg-destructive/5",
    expired: "border-muted/40 opacity-60",
  };

  return (
    <Reveal
      delay={delay * 80}
    >
      <AnimatedCard
        hover="lift"
        animation="bounce-in"
        delay={delay}
        className={cn(
          "overflow-hidden transition-all duration-300",
          statusColors[status],
          isEndingSoon && "ring-2 ring-yellow-500/50"
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{driver.name}</p>
            </div>
            {isEndingSoon && (
              <div className="animate-pulse px-2 py-1 bg-yellow-500/20 rounded text-xs font-semibold text-yellow-600">
                Ending soon
              </div>
            )}
            {isFull && (
              <div className="px-2 py-1 bg-destructive/20 rounded text-xs font-semibold text-destructive">
                Full
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Route */}
          <div className="space-y-2">
            <div className="flex gap-3">
              <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">{from}</p>
                <p className="text-xs text-muted-foreground">Pickup</p>
              </div>
            </div>
            <div className="ml-2 h-8 w-0.5 bg-gradient-to-b from-primary/50 to-accent/30" />
            <div className="flex gap-3">
              <MapPin className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">{to}</p>
                <p className="text-xs text-muted-foreground">Dropoff</p>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
            <div className="text-center p-2 rounded-lg bg-primary/10 hover-lift-sm">
              <p className="text-lg font-bold text-primary">{price}</p>
              <p className="text-xs text-muted-foreground">PKR per seat</p>
            </div>

            <div className="text-center p-2 rounded-lg bg-accent/10 hover-lift-sm">
              <p className="text-lg font-bold text-accent">
                {seatsLeft}/{seats}
              </p>
              <p className="text-xs text-muted-foreground">Seats</p>
            </div>

            <div className="text-center p-2 rounded-lg hover-lift-sm">
              <p className="text-lg font-bold">{time}</p>
              <p className="text-xs text-muted-foreground">Departure</p>
            </div>
          </div>

          {/* Timer */}
          {expiresIn && (
            <div className="animate-subtle-bounce p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Expires in</p>
              <CountdownTimer
                seconds={expiresIn}
                format="mm:ss"
                warningAt={300}
                className={cn(
                  "text-sm font-mono font-bold",
                  isEndingSoon && "text-yellow-500"
                )}
              />
            </div>
          )}

          {/* CTA */}
          <Button
            onClick={onBook}
            disabled={isFull || status === "expired"}
            className={cn(
              "w-full rounded-lg font-semibold h-11",
              "btn-press transition-all duration-200",
              isFull && "opacity-50 cursor-not-allowed"
            )}
          >
            {isFull
              ? "Ride Full"
              : status === "expired"
              ? "Ride Expired"
              : "Book Now"}
          </Button>
        </CardContent>
      </AnimatedCard>
    </Reveal>
  );
}
