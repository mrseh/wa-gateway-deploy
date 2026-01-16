'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package } from '@/types';
import { subscriptionService } from '@/services/subscription.service';
import { PackageCard } from '@/components/subscription/package-card';
import { PaymentModal } from '@/components/subscription/payment-modal';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { showToast } from '@/components/ui/toaster';

export default function PackagesPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const response = await subscriptionService.getPackages();
      if (response.success) {
        setPackages(response.data);
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to load packages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPackage = async (pkg: Package) => {
    setSelectedPackage(pkg);
    setIsSubscribing(true);

    try {
      const response = await subscriptionService.subscribe({
        package_id: pkg.id,
        duration_months: 1,
      });

      if (response.success) {
        setPaymentData(response.data);
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to create subscription');
      setIsSubscribing(false);
      setSelectedPackage(null);
    }
  };

  const handlePaymentSuccess = () => {
    showToast.success('Payment successful! Redirecting...');
    setTimeout(() => {
      router.push('/dashboard/subscription');
    }, 2000);
  };

  const handleClosePayment = () => {
    setPaymentData(null);
    setSelectedPackage(null);
    setIsSubscribing(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Choose Your Plan</h1>
          <p className="mt-2 text-muted-foreground">
            Select the perfect plan for your business needs
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {packages.map((pkg, index) => (
          <PackageCard
            key={pkg.id}
            package={pkg}
            isPopular={index === 1}
            onSelect={handleSelectPackage}
            isSelected={selectedPackage?.id === pkg.id}
          />
        ))}
      </div>

      {paymentData && (
        <PaymentModal
          isOpen={!!paymentData}
          onClose={handleClosePayment}
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
