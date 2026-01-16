'use client';

import { Package } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PackageCardProps {
  package: Package;
  isPopular?: boolean;
  onSelect?: (pkg: Package) => void;
  isSelected?: boolean;
  isCurrentPlan?: boolean;
}

export function PackageCard({
  package: pkg,
  isPopular = false,
  onSelect,
  isSelected = false,
  isCurrentPlan = false,
}: PackageCardProps) {
  const features = pkg.features;

  const featureList = [
    { label: `${features.max_instances} WhatsApp Instance${features.max_instances > 1 ? 's' : ''}`, enabled: true },
    { label: `${features.max_messages_per_day} Messages/Day`, enabled: true },
    { label: `${features.max_messages_per_month.toLocaleString()} Messages/Month`, enabled: true },
    { label: 'API Access', enabled: features.has_api_access },
    { label: 'Webhook Integration', enabled: features.has_webhook },
    { label: 'Bulk Messaging', enabled: features.has_bulk_messaging },
    { label: 'Analytics Dashboard', enabled: features.has_analytics },
    { label: `${features.max_olts} OLT Monitoring`, enabled: features.max_olts > 0 },
    { label: 'Priority Support', enabled: features.has_priority_support },
    { label: 'Custom Domain', enabled: features.has_custom_domain },
  ];

  return (
    <Card
      className={cn(
        'relative card-hover',
        isPopular && 'border-primary shadow-lg',
        isSelected && 'ring-2 ring-primary',
        isCurrentPlan && 'border-green-500'
      )}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground px-4 py-1">
            <Zap className="mr-1 h-3 w-3" />
            Most Popular
          </Badge>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <Badge variant="success" className="px-3 py-1">
            Current Plan
          </Badge>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl">{pkg.name}</CardTitle>
            <CardDescription className="mt-1">{pkg.description}</CardDescription>
          </div>
          {pkg.is_trial && (
            <Badge variant="secondary">Trial</Badge>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-baseline">
            <span className="text-4xl font-bold">
              {pkg.formatted_price || new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
              }).format(pkg.price)}
            </span>
            <span className="ml-2 text-muted-foreground">
              /{pkg.duration_days} days
            </span>
          </div>
          {pkg.price > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              ~{new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
              }).format(pkg.price / (pkg.duration_days / 30))}/month
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pb-6">
        <ul className="space-y-3">
          {featureList.map((feature, index) => (
            <li
              key={index}
              className={cn(
                'flex items-start',
                !feature.enabled && 'opacity-40'
              )}
            >
              <Check
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  feature.enabled ? 'text-green-600' : 'text-muted-foreground'
                )}
              />
              <span className={cn(
                'text-sm',
                !feature.enabled && 'line-through'
              )}>
                {feature.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        {isCurrentPlan ? (
          <Button variant="outline" className="w-full" disabled>
            Current Plan
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={() => onSelect?.(pkg)}
            variant={isPopular ? 'default' : 'outline'}
          >
            {pkg.is_trial ? 'Start Free Trial' : 'Select Plan'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
