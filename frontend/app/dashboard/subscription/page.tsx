'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Subscription, Transaction } from '@/types';
import { subscriptionService } from '@/services/subscription.service';
import { SubscriptionStatus } from '@/components/subscription/subscription-status';
import { InvoiceList } from '@/components/subscription/invoice-list';
import { PaymentModal } from '@/components/subscription/payment-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, MessageSquare, Wifi, Database, TrendingUp } from 'lucide-react';
import { showToast } from '@/components/ui/toaster';

export default function SubscriptionPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [quota, setQuota] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentData, setPaymentData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [subResponse, quotaResponse, invoicesResponse] = await Promise.all([
        subscriptionService.getMySubscription(),
        subscriptionService.getQuota(),
        subscriptionService.getInvoices(10, 0),
      ]);

      if (subResponse.success) {
        setSubscription(subResponse.data);
      }

      if (quotaResponse.success) {
        setQuota(quotaResponse.data);
      }

      if (invoicesResponse.success) {
        setTransactions(invoicesResponse.data.transactions);
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to load subscription data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenew = async () => {
    if (!subscription) return;

    try {
      const response = await subscriptionService.renewSubscription(subscription.id);
      if (response.success) {
        setPaymentData(response.data);
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to renew subscription');
    }
  };

  const handleUpgrade = () => {
    router.push('/dashboard/subscription/packages');
  };

  const handleCancel = async () => {
    if (!subscription || !confirm('Are you sure you want to cancel your subscription?')) return;

    try {
      await subscriptionService.cancelSubscription(subscription.id);
      showToast.success('Subscription cancelled successfully');
      loadData();
    } catch (error: any) {
      showToast.error(error.message || 'Failed to cancel subscription');
    }
  };

  const handleRetryPayment = async (transaction: Transaction) => {
    try {
      const response = await subscriptionService.retryPayment(transaction.id);
      if (response.success) {
        setPaymentData(response.data);
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to retry payment');
    }
  };

  const handlePaymentSuccess = () => {
    showToast.success('Payment successful!');
    setPaymentData(null);
    loadData();
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Subscription</h1>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="mb-4 text-lg text-muted-foreground">You don't have an active subscription</p>
            <Button onClick={() => router.push('/dashboard/subscription/packages')}>
              Choose a Plan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Subscription</h1>
        {!subscription.is_active && (
          <Button onClick={() => router.push('/dashboard/subscription/packages')}>
            Subscribe Now
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SubscriptionStatus
            subscription={subscription}
            onRenew={handleRenew}
            onUpgrade={handleUpgrade}
            onCancel={handleCancel}
          />
        </div>

        {quota && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Usage Statistics</CardTitle>
                <CardDescription>Current usage vs limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center text-muted-foreground">
                      <Wifi className="mr-2 h-4 w-4" />
                      Instances
                    </span>
                    <span className="font-medium">
                      {quota.usage.instances}/{quota.quota.max_instances}
                    </span>
                  </div>
                  <Progress value={parseFloat(quota.percentage.instances)} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center text-muted-foreground">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Messages Today
                    </span>
                    <span className="font-medium">
                      {quota.usage.messages_today}/{quota.quota.max_messages_per_day}
                    </span>
                  </div>
                  <Progress value={parseFloat(quota.percentage.messages_today)} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center text-muted-foreground">
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Messages This Month
                    </span>
                    <span className="font-medium">
                      {quota.usage.messages_this_month}/{quota.quota.max_messages_per_month}
                    </span>
                  </div>
                  <Progress value={parseFloat(quota.percentage.messages_this_month)} />
                </div>

                {quota.quota.max_olts > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center text-muted-foreground">
                        <Database className="mr-2 h-4 w-4" />
                        OLTs
                      </span>
                      <span className="font-medium">
                        {quota.usage.olts}/{quota.quota.max_olts}
                      </span>
                    </div>
                    <Progress value={(quota.usage.olts / quota.quota.max_olts) * 100} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <InvoiceList
        transactions={transactions}
        onRetryPayment={handleRetryPayment}
      />

      {paymentData && (
        <PaymentModal
          isOpen={!!paymentData}
          onClose={() => setPaymentData(null)}
          transactionId={paymentData.transaction_id}
          snapToken={paymentData.snap_token}
          amount={paymentData.amount}
          invoiceNumber={paymentData.invoice_number}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
