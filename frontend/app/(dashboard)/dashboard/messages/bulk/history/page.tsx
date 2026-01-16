'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Download, XCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { showToast } from '@/components/ui/toaster';

export default function BulkMessageHistoryPage() {
  const router = useRouter();
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
    
    // Auto-refresh every 5 seconds if there are active batches
    const interval = setInterval(() => {
      const hasActive = batches.some((b: any) => 
        b.status === 'pending' || b.status === 'processing'
      );
      if (hasActive) {
        loadHistory();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadHistory = async () => {
    try {
      const response = await apiClient.get('/bulk-messages/history', {
        params: { limit: 50 },
      });
      if (response.success) {
        setBatches(response.data.batches);
      }
    } catch (error: any) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      pending: 'secondary',
      processing: 'default',
      completed: 'success',
      failed: 'destructive',
      cancelled: 'secondary',
    };
    return colors[status] || 'secondary';
  };

  const downloadResults = async (batchId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/bulk-messages/batch/${batchId}/export`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulk-results-${batchId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast.success('Results downloaded!');
    } catch (error: any) {
      showToast.error('Failed to download results');
    }
  };

  const cancelBatch = async (batchId: string) => {
    try {
      const response = await apiClient.post(`/bulk-messages/batch/${batchId}/cancel`);
      if (response.success) {
        showToast.success('Batch cancelled');
        loadHistory();
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to cancel batch');
    }
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
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Bulk Message History</h1>
            <p className="text-muted-foreground">View all your bulk message campaigns</p>
          </div>
        </div>
        <Button onClick={loadHistory} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {batches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="mb-4 text-lg text-muted-foreground">No bulk messages yet</p>
            <Button onClick={() => router.push('/dashboard/messages/bulk')}>
              Create Bulk Message
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {batches.map((batch: any) => (
            <Card key={batch.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{batch.batch_name}</CardTitle>
                    <CardDescription>
                      Instance: {batch.instance_name || 'Unknown'}
                    </CardDescription>
                  </div>
                  <Badge variant={getStatusColor(batch.status)}>
                    {batch.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Statistics */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{batch.total_recipients}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sent</p>
                    <p className="text-2xl font-bold text-green-600">{batch.sent_count}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <p className="text-2xl font-bold text-red-600">{batch.failed_count}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <p className="text-2xl font-bold">{batch.progress.toFixed(0)}%</p>
                  </div>
                </div>

                {/* Progress Bar */}
                {(batch.status === 'pending' || batch.status === 'processing') && (
                  <Progress value={batch.progress} />
                )}

                {/* Timestamps */}
                <div className="text-sm text-muted-foreground">
                  <p>Created: {new Date(batch.created_at).toLocaleString()}</p>
                  {batch.started_at && (
                    <p>Started: {new Date(batch.started_at).toLocaleString()}</p>
                  )}
                  {batch.completed_at && (
                    <p>Completed: {new Date(batch.completed_at).toLocaleString()}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {batch.status === 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadResults(batch.id)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Results
                    </Button>
                  )}
                  {(batch.status === 'pending' || batch.status === 'processing') && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => cancelBatch(batch.id)}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
