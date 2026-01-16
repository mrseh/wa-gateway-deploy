'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InstanceCard } from '@/components/dashboard/instance-card';
import { QRCodeModal } from '@/components/dashboard/qr-code-modal';
import { useInstanceStore } from '@/store/instance.store';
import { showToast } from '@/components/ui/toaster';
import { Plus, Search, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Instance } from '@/types';

export default function InstancesPage() {
  const { instances, isLoading, fetchInstances, createInstance, disconnectInstance, restartInstance } = useInstanceStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [qrModalState, setQrModalState] = useState<{
    isOpen: boolean;
    instanceId: string;
    instanceName: string;
  }>({
    isOpen: false,
    instanceId: '',
    instanceName: '',
  });

  useEffect(() => {
    fetchInstances();
  }, []);

  const filteredInstances = instances.filter((instance) =>
    instance.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    instance.phone_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      showToast.error('Please enter instance name');
      return;
    }

    setIsCreating(true);
    try {
      const instance = await createInstance(newInstanceName);
      showToast.success('Instance created successfully!');
      setIsCreateModalOpen(false);
      setNewInstanceName('');
      
      // Open QR modal for new instance
      setQrModalState({
        isOpen: true,
        instanceId: instance.id,
        instanceName: instance.name,
      });
    } catch (error: any) {
      const message = error?.error?.message || 'Failed to create instance';
      showToast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleConnect = (instance: Instance) => {
    setQrModalState({
      isOpen: true,
      instanceId: instance.id,
      instanceName: instance.name,
    });
  };

  const handleDisconnect = async (instance: Instance) => {
    try {
      await disconnectInstance(instance.id);
      showToast.success('Instance disconnected');
    } catch (error: any) {
      showToast.error(error?.error?.message || 'Failed to disconnect');
    }
  };

  const handleRestart = async (instance: Instance) => {
    try {
      await restartInstance(instance.id);
      showToast.success('Instance restarting...');
    } catch (error: any) {
      showToast.error(error?.error?.message || 'Failed to restart');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Instances</h1>
          <p className="text-muted-foreground">
            Manage your WhatsApp instances
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fetchInstances()}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Instance
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search instances..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Instances Grid */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="spinner mb-4" />
            <p className="text-muted-foreground">Loading instances...</p>
          </div>
        </div>
      ) : filteredInstances.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredInstances.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              onConnect={() => handleConnect(instance)}
              onDisconnect={() => handleDisconnect(instance)}
              onRestart={() => handleRestart(instance)}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed">
          <p className="mb-2 text-lg font-medium">No instances found</p>
          <p className="mb-4 text-sm text-muted-foreground">
            {searchQuery ? 'Try adjusting your search' : 'Create your first instance to get started'}
          </p>
          {!searchQuery && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Instance
            </Button>
          )}
        </div>
      )}

      {/* Create Instance Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Instance</DialogTitle>
            <DialogDescription>
              Create a new WhatsApp instance to start sending messages
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="instance-name">Instance Name</Label>
              <Input
                id="instance-name"
                placeholder="My WhatsApp Instance"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateInstance();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Give your instance a memorable name
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false);
                setNewInstanceName('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateInstance} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Instance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={qrModalState.isOpen}
        onClose={() => {
          setQrModalState({ isOpen: false, instanceId: '', instanceName: '' });
          fetchInstances(); // Refresh instances after connection
        }}
        instanceId={qrModalState.instanceId}
        instanceName={qrModalState.instanceName}
      />
    </div>
  );
}
