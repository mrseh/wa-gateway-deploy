'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  TrendingUp,
  Smartphone,
  Activity,
  Database,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { showToast } from '@/components/ui/toaster';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [range, setRange] = useState('7d');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [range]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/analytics/dashboard', {
        params: { range },
      });
      if (response.success) {
        setData(response.data);
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p>No data available</p>
      </div>
    );
  }

  const messages = data.messages || {};
  const instances = data.instances || {};
  const olts = data.olts || {};
  const quota = data.quota || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-2 text-muted-foreground">
            Comprehensive insights into your messaging and monitoring
          </p>
        </div>
        <div className="flex gap-2">
          <Tabs value={range} onValueChange={setRange}>
            <TabsList>
              <TabsTrigger value="1d">1D</TabsTrigger>
              <TabsTrigger value="7d">7D</TabsTrigger>
              <TabsTrigger value="30d">30D</TabsTrigger>
              <TabsTrigger value="90d">90D</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={loadAnalytics}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messages.total_sent || 0}</div>
            <p className="text-xs text-muted-foreground">
              +12% from previous period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {messages.success_rate || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {messages.delivered || 0} delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Instances</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {instances.connected || 0}/{instances.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Connected instances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Online ONUs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {olts.online_onus || 0}/{olts.total_onus || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {olts.total_olts || 0} OLTs monitored
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quota Usage */}
      {quota && (
        <Card>
          <CardHeader>
            <CardTitle>Quota Usage</CardTitle>
            <CardDescription>Your current subscription usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {quota.instances && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Instances</span>
                    <span className="text-sm text-muted-foreground">
                      {quota.instances.used}/{quota.instances.limit}
                    </span>
                  </div>
                  <Progress value={quota.instances.percentage} />
                </div>
              )}

              {quota.messages_today && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Messages Today</span>
                    <span className="text-sm text-muted-foreground">
                      {quota.messages_today.used}/{quota.messages_today.limit}
                    </span>
                  </div>
                  <Progress value={quota.messages_today.percentage} />
                </div>
              )}

              {quota.messages_month && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Messages This Month</span>
                    <span className="text-sm text-muted-foreground">
                      {quota.messages_month.used}/{quota.messages_month.limit}
                    </span>
                  </div>
                  <Progress value={quota.messages_month.percentage} />
                </div>
              )}

              {quota.olts && quota.olts.limit > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">OLTs</span>
                    <span className="text-sm text-muted-foreground">
                      {quota.olts.used}/{quota.olts.limit}
                    </span>
                  </div>
                  <Progress value={quota.olts.percentage} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Message Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Message Trends</CardTitle>
            <CardDescription>Daily message volume</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={messages.messages_by_day || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="count"
                  stackId="1"
                  stroke="#8884d8"
                  fill="#8884d8"
                  name="Total"
                />
                <Area
                  type="monotone"
                  dataKey="delivered"
                  stackId="2"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  name="Delivered"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Peak Hours */}
        <Card>
          <CardHeader>
            <CardTitle>Peak Hours</CardTitle>
            <CardDescription>Message distribution by hour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={messages.messages_by_hour || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8884d8" name="Messages" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Messages by Instance */}
        <Card>
          <CardHeader>
            <CardTitle>Messages by Instance</CardTitle>
            <CardDescription>Distribution across instances</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={messages.messages_by_instance || []}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {(messages.messages_by_instance || []).map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Success vs Failed */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Status</CardTitle>
            <CardDescription>Success vs failed messages</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Delivered', value: messages.delivered || 0 },
                    { name: 'Failed', value: messages.failed || 0 },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  <Cell fill="#82ca9d" />
                  <Cell fill="#ff6b6b" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
          <CardDescription>Latest events and alerts</CardDescription>
        </CardHeader>
        <CardContent>
          {data.alerts && data.alerts.length > 0 ? (
            <div className="space-y-2">
              {data.alerts.map((alert: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <Badge variant="secondary" className="mb-1">
                      {alert.source}
                    </Badge>
                    <p className="text-sm">{alert.name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No recent alerts</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
