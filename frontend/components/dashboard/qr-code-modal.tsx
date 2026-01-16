'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle } from 'lucide-react';
import { instanceService } from '@/services/instance.service';
import { showToast } from '@/components/ui/toaster';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
  instanceName: string;
}

export function QRCodeModal({ isOpen, onClose, instanceId, instanceName }: QRCodeModalProps) {
  const [qrCode, setQrCode] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState<number>(60);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch QR Code
  const fetchQRCode = async () => {
    setIsLoading(true);
    try {
      const response = await instanceService.connectInstance(instanceId);
      
      if (response.success && response.data) {
        if (response.data.qr_code) {
          setQrCode(response.data.qr_code);
          setExpiresAt(response.data.expires_at || '');
          setCountdown(60);
        } else {
          showToast.error('QR code not available');
        }
      }
    } catch (error: any) {
      showToast.error(error?.error?.message || 'Failed to get QR code');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (isOpen && !isConnected) {
      fetchQRCode();
    }
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || isConnected) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Auto refresh QR when expired
          fetchQRCode();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isConnected]);

  // Check connection status
  useEffect(() => {
    if (!isOpen) return;

    const checkStatus = setInterval(async () => {
      try {
        const response = await instanceService.getInstanceStatus(instanceId);
        
        if (response.success && response.data?.status === 'connected') {
          setIsConnected(true);
          showToast.success('Instance connected successfully!');
          
          // Close modal after 2 seconds
          setTimeout(() => {
            onClose();
          }, 2000);
        }
      } catch (error) {
        // Ignore errors during status check
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(checkStatus);
  }, [isOpen, instanceId]);

  const handleClose = () => {
    setQrCode('');
    setExpiresAt('');
    setCountdown(60);
    setIsConnected(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect WhatsApp Instance</DialogTitle>
          <DialogDescription>
            Scan the QR code below with your WhatsApp mobile app
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instance Name */}
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm font-medium">Instance: {instanceName}</p>
          </div>

          {/* QR Code Display */}
          <div className="flex flex-col items-center justify-center space-y-4">
            {isConnected ? (
              <div className="flex flex-col items-center space-y-4 py-8">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-green-600">Connected!</p>
                  <p className="text-sm text-muted-foreground">
                    Your WhatsApp instance is now connected
                  </p>
                </div>
              </div>
            ) : qrCode ? (
              <>
                <div className="rounded-lg border-4 border-primary/20 bg-white p-4">
                  <QRCodeSVG
                    value={qrCode}
                    size={256}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                {/* Countdown */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    QR code expires in{' '}
                    <span className="font-bold text-primary">{countdown}s</span>
                  </p>
                  <div className="mt-2 h-1 w-64 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(countdown / 60) * 100}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-64 w-64 items-center justify-center">
                {isLoading ? (
                  <div className="text-center">
                    <div className="spinner mb-4" />
                    <p className="text-sm text-muted-foreground">Loading QR code...</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No QR code available</p>
                )}
              </div>
            )}
          </div>

          {/* Instructions */}
          {!isConnected && (
            <div className="rounded-lg bg-muted p-4">
              <p className="mb-2 font-semibold">Instructions:</p>
              <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                <li>Open WhatsApp on your phone</li>
                <li>Go to Settings → Linked Devices</li>
                <li>Tap "Link a Device"</li>
                <li>Scan this QR code</li>
              </ol>
            </div>
          )}

          {/* Actions */}
          {!isConnected && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={fetchQRCode}
                disabled={isLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh QR
              </Button>
              <Button variant="ghost" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
