'use client';

import { useEffect, useState } from 'react';
import { StatsCard } from '@/components/dashboard/stats-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useInstanceStore } from '@/store/instance.store';
import { messageService } from '@/services/message.service';
import { Smartphone, MessageSquare, TrendingUp, AlertCircle } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface DashboardStats {
  instances: {
    total: number;
    connected: number;
    disconnected: number;
  };
  messages: {
    today: number;
    this_week: number;
    total: number;
    success_rate: number;
  };
  quota: {
    used: number;
    limit: number;
    percentage: number;
  };
}

export default function DashboardPage() {
  const { instances, fetchInstances } = useInstanceStore();
  const [stats, setStats] = useState<DashboardStats>({
    instances: { total: 0, connected: 0, disconnected: 0 },
    messages: { today: 0, this_week: 0, total: 0, success_rate: 0 },
    quota: { used: 0, limit: 0, percentage: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch instances
      await fetchInstances();

      // Fetch message statistics
      const messageStats = await messageService.getStatistics({ days: 7 });
      const quotaData = await messageService.getQuota();

      if (messageStats.success && messageStats.data) {
        const { statistics } = messageStats.data;
        
        setStats({
          instances: {
            total: instances.length,
            connected: instances.filter(i => i.status === 'connected').length,
            disconnected: instances.filter(i => i.status === 'disconnected').length,
          },
          messages: {
            today: statistics.messages_sent, // Should be filtered by today
            this_week: statistics.messages_sent,
            total: statistics.total_messages,
            success_rate: statistics.total_messages > 0
              ? ((statistics.delivered / statistics.total_messages) * 100)
              : 0,
          },
          quota: quotaData.success && quotaData.data
            ? {
                used: quotaData.data.total.used,
                limit: quotaData.data.total.limit,
                percentage: (quotaData.data.total.used / quotaData.data.total.limit) * 100,
              }
            : { used: 0, limit: 0, percentage: 0 },
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update instance stats when instances change
  useEffect(() => {
    if (instances.length > 0) {
      setStats(prev => ({
        ...prev,
        instances: {
          total: instances.length,
          connected: instances.filter(i => i.status === 'connected').length,
          disconnected: instances.filter(i => i.status === 'disconnected').length,
        },
      }));
    }
  }, [instances]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="spinner mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your WhatsApp Gateway.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Instances"
          value={stats.instances.total}
          description={`${stats.instances.connected} connected`}
          icon={Smartphone}
        />

        <StatsCard
          title="Messages Today"
          value={formatNumber(stats.messages.today)}
          description="Messages sent today"
          icon={MessageSquare}
        />

        <StatsCard
          title="Success Rate"
          value={`${stats.messages.success_rate.toFixed(1)}%`}
          description="Message delivery rate"
          icon={TrendingUp}
        />

        <StatsCard
          title="Quota Usage"
          value={`${stats.quota.percentage.toFixed(0)}%`}
          description={`${formatNumber(stats.quota.used)} / ${formatNumber(stats.quota.limit)}`}
          icon={AlertCircle}
        />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Connected Instances */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Connected Instances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.instances.connected}
            </div>
            <p className="text-xs text-muted-foreground">
              Active connections
            </p>
            <div className="mt-4 h-2 rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-green-600"
                style={{
                  width: `${(stats.instances.connected / Math.max(stats.instances.total, 1)) * 100}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Disconnected Instances */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Disconnected Instances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.instances.disconnected}
            </div>
            <p className="text-xs text-muted-foreground">
              Need attention
            </p>
            <div className="mt-4 h-2 rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-red-600"
                style={{
                  width: `${(stats.instances.disconnected / Math.max(stats.instances.total, 1)) * 100}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* This Week */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Messages This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(stats.messages.this_week)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total messages sent
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest events from your instances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {instances.slice(0, 5).map((instance) => (
              <div
                key={instance.id}
                className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{instance.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {instance.phone_number || instance.instance_name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {formatNumber(instance.statistics.messages_sent)} sent
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {instance.status}
                  </p>
                </div>
              </div>
            ))}

            {instances.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                No instances yet. Create your first instance to get started!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
