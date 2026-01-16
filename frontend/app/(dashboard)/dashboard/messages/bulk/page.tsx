'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, Send, CheckCircle, XCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { showToast } from '@/components/ui/toaster';

export default function BulkMessagePage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Upload, 2: Preview, 3: Template, 4: Send, 5: Progress
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any>(null);
  const [template, setTemplate] = useState('');
  const [batchName, setBatchName] = useState('');
  const [delay, setDelay] = useState(2000);
  const [batchId, setBatchId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Step 1: Upload CSV
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      showToast.error('Please select a CSV file');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('csv', file);

      const response = await apiClient.post('/bulk-messages/upload-csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.success) {
        setCsvData(response.data);
        setStep(2);
        showToast.success('CSV uploaded successfully!');
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to upload CSV');
    } finally {
      setIsUploading(false);
    }
  };

  const downloadSample = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bulk-messages/sample-csv`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bulk-message-sample.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      showToast.error('Failed to download sample');
    }
  };

  // Step 4: Send
  const handleSend = async () => {
    if (!template.trim()) {
      showToast.error('Please enter a message template');
      return;
    }

    setIsSending(true);

    try {
      const response = await apiClient.post('/bulk-messages/send', {
        instance_id: csvData.instance_id, // Should be selected in UI
        template,
        batch_name: batchName || `Bulk ${new Date().toLocaleDateString()}`,
        delay,
        recipients: csvData.preview, // In production, send all valid recipients
      });

      if (response.success) {
        setBatchId(response.data.bulk_message_id);
        setStep(5);
        showToast.success('Bulk message started!');
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to send bulk message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bulk Messaging</h1>
          <p className="mt-2 text-muted-foreground">
            Send messages to multiple recipients at once
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard/messages/bulk/history')}>
          View History
        </Button>
      </div>

      {/* Progress Steps */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Upload CSV' },
              { num: 2, label: 'Preview' },
              { num: 3, label: 'Template' },
              { num: 4, label: 'Send' },
              { num: 5, label: 'Progress' },
            ].map((s, index) => (
              <div key={s.num} className="flex items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    step >= s.num
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step > s.num ? <CheckCircle className="h-5 w-5" /> : s.num}
                </div>
                <span className="ml-2 text-sm font-medium">{s.label}</span>
                {index < 4 && (
                  <div className="mx-4 h-0.5 w-12 bg-muted" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Upload CSV */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Upload a CSV file with phone numbers and custom fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                CSV should have at least a "phone" or "number" column. Additional columns can be
                used as template variables.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="csv">CSV File</Label>
              <Input
                id="csv"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={!file || isUploading}>
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? 'Uploading...' : 'Upload CSV'}
              </Button>
              <Button variant="outline" onClick={downloadSample}>
                <Download className="mr-2 h-4 w-4" />
                Download Sample
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 2 && csvData && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Data</CardTitle>
            <CardDescription>Review the uploaded data before sending</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total Rows</p>
                <p className="text-2xl font-bold">{csvData.stats.total}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Valid</p>
                <p className="text-2xl font-bold text-green-600">{csvData.stats.valid}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Invalid</p>
                <p className="text-2xl font-bold text-red-600">{csvData.stats.invalid}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Duplicates</p>
                <p className="text-2xl font-bold text-yellow-600">{csvData.stats.duplicates}</p>
              </div>
            </div>

            {/* Preview */}
            <div>
              <h4 className="mb-2 font-semibold">Preview (First 5 Records)</h4>
              <div className="space-y-2">
                {csvData.preview.map((record: any, index: number) => (
                  <div key={index} className="rounded-lg border p-3">
                    <p className="font-medium">{record.phone}</p>
                    {record.name && <p className="text-sm text-muted-foreground">{record.name}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Errors */}
            {csvData.errors && csvData.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <p className="font-semibold">Found {csvData.errors.length} errors:</p>
                  <ul className="mt-2 list-inside list-disc text-sm">
                    {csvData.errors.slice(0, 5).map((error: any, index: number) => (
                      <li key={index}>
                        Row {error.row}: {error.errors.join(', ')}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={csvData.stats.valid === 0}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Template */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Create Message Template</CardTitle>
            <CardDescription>
              Use variables like {`{{name}}`}, {`{{phone}}`} from your CSV
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batchName">Batch Name</Label>
              <Input
                id="batchName"
                placeholder="e.g., January Promo"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">Message Template</Label>
              <Textarea
                id="template"
                placeholder="Hello {{name}}, your account {{phone}} is ready!"
                rows={6}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use {`{{variable}}`} to insert data from CSV columns
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delay">Delay Between Messages (ms)</Label>
              <Input
                id="delay"
                type="number"
                value={delay}
                onChange={(e) => setDelay(parseInt(e.target.value))}
                min={1000}
                max={10000}
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 2000ms (2 seconds) to avoid rate limiting
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => setStep(4)} disabled={!template.trim()}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirm & Send */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm & Send</CardTitle>
            <CardDescription>Review and send your bulk message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p>
                <strong>Batch Name:</strong> {batchName || 'Untitled'}
              </p>
              <p>
                <strong>Recipients:</strong> {csvData?.stats.valid} numbers
              </p>
              <p>
                <strong>Delay:</strong> {delay}ms between messages
              </p>
              <div>
                <strong>Template:</strong>
                <pre className="mt-2 whitespace-pre-wrap rounded bg-background p-2 text-sm">
                  {template}
                </pre>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                This will send {csvData?.stats.valid} messages. Make sure you have sufficient quota
                in your subscription.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleSend} disabled={isSending}>
                <Send className="mr-2 h-4 w-4" />
                {isSending ? 'Sending...' : 'Send Bulk Message'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Progress */}
      {step === 5 && batchId && (
        <Card>
          <CardHeader>
            <CardTitle>Sending In Progress</CardTitle>
            <CardDescription>Batch ID: {batchId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Your bulk message is being processed. You can close this page and check the status
                in the history page.
              </AlertDescription>
            </Alert>

            <Button onClick={() => router.push('/dashboard/messages/bulk/history')}>
              View History
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
