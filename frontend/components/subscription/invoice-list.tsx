'use client';

import { Transaction } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Eye, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface InvoiceListProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onViewInvoice?: (transaction: Transaction) => void;
  onDownloadInvoice?: (transaction: Transaction) => void;
  onRetryPayment?: (transaction: Transaction) => void;
}

const statusConfig: Record<string, { label: string; variant: any }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  processing: { label: 'Processing', variant: 'info' },
  paid: { label: 'Paid', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
  refunded: { label: 'Refunded', variant: 'warning' },
  expired: { label: 'Expired', variant: 'secondary' },
};

export function InvoiceList({
  transactions,
  isLoading = false,
  onViewInvoice,
  onDownloadInvoice,
  onRetryPayment,
}: InvoiceListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Loading transactions...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center">
            <div className="spinner" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Your payment history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 flex-col items-center justify-center text-center">
            <p className="text-muted-foreground">No transactions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your payment history will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>
          {transactions.length} transaction{transactions.length > 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => {
                const config = statusConfig[transaction.status] || statusConfig.pending;
                const canRetry = transaction.status === 'failed' || transaction.status === 'expired';

                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-mono text-sm">
                      {transaction.invoice_number}
                    </TableCell>

                    <TableCell className="text-sm">
                      {formatDate(transaction.created_at)}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {transaction.package?.name || 'Unknown'}
                        </span>
                        {transaction.duration_months > 1 && (
                          <span className="text-xs text-muted-foreground">
                            {transaction.duration_months} months
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="font-medium">
                      {transaction.formatted_amount}
                    </TableCell>

                    <TableCell>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {onViewInvoice && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onViewInvoice(transaction)}
                            title="View Invoice"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}

                        {onDownloadInvoice && transaction.status === 'paid' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDownloadInvoice(transaction)}
                            title="Download Invoice"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}

                        {onRetryPayment && canRetry && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRetryPayment(transaction)}
                            title="Retry Payment"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
