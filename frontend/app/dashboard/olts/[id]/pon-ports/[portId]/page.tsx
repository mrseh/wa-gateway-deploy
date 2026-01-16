'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowLeft, RefreshCw, Thermometer, Zap, Activity, Signal } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { showToast } from '@/components/ui/toaster';

export default function PONPortDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [ponPort, setPonPort] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [period, setPeriod] = useState('24h');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (params.portId) {
      loadPONPort();
      loadMetrics();
    }
  }, [params.portId, period]);

  const loadPONPort = async () => {
    try {
      const response = await apiClient.get(`/olts/pon-ports/${params.portId}`);
      if (response.success) {
        setPonPort(response.data);
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to load PON port');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      const response = await apiClient.get(`/olts/pon-ports/${params.portId}/metrics`, {
        params: { period },
      });
      if (response.success) {
        setMetrics(response.data);
      }
    } catch (error: any) {
      console.error('Failed to load metrics:', error);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'destructive';
  };

  const formatChartData = () => {
    if (!metrics?.data_points) return [];
    return metrics.data_points.map((point: any) => ({
      time: new Date(point.timestamp).toLocaleTimeString(),
      utilization: point.utilization,
      temperature: point.temperature,
      rx_power: point.rx_power,
      online_onus: point.online_onus,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!ponPort) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p>PON Port not found</p>
      </div>
    );
  }

  const chartData = formatChartData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{ponPort.port_name}</h1>
            <p className="text-muted-foreground">
              {ponPort.olt.name} - {ponPort.olt.ip_address}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadMetrics}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ponPort.health_score}%</div>
            <Badge variant={getHealthColor(ponPort.health_score)} className="mt-1">
              {ponPort.health_score >= 90 ? 'Excellent' : ponPort.health_score >= 70 ? 'Good' : 'Poor'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Utilization</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ponPort.utilization?.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Port capacity usage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Temperature</CardTitle>
            <Thermometer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ponPort.temperature?.toFixed(1)}°C</div>
            <p className="text-xs text-muted-foreground">
              Threshold: {ponPort.threshold_temperature_high}°C
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">RX Power</CardTitle>
            <Signal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ponPort.rx_power?.toFixed(1)} dBm</div>
            <p className="text-xs text-muted-foreground">Average receive power</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs value={period} onValueChange={setPeriod}>
        <TabsList>
          <TabsTrigger value="1h">1 Hour</TabsTrigger>
          <TabsTrigger value="24h">24 Hours</TabsTrigger>
          <TabsTrigger value="7d">7 Days</TabsTrigger>
          <TabsTrigger value="30d">30 Days</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Utilization Trend</CardTitle>
              <CardDescription>Port capacity usage over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="utilization"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Temperature</CardTitle>
                <CardDescription>PON port temperature monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="temperature" stroke="#ff6b6b" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>RX Power</CardTitle>
                <CardDescription>Receive power levels</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="rx_power" stroke="#82ca9d" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Online ONUs</CardTitle>
              <CardDescription>Number of active ONUs</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="online_onus"
                    stroke="#ffc658"
                    fill="#ffc658"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ONUs List */}
      <Card>
        <CardHeader>
          <CardTitle>ONUs ({ponPort.online_onus}/{ponPort.total_onus})</CardTitle>
          <CardDescription>Connected optical network units</CardDescription>
        </CardHeader>
        <CardContent>
          {ponPort.onus && ponPort.onus.length > 0 ? (
            <div className="space-y-2">
              {ponPort.onus.map((onu: any) => (
                <div
                  key={onu.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">{onu.serial_number || 'Unknown'}</p>
                    {onu.customer_name && (
                      <p className="text-sm text-muted-foreground">{onu.customer_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">RX: {onu.rx_power?.toFixed(1)} dBm</p>
                      <p className="text-xs text-muted-foreground">
                        TX: {onu.tx_power?.toFixed(1)} dBm
                      </p>
                    </div>
                    <Badge variant={onu.status === 'online' ? 'success' : 'destructive'}>
                      {onu.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No ONUs found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
