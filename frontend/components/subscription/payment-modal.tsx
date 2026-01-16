'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { subscriptionService } from '@/services/subscription.service';
import { showToast } from '@/components/ui/toaster';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  snapToken: string;
  amount: number;
  invoiceNumber: string;
  onSuccess?: () => void;
}

// Midtrans Snap types
declare global {
  interface Window {
    snap?: {
      pay: (
        snapToken: string,
        options?: {
          onSuccess?: (result: any) => void;
          onPending?: (result: any) => void;
          onError?: (result: any) => void;
          onClose?: () => void;
        }
      ) => void;
      hide: () => void;
    };
  }
}

export function PaymentModal({
  isOpen,
  onClose,
  transactionId,
  snapToken,
  amount,
  invoiceNumber,
  onSuccess,
}: PaymentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Load Midtrans Snap script
  useEffect(() => {
    if (!isOpen) return;

    const script = document.createElement('script');
    script.src = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '');
    
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [isOpen]);

  // Open Snap payment
  const openSnapPayment = () => {
    if (!window.snap) {
      showToast.error('Payment system not loaded. Please refresh the page.');
      return;
    }

    setIsLoading(true);

    window.snap.pay(snapToken, {
      onSuccess: (result) => {
        console.log('Payment success:', result);
        setPaymentStatus('success');
        showToast.success('Payment successful!');
        
        // Check status with backend
        checkPaymentStatus();
      },
      onPending: (result) => {
        console.log('Payment pending:', result);
        setPaymentStatus('pending');
        showToast.info('Payment is being processed. Please wait...');
        
        // Check status
        checkPaymentStatus();
      },
      onError: (result) => {
        console.error('Payment error:', result);
        setPaymentStatus('failed');
        showToast.error('Payment failed. Please try again.');
        setIsLoading(false);
      },
      onClose: () => {
        console.log('Payment popup closed');
        if (!paymentStatus) {
          showToast.info('Payment cancelled');
        }
        setIsLoading(false);
      },
    });
  };

  // Check payment status with backend
  const checkPaymentStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const response = await subscriptionService.checkPaymentStatus(transactionId);
      
      if (response.success && response.data) {
        const transaction = response.data;
        
        if (transaction.status === 'paid') {
          setPaymentStatus('success');
          showToast.success('Payment confirmed! Your subscription is now active.');
          
          // Call success callback
          if (onSuccess) {
            onSuccess();
          }
          
          // Close modal after 2 seconds
          setTimeout(() => {
            onClose();
          }, 2000);
        } else if (transaction.status === 'failed' || transaction.status === 'expired') {
          setPaymentStatus('failed');
        } else {
          setPaymentStatus('pending');
          
          // Retry checking after 3 seconds
          setTimeout(() => {
            checkPaymentStatus();
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Check payment status error:', error);
    } finally {
      setIsCheckingStatus(false);
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (window.snap) {
      window.snap.hide();
    }
    setPaymentStatus(null);
    setIsLoading(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogDescription>
            Invoice: {invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount Display */}
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">Amount to Pay</p>
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
              }).format(amount)}
            </p>
          </div>

          {/* Payment Status */}
          {paymentStatus && (
            <div className="flex flex-col items-center space-y-4 py-4">
              {paymentStatus === 'success' && (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle className="h-10 w-10 text-green-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-green-600">Payment Successful!</p>
                    <p className="text-sm text-muted-foreground">
                      Your subscription is now active
                    </p>
                  </div>
                </>
              )}

              {paymentStatus === 'pending' && (
                <>
                  <Loader2 className="h-16 w-16 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="text-lg font-semibold">Processing Payment...</p>
                    <p className="text-sm text-muted-foreground">
                      {isCheckingStatus ? 'Verifying payment status...' : 'Please wait'}
                    </p>
                  </div>
                </>
              )}

              {paymentStatus === 'failed' && (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <XCircle className="h-10 w-10 text-red-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-red-600">Payment Failed</p>
                    <p className="text-sm text-muted-foreground">
                      Please try again or contact support
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Payment Instructions */}
          {!paymentStatus && (
            <div className="rounded-lg bg-muted p-4">
              <p className="mb-2 font-semibold">Payment Instructions:</p>
              <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                <li>Click "Pay Now" button below</li>
                <li>Select your preferred payment method</li>
                <li>Complete the payment</li>
                <li>Wait for confirmation</li>
              </ol>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {!paymentStatus && (
              <Button
                className="flex-1"
                onClick={openSnapPayment}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Pay Now'
                )}
              </Button>
            )}

            {paymentStatus === 'failed' && (
              <Button
                className="flex-1"
                onClick={openSnapPayment}
              >
                Try Again
              </Button>
            )}

            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={isLoading || paymentStatus === 'pending'}
            >
              {paymentStatus === 'success' ? 'Close' : 'Cancel'}
            </Button>
          </div>

          {/* Help Text */}
          <p className="text-center text-xs text-muted-foreground">
            Secure payment powered by Midtrans
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
