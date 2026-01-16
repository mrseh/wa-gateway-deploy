'use client';

import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Instance } from '@/types';
import { Smartphone, MessageSquare, AlertCircle, Settings, Power } from 'lucide-react';
import { cn, formatRelativeTime, formatNumber } from '@/lib/utils';

interface InstanceCardProps {
  instance: Instance;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onRestart?: () => void;
}

const statusConfig = {
  connected: {
    label: 'Connected',
    variant: 'success' as const,
    className: 'bg-green-500',
  },
  disconnected: {
    label: 'Disconnected',
    variant: 'destructive' as const,
    className: 'bg-red-500',
  },
  waiting_qr: {
    label: 'Waiting QR',
    variant: 'warning' as const,
    className: 'bg-yellow-500',
  },
  creating: {
    label: 'Creating',
    variant: 'info' as const,
    className: 'bg-blue-500',
  },
  error: {
    label: 'Error',
    variant: 'destructive' as const,
    className: 'bg-red-500',
  },
  suspended: {
    label: 'Suspended',
    variant: 'secondary' as const,
    className: 'bg-gray-500',
  },
};

export function InstanceCard({ instance, onConnect, onDisconnect, onRestart }: InstanceCardProps) {
  const config = statusConfig[instance.status];
  const isConnected = instance.status === 'connected';
  const needsQR = instance.status === 'waiting_qr';

  return (
    <Card className="card-hover">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{instance.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {instance.phone_number || instance.instance_name}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div
              className={cn(
                'status-indicator',
                config.className
              )}
            />
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{formatNumber(instance.statistics.messages_sent)}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{formatNumber(instance.statistics.messages_received)}</p>
            <p className="text-xs text-muted-foreground">Received</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{instance.statistics.uptime_percentage}%</p>
            <p className="text-xs text-muted-foreground">Uptime</p>
          </div>
        </div>

        {/* Quota */}
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Daily Quota</span>
            <span className="font-medium">
              {instance.quota.daily_messages} / {instance.quota.daily_limit}
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.min((instance.quota.daily_messages / instance.quota.daily_limit) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Last Seen */}
        {instance.last_seen && (
          <p className="text-xs text-muted-foreground">
            Last seen: {formatRelativeTime(instance.last_seen)}
          </p>
        )}

        {/* Error Message */}
        {instance.last_error && (
          <div className="flex items-start space-x-2 rounded-lg bg-destructive/10 p-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-xs text-destructive">{instance.last_error}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        {needsQR && (
          <Button
            variant="default"
            className="flex-1"
            onClick={onConnect}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Connect
          </Button>
        )}

        {isConnected && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={onDisconnect}
          >
            <Power className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={onRestart}
          title="Restart Instance"
        >
          <Power className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          asChild
          title="Settings"
        >
          <Link href={`/dashboard/instances/${instance.id}`}>
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
