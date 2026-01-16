'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useInstanceStore } from '@/store/instance.store';
import { messageService } from '@/services/message.service';
import { showToast } from '@/components/ui/toaster';
import { Send, RefreshCw, Filter, Download } from 'lucide-react';
import { MessageLog, MessageStatus } from '@/types';
import { formatDate, formatPhoneNumber } from '@/lib/utils';

const statusConfig: Record<MessageStatus, { label: string; variant: any }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  sent: { label: 'Sent', variant: 'info' },
  delivered: { label: 'Delivered', variant: 'success' },
  read: { label: 'Read', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  deleted: { label: 'Deleted', variant: 'secondary' },
};

export default function MessagesPage() {
  const { instances, fetchInstances } = useInstanceStore();
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Send form state
  const [selectedInstance, setSelectedInstance] = useState('');
  const [recipient, setRecipient] = useState('');
  const [messageText, setMessageText] = useState('');

  // Filter state
  const [filterStatus, setFilterStatus] = useState<MessageStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchInstances();
    loadMessages();
  }, []);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const response = await messageService.getMessages({
        limit: 50,
        offset: 0,
      });

      if (response.success && response.data) {
        setMessages(response.data.data);
      }
    } catch (error: any) {
      showToast.error(error?.error?.message || 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedInstance) {
      showToast.error('Please select an instance');
      return;
    }

    if (!recipient.trim()) {
      showToast.error('Please enter recipient number');
      return;
    }

    if (!messageText.trim()) {
      showToast.error('Please enter message text');
      return;
    }

    setIsSending(true);
    try {
      const response = await messageService.sendMessage({
        instance_id: selectedInstance,
        to: formatPhoneNumber(recipient),
        message: messageText,
      });

      if (response.success) {
        showToast.success('Message sent successfully!');
        setRecipient('');
        setMessageText('');
        loadMessages(); // Reload messages
      }
    } catch (error: any) {
      showToast.error(error?.error?.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const connectedInstances = instances.filter(i => i.status === 'connected');

  const filteredMessages = messages.filter(msg => {
    const matchesStatus = !filterStatus || msg.status === filterStatus;
    const matchesSearch = !searchQuery ||
      msg.to_number?.includes(searchQuery) ||
      msg.from_number?.includes(searchQuery) ||
      msg.message_content?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">
            Send messages and view message history
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadMessages}
          disabled={isLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Send Message Form */}
      <Card>
        <CardHeader>
          <CardTitle>Send Message</CardTitle>
          <CardDescription>
            Send a WhatsApp message to any number
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Instance Selection */}
            <div className="space-y-2">
              <Label htmlFor="instance">Instance</Label>
              <select
                id="instance"
                value={selectedInstance}
                onChange={(e) => setSelectedInstance(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSending}
              >
                <option value="">Select instance...</option>
                {connectedInstances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name} ({instance.phone_number || instance.instance_name})
                  </option>
                ))}
              </select>
              {connectedInstances.length === 0 && (
                <p className="text-xs text-destructive">
                  No connected instances available
                </p>
              )}
            </div>

            {/* Recipient */}
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Number</Label>
              <Input
                id="recipient"
                placeholder="628123456789 or 08123456789"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={isSending}
              />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              placeholder="Enter your message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={isSending}
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">
              Characters: {messageText.length}
            </p>
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={isSending || !selectedInstance || !recipient || !messageText}
          >
            {isSending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Message History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Message History</CardTitle>
              <CardDescription>
                Recent messages sent from your instances
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as MessageStatus | '')}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Status</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="read">Read</option>
                <option value="failed">Failed</option>
              </select>
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="spinner" />
            </div>
          ) : filteredMessages.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMessages.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell className="text-xs">
                        {formatDate(message.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={message.direction === 'outbound' ? 'default' : 'secondary'}>
                          {message.direction}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {message.direction === 'outbound' ? message.to_number : message.from_number}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {message.message_content || <span className="text-muted-foreground italic">Media message</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[message.status].variant}>
                          {statusConfig[message.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {message.message_type}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No messages found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
