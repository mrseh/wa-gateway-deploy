'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Download, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { showToast } from '@/components/ui/toaster';

export default function ZabbixIntegrationPage() {
  const [config, setConfig] = useState<any>(null);
  const [events, setEvents] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConfig();
    loadEvents();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await apiClient.get('/webhooks/zabbix/config');
      if (response.success) {
        setConfig(response.data);
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const response = await apiClient.get('/webhooks/zabbix/events', {
        params: { limit: 50 },
      });
      if (response.success) {
        setEvents(response.data.events);
      }
    } catch (error: any) {
      console.error('Failed to load events:', error);
    }
  };

  const copyWebhookUrl = () => {
    if (config?.webhook_url) {
      navigator.clipboard.writeText(config.webhook_url);
      setCopied(true);
      showToast.success('Webhook URL copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadScript = () => {
    if (!config?.media_type_config) return;
    
    const script = config.media_type_config.script;
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zabbix-webhook.js';
    a.click();
    URL.revokeObjectURL(url);
  };

  const severityColors: any = {
    disaster: 'destructive',
    high: 'destructive',
    average: 'warning',
    warning: 'warning',
    information: 'default',
    not_classified: 'secondary',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Zabbix Integration</h1>
        <p className="mt-2 text-muted-foreground">
          Monitor your infrastructure with Zabbix alerts via WhatsApp
        </p>
      </div>

      <Tabs defaultValue="setup" className="w-full">
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="events">Events Log</TabsTrigger>
          <TabsTrigger value="guide">Configuration Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook URL</CardTitle>
              <CardDescription>
                Configure this webhook URL in your Zabbix server
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <code className="flex-1 rounded-md bg-muted px-4 py-2 font-mono text-sm">
                  {config?.webhook_url || 'Loading...'}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyWebhookUrl}
                  disabled={!config?.webhook_url}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook Script</CardTitle>
              <CardDescription>
                Use this script in Zabbix Media Type configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-sm">
                  <code>{config?.media_type_config?.script || 'Loading...'}</code>
                </pre>
              </div>

              <div className="flex gap-2">
                <Button onClick={copyWebhookUrl} disabled={!config}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy URL
                </Button>
                <Button variant="outline" onClick={downloadScript} disabled={!config}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Script
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Media Type Parameters</CardTitle>
              <CardDescription>
                Parameters to configure in Zabbix Media Type
              </CardDescription>
            </CardHeader>
            <CardContent>
              {config?.media_type_config?.parameters ? (
                <div className="space-y-2">
                  {config.media_type_config.parameters.map((param: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <span className="font-mono text-sm">{param.name}</span>
                      <code className="text-sm text-muted-foreground">{param.value}</code>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading parameters...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>
                Last {events.length} events from Zabbix monitoring
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
                        <Badge variant={severityColors[event.severity] || 'secondary'}>
                          {event.severity}
                        </Badge>
                        <div>
                          <p className="font-medium">{event.trigger_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Host: {event.host_name || 'Unknown'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={
                            event.status === 'PROBLEM' ? 'destructive' : 'success'
                          }
                        >
                          {event.status}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guide">
          <Card>
            <CardHeader>
              <CardTitle>Configuration Guide</CardTitle>
              <CardDescription>
                Step-by-step guide to configure Zabbix integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Step 1: Create Media Type</h3>
                  <ol className="mt-2 list-inside list-decimal space-y-1 text-sm">
                    <li>Go to Administration → Media types in Zabbix</li>
                    <li>Click "Create media type"</li>
                    <li>Type: Select "Webhook"</li>
                    <li>Name: Enter "WhatsApp Gateway"</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold">Step 2: Configure Parameters</h3>
                  <p className="mt-2 text-sm">
                    Add the parameters listed in the "Setup" tab above. Each parameter should
                    use the Zabbix macros provided.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold">Step 3: Add Script</h3>
                  <p className="mt-2 text-sm">
                    Copy the webhook script from the "Setup" tab and paste it into the Script
                    field in Zabbix Media Type configuration.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold">Step 4: Configure User Media</h3>
                  <ol className="mt-2 list-inside list-decimal space-y-1 text-sm">
                    <li>Go to Administration → Users</li>
                    <li>Select your user or create a new one</li>
                    <li>Go to Media tab</li>
                    <li>Add media: Select "WhatsApp Gateway" type</li>
                    <li>Send to: Enter any value (not used but required)</li>
                    <li>Configure severity levels to receive</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold">Step 5: Configure Actions</h3>
                  <ol className="mt-2 list-inside list-decimal space-y-1 text-sm">
                    <li>Go to Configuration → Actions → Trigger actions</li>
                    <li>Create or edit an action</li>
                    <li>In Operations tab, add operation</li>
                    <li>Operation type: Send message</li>
                    <li>Send to users: Select your user</li>
                    <li>Send only to: WhatsApp Gateway</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold">Step 6: Test</h3>
                  <p className="mt-2 text-sm">
                    Trigger a test alert in Zabbix and check if you receive the WhatsApp
                    notification.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> Make sure your Zabbix server can access the webhook
                  URL and your WhatsApp instance is connected.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
