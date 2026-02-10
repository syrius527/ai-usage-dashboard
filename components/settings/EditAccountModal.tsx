'use client';

import { useState, useEffect } from 'react';
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
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { validateOAuthToken, validateAccountName, type AccountWithUsage } from '@/types/account';

interface EditAccountModalProps {
  open: boolean;
  account: AccountWithUsage | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditAccountModal({
  open,
  account,
  onOpenChange,
  onSuccess,
}: EditAccountModalProps) {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [hasTokenChange, setHasTokenChange] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>(
    'idle'
  );
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setToken('');
      setHasTokenChange(false);
      setVerifyStatus('idle');
      setVerifyError(null);
      setSaving(false);
      setSaveError(null);
    }
  }, [account]);

  const handleClose = () => {
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

    try {
      const response = await fetch('/api/accounts/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.success) {
        setVerifyStatus('success');
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
    if (!account) return;

    const nameValidation = validateAccountName(name);
    if (!nameValidation.valid) {
      setSaveError(nameValidation.error!);
      return;
    }

    setSaving(true);
    setSaveError(null);

    const body: Record<string, string> = {};
    if (name !== account.name) body.name = name;
    if (hasTokenChange && token) body.token = token;

    if (Object.keys(body).length === 0) {
      handleClose();
      return;
    }

    const requestBody = JSON.stringify(body);
    if (hasTokenChange) setToken('');

    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      const data = await response.json();

      if (data.success) {
        handleClose();
        onSuccess();
      } else {
        setSaveError(data.error?.message || 'Failed to update account');
      }
    } catch {
      setSaveError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    name.trim().length > 0 && (!hasTokenChange || (token.length > 20 && verifyStatus === 'success'));
  const canVerify = hasTokenChange && token.length > 20;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>Update account details for {account?.name}.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Account Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">OAuth Token</label>
            {!hasTokenChange ? (
              <div className="flex items-center gap-2">
                <Input disabled value={account?.tokenHint || ''} className="font-mono" />
                <Button variant="outline" size="sm" onClick={() => setHasTokenChange(true)}>
                  Change
                </Button>
              </div>
            ) : (
              <Input
                type="password"
                placeholder="sk-ant-oat01-..."
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setVerifyStatus('idle');
                  setVerifyError(null);
                }}
              />
            )}
          </div>

          {verifyStatus === 'success' && (
            <Alert variant="success">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Token verified successfully</AlertDescription>
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
          {hasTokenChange && (
            <Button
              variant="outline"
              onClick={handleVerify}
              disabled={!canVerify || verifyStatus === 'verifying'}
            >
              {verifyStatus === 'verifying' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify Token
            </Button>
          )}
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
