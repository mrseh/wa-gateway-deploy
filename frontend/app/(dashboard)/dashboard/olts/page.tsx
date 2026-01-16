'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Activity, Wifi, Database, Settings, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { showToast } from '@/components/ui/toaster';

export default function OLTsPage() {
  const router = useRouter();
  const [olts, setOlts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOLTs();
  }, []);

  const loadOLTs = async () => {
    try {
      const response = await apiClient.get('/olts');
      if (response.success) {
        setOlts(response.data);
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to load OLTs');
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">OLT Monitoring</h1>
          <p className="mt-2 text-muted-foreground">
            Manage and monitor your OLT devices
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/olts/add')}>
          <Plus className="mr-2 h-4 w-4" />
          Add OLT
        </Button>
      </div>

      {olts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Database className="mb-4 h-16 w-16 text-muted-foreground" />
            <p className="mb-4 text-lg text-muted-foreground">No OLTs configured</p>
            <Button onClick={() => router.push('/dashboard/olts/add')}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First OLT
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {olts.map((olt: any) => (
            <Card
              key={olt.id}
              className="card-hover cursor-pointer"
              onClick={() => router.push(`/dashboard/olts/${olt.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{olt.name}</CardTitle>
                    <CardDescription>
                      {olt.vendor} {olt.model && `- ${olt.model}`}
                    </CardDescription>
                  </div>
                  <Badge variant={olt.status === 'active' ? 'success' : 'secondary'}>
                    {olt.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">PON Ports</p>
                      <p className="text-lg font-semibold">{olt.total_pon_ports}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">ONUs</p>
                      <p className="text-lg font-semibold">
                        {olt.online_onus}/{olt.total_onus}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">IP Address</p>
                  <p className="font-mono text-sm">{olt.ip_address}</p>
                </div>

                {olt.pon_ports && olt.pon_ports.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">PON Ports Health</p>
                    <div className="flex gap-1">
                      {olt.pon_ports.slice(0, 8).map((port: any) => (
                        <div
                          key={port.id}
                          className={`h-2 flex-1 rounded ${getHealthColor(port.health_score)}`}
                          style={{
                            backgroundColor:
                              port.health_score >= 90
                                ? '#22c55e'
                                : port.health_score >= 70
                                ? '#eab308'
                                : '#ef4444',
                          }}
                          title={`${port.port_name}: ${port.health_score}%`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
