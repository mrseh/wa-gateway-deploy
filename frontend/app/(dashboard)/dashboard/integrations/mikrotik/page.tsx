'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Download, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { showToast } from '@/components/ui/toaster';

export default function MikrotikIntegrationPage() {
  const [script, setScript] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [events, setEvents] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadScript();
    loadEvents();
  }, []);

  const loadScript = async () => {
    try {
      const response = await apiClient.get('/webhooks/mikrotik/script');
      if (response.success) {
        setScript(response.data.script);
        setWebhookUrl(response.data.webhook_url);
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to load script');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const response = await apiClient.get('/webhooks/mikrotik/events', {
        params: { limit: 50 },
      });
      if (response.success) {
        setEvents(response.data.events);
      }
    } catch (error: any) {
      console.error('Failed to load events:', error);
    }
  };

  const copyScript = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    showToast.success('Script copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadScript = () => {
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mikrotik-monitoring.rsc';
    a.click();
    URL.revokeObjectURL(url);
  };

  const eventTypeColors: any = {
    pppoe_login: 'success',
    pppoe_logout: 'destructive',
    interface_down: 'warning',
    interface_up: 'success',
    high_cpu: 'destructive',
    high_memory: 'warning',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mikrotik Integration</h1>
        <p className="mt-2 text-muted-foreground">
          Monitor your Mikrotik routers with WhatsApp notifications
        </p>
      </div>

      <Tabs defaultValue="setup" className="w-full">
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="events">Events Log</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook URL</CardTitle>
              <CardDescription>
                This is your unique webhook URL for Mikrotik notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <code className="flex-1 rounded-md bg-muted px-4 py-2 font-mono text-sm">
                  {webhookUrl || 'Loading...'}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    showToast.success('Copied!');
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Installation Script</CardTitle>
              <CardDescription>
                Copy this script and paste it into your Mikrotik RouterOS terminal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-sm">
                  <code>{script || 'Loading script...'}</code>
                </pre>
              </div>

              <div className="flex gap-2">
                <Button onClick={copyScript} disabled={!script}>
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Script
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={downloadScript} disabled={!script}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Script
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-inside list-decimal space-y-2">
                <li>Copy the script above</li>
                <li>Open your Mikrotik router terminal (WinBox or SSH)</li>
                <li>Paste the entire script</li>
                <li>Press Enter to execute</li>
                <li>The router will start sending events to your WhatsApp</li>
              </ol>

              <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> Make sure your Mikrotik router can access the internet
                  and your WhatsApp instance is connected.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>
                Last {events.length} events from your Mikrotik routers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-center text-muted-foreground">No events yet</p>
              ) : (
                <div className="space-y-2">
                  {events.map((event: any) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center space-x-4">
                        <Badge variant={eventTypeColors[event.event_type] || 'secondary'}>
                          {event.event_type}
                        </Badge>
                        <div>
                          <p className="font-medium">{event.router_name || 'Unknown Router'}</p>
                          {event.username && (
                            <p className="text-sm text-muted-foreground">User: {event.username}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                        {event.message_sent && (
                          <Badge variant="success" className="mt-1">
                            Notified
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
