'use client';

import { Subscription } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface SubscriptionStatusProps {
  subscription: Subscription;
  onRenew?: () => void;
  onUpgrade?: () => void;
  onCancel?: () => void;
}

const statusConfig = {
  pending: {
    label: 'Pending',
    variant: 'secondary' as const,
    icon: Clock,
    color: 'text-gray-600',
  },
  active: {
    label: 'Active',
    variant: 'success' as const,
    icon: CheckCircle,
    color: 'text-green-600',
  },
  expired: {
    label: 'Expired',
    variant: 'destructive' as const,
    icon: AlertCircle,
    color: 'text-red-600',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'secondary' as const,
    icon: XCircle,
    color: 'text-gray-600',
  },
  suspended: {
    label: 'Suspended',
    variant: 'destructive' as const,
    icon: AlertCircle,
    color: 'text-orange-600',
  },
};

export function SubscriptionStatus({
  subscription,
  onRenew,
  onUpgrade,
  onCancel,
}: SubscriptionStatusProps) {
  const [timeRemaining, setTimeRemaining] = useState('');
  const config = statusConfig[subscription.status];
  const Icon = config.icon;

  // Update countdown timer
  useEffect(() => {
    if (!subscription.end_date) return;

    const updateCountdown = () => {
      const now = new Date();
      const end = new Date(subscription.end_date!);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeRemaining(`${days} day${days > 1 ? 's' : ''} ${hours}h`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [subscription.end_date]);

  const daysRemaining = subscription.days_remaining || 0;
  const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7;
  const isInGracePeriod = subscription.is_in_grace_period;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${config.color}`} />
              Subscription Status
            </CardTitle>
            <CardDescription>
              {subscription.package?.name || 'No package'}
            </CardDescription>
          </div>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Package Details */}
        {subscription.package && (
          <div className="rounded-lg bg-muted p-4">
            <h4 className="mb-2 font-semibold">{subscription.package.name}</h4>
            <p className="text-sm text-muted-foreground">
              {subscription.package.description}
            </p>
            <p className="mt-2 text-2xl font-bold">
              {subscription.package.formatted_price}
              <span className="text-sm font-normal text-muted-foreground">
                /{subscription.package.duration_days} days
              </span>
            </p>
          </div>
        )}

        {/* Dates */}
        {subscription.start_date && subscription.end_date && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center text-sm text-muted-foreground">
                <Calendar className="mr-2 h-4 w-4" />
                Start Date
              </span>
              <span className="font-medium">
                {formatDate(subscription.start_date)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center text-sm text-muted-foreground">
                <Calendar className="mr-2 h-4 w-4" />
                End Date
              </span>
              <span className="font-medium">
                {formatDate(subscription.end_date)}
              </span>
            </div>

            {subscription.is_active && (
              <div className="flex items-center justify-between">
                <span className="flex items-center text-sm text-muted-foreground">
                  <Clock className="mr-2 h-4 w-4" />
                  Time Remaining
                </span>
                <span className={`font-bold ${isExpiringSoon ? 'text-orange-600' : 'text-green-600'}`}>
                  {timeRemaining}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Grace Period Warning */}
        {isInGracePeriod && subscription.grace_period_until && (
          <div className="rounded-lg bg-orange-50 p-4 dark:bg-orange-950">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-orange-600" />
              <div>
                <p className="font-semibold text-orange-900 dark:text-orange-100">
                  Grace Period Active
                </p>
                <p className="mt-1 text-sm text-orange-800 dark:text-orange-200">
                  Your subscription has expired but you're in a grace period until{' '}
                  <span className="font-medium">
                    {formatDate(subscription.grace_period_until)}
                  </span>
                  . Please renew to avoid service suspension.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Expiring Soon Warning */}
        {isExpiringSoon && !isInGracePeriod && (
          <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
              <div>
                <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                  Expiring Soon
                </p>
                <p className="mt-1 text-sm text-yellow-800 dark:text-yellow-200">
                  Your subscription will expire in {daysRemaining} day{daysRemaining > 1 ? 's' : ''}.
                  Renew now to avoid interruption.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Auto-renew Status */}
        {subscription.auto_renew && (
          <div className="flex items-center space-x-2 rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-900 dark:text-blue-100">
              Auto-renewal is enabled
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {subscription.is_active && (
            <>
              {onRenew && (
                <Button onClick={onRenew} className="w-full">
                  Renew Subscription
                </Button>
              )}
              {onUpgrade && (
                <Button variant="outline" onClick={onUpgrade} className="w-full">
                  Upgrade Plan
                </Button>
              )}
            </>
          )}

          {subscription.status === 'expired' && onRenew && (
            <Button onClick={onRenew} className="w-full">
              Reactivate Subscription
            </Button>
          )}

          {subscription.is_active && onCancel && (
            <Button variant="ghost" onClick={onCancel} className="w-full text-destructive">
              Cancel Subscription
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
