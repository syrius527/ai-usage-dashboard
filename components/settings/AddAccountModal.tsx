'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { validateOAuthToken, validateAccountName } from '@/types/account';
import { validateRefreshToken } from '@/lib/anthropic';

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type VerifyStatus = 'idle' | 'verifying' | 'success' | 'error';

interface VerifyResult {
  fiveHour: { utilization: number } | null;
  sevenDay: { utilization: number } | null;
}

export function AddAccountModal({ open, onOpenChange, onSuccess }: AddAccountModalProps) {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [showAutoRefresh, setShowAutoRefresh] = useState(false);
  const [refreshTokenError, setRefreshTokenError] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setToken('');
    setRefreshToken('');
    setShowAutoRefresh(false);
    setRefreshTokenError(null);
    setVerifyStatus('idle');
    setVerifyError(null);
    setVerifyResult(null);
    setSaving(false);
    setSaveError(null);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleVerify = async () => {
    const tokenValidation = validateOAuthToken(token);
    if (!tokenValidation.valid) {
      setVerifyStatus('error');
      setVerifyError(tokenValidation.error!);
      return;
    }

    setVerifyStatus('verifying');
    setVerifyError(null);
    setVerifyResult(null);

    try {
      const response = await fetch('/api/accounts/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.success) {
        setVerifyStatus('success');
        setVerifyResult(data.usage);
      } else {
        setVerifyStatus('error');
        setVerifyError(data.error?.message || 'Token verification failed');
      }
    } catch {
      setVerifyStatus('error');
      setVerifyError('Network error');
    }
  };

  const handleSave = async () => {
    const nameValidation = validateAccountName(name);
    if (!nameValidation.valid) {
      setSaveError(nameValidation.error!);
      return;
    }

    if (refreshToken) {
      const refreshValidation = validateRefreshToken(refreshToken);
      if (!refreshValidation.valid) {
        setRefreshTokenError(refreshValidation.error!);
        return;
      }
    }

    setSaving(true);
    setSaveError(null);

    const requestBody = JSON.stringify({
      name,
      token,
      refreshToken: refreshToken || undefined,
    });
    setToken('');
    setRefreshToken('');

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      const data = await response.json();

      if (data.success) {
        handleClose();
        onSuccess();
      } else {
        setSaveError(data.error?.message || 'Failed to save account');
      }
    } catch {
      setSaveError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const canVerify = token.length > 20;
  const canSave = name.trim().length > 0 && verifyStatus === 'success';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
          <DialogDescription>Add a Claude Code OAuth token to monitor usage.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Account Name</label>
            <Input
              placeholder="e.g., Personal, Work"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">OAuth Token</label>
            <Input
              type="password"
              placeholder="sk-ant-oat01-..."
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setVerifyStatus('idle');
                setVerifyError(null);
                setVerifyResult(null);
              }}
            />
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Get your OAuth token from Claude Code credentials:
                <code className="block mt-1 text-[10px] bg-muted p-1 rounded">
                  security find-generic-password -s &quot;Claude Code-credentials&quot; -w | jq -r
                  &apos;.claudeAiOauth.accessToken&apos;
                </code>
              </AlertDescription>
            </Alert>
          </div>

          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setShowAutoRefresh(!showAutoRefresh)}
              className="flex items-center gap-2 w-full p-3 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
            >
              {showAutoRefresh ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Auto-Refresh (Optional)
            </button>
            {showAutoRefresh && (
              <div className="px-3 pb-3 grid gap-2">
                <Input
                  type="password"
                  placeholder="sk-ant-ort01-..."
                  value={refreshToken}
                  onChange={(e) => {
                    setRefreshToken(e.target.value);
                    setRefreshTokenError(null);
                  }}
                />
                {refreshTokenError && (
                  <p className="text-xs text-destructive">{refreshTokenError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Add a refresh token to automatically renew access when it expires (~8h).
                  Get it with: <code className="bg-muted px-1 rounded">.claudeAiOauth.refreshToken</code>
                </p>
              </div>
            )}
          </div>

          {verifyStatus === 'success' && verifyResult && (
            <Alert variant="success">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">Token verified!</span>
                <div className="mt-1 text-xs space-y-0.5">
                  {verifyResult.fiveHour && (
                    <div>5-hour limit: {verifyResult.fiveHour.utilization.toFixed(1)}%</div>
                  )}
                  {verifyResult.sevenDay && (
                    <div>7-day limit: {verifyResult.sevenDay.utilization.toFixed(1)}%</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {verifyStatus === 'error' && verifyError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{verifyError}</AlertDescription>
            </Alert>
          )}

          {saveError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleVerify}
            disabled={!canVerify || verifyStatus === 'verifying'}
          >
            {verifyStatus === 'verifying' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify Token
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
