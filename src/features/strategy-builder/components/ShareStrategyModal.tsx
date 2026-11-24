import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import { getErrorMessage } from '@/lib/apiErrors';

import { createShare, deleteShare, listShares, transferOwnership, updateShare } from '../service';
import type { StrategyDetailResponse, StrategyShare, StrategySharePermission } from '../types';

interface ShareStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  strategyId: string;
  strategyName: string;
  /** Caller's role on the strategy. A viewer never gets here (no «Share» button). */
  role: 'owner' | 'co_owner';
  /** Ownership was handed over (#349): the caller is now co_owner. The modal
   *  closes itself; the parent refreshes the lists. */
  onTransferred?: (detail: StrategyDetailResponse) => void;
}

const ROLE_LABEL: Record<StrategySharePermission, string> = {
  viewer: 'Viewer',
  co_owner: 'Co-owner',
};

const CONTROL_CLS =
  'px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] disabled:bg-gray-100 disabled:text-gray-400';

function segClass(active: boolean): string {
  return `flex-1 p-2 rounded-lg border text-sm font-medium transition-colors ${
    active
      ? 'border-[#1e3a5f] bg-[#f0f4fa] text-[#1e3a5f]'
      : 'border-gray-200 text-gray-600 hover:border-gray-300'
  }`;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
      {message}
    </div>
  );
}

/**
 * Manage a strategy's collaborators: invite by email, change/revoke roles.
 * Same flow as `SharePortfolioModal` (copied, not shared — no e2e covers the
 * portfolio modal, see design #348 risk 1). The backend is the source of
 * truth for permissions; the UI only hides what the caller can't do:
 *   - owner    → invite/manage viewers AND co-owners, transfer ownership (#349).
 *   - co_owner → invite/remove ONLY viewers; co-owner rows are read-only.
 * The transfer has an explicit second step naming the strategy and the
 * recipient; nothing is sent before «Confirm transfer».
 */
export function ShareStrategyModal({
  isOpen,
  onClose,
  strategyId,
  strategyName,
  role,
  onTransferred,
}: ShareStrategyModalProps) {
  const isOwner = role === 'owner';

  const [shares, setShares] = useState<StrategyShare[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<StrategySharePermission>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Which collaborator row is mid-request (role change or revoke).
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  // Ownership transfer (owner only): email → explicit confirmation → POST.
  const [transferEmail, setTransferEmail] = useState('');
  const [transferConfirm, setTransferConfirm] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Load collaborators whenever the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setListLoading(true);
    setListError(null);
    listShares(strategyId, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setShares(res.items);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setListError(getErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setListLoading(false);
      });
    return () => controller.abort();
  }, [isOpen, strategyId]);

  function handleClose() {
    setShares([]);
    setListError(null);
    setInviteEmail('');
    setInvitePermission('viewer');
    setInviteError(null);
    setInviting(false);
    setRowBusyId(null);
    setRowError(null);
    setTransferEmail('');
    setTransferConfirm(null);
    setTransferring(false);
    setTransferError(null);
    onClose();
  }

  function handleTransferStart(e: React.FormEvent) {
    e.preventDefault();
    const email = transferEmail.trim();
    setTransferError(null);
    if (!email) {
      setTransferError('Enter the new owner’s email address.');
      return;
    }
    setTransferConfirm(email);
  }

  async function handleTransferConfirm() {
    if (!transferConfirm) return;
    setTransferError(null);
    setTransferring(true);
    try {
      const detail = await transferOwnership(strategyId, transferConfirm);
      setTransferring(false);
      onTransferred?.(detail);
      handleClose();
    } catch (err) {
      setTransferError(getErrorMessage(err));
      setTransferring(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    setInviteError(null);
    if (!email) {
      setInviteError('Enter an email address.');
      return;
    }
    setInviting(true);
    try {
      const created = await createShare(strategyId, {
        email,
        // A co_owner can only mint viewers — never send co_owner from that role.
        permission: isOwner ? invitePermission : 'viewer',
      });
      setShares((prev) => [
        created,
        ...prev.filter((s) => s.shared_with_user_id !== created.shared_with_user_id),
      ]);
      setInviteEmail('');
    } catch (err) {
      setInviteError(getErrorMessage(err));
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId: string, permission: StrategySharePermission) {
    setRowError(null);
    setRowBusyId(userId);
    try {
      const updated = await updateShare(strategyId, userId, { permission });
      setShares((prev) => prev.map((s) => (s.shared_with_user_id === userId ? updated : s)));
    } catch (err) {
      setRowError(getErrorMessage(err));
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleRevoke(share: StrategyShare) {
    const ok = window.confirm(`Remove ${share.email}'s access to "${strategyName}"?`);
    if (!ok) return;
    setRowError(null);
    setRowBusyId(share.shared_with_user_id);
    try {
      await deleteShare(strategyId, share.shared_with_user_id);
      setShares((prev) => prev.filter((s) => s.shared_with_user_id !== share.shared_with_user_id));
    } catch (err) {
      setRowError(getErrorMessage(err));
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Share strategy"
      description={`Invite people to “${strategyName}” and manage their access.`}
      size="md"
    >
      <div className="space-y-5">
        {/* Invite */}
        <form onSubmit={handleInvite} className="space-y-3">
          <Input
            label="Email"
            type="email"
            autoComplete="off"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <div>
            <div className="block text-sm font-medium text-gray-700 mb-2">Role</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInvitePermission('viewer')}
                className={segClass(!isOwner || invitePermission === 'viewer')}
              >
                Viewer
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setInvitePermission('co_owner')}
                  className={segClass(invitePermission === 'co_owner')}
                >
                  Co-owner
                </button>
              )}
            </div>
            {!isOwner && (
              <p className="text-xs text-gray-500 mt-1">Only the owner can grant co-owner access.</p>
            )}
          </div>

          {inviteError && <ErrorBanner message={inviteError} />}

          <div className="flex justify-end">
            <Button type="submit" isLoading={inviting} disabled={inviting}>
              {inviting ? 'Inviting…' : 'Invite'}
            </Button>
          </div>
        </form>

        {/* Collaborators */}
        <div className="border-t border-gray-200 pt-4">
          <div className="text-sm font-medium text-gray-700 mb-2">People with access</div>

          {listLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={22} className="text-gray-400 animate-spin" />
            </div>
          ) : listError ? (
            <ErrorBanner message={listError} />
          ) : shares.length === 0 ? (
            <div className="text-sm text-gray-500 px-3 py-4 border border-gray-200 rounded-lg text-center">
              No collaborators yet.
            </div>
          ) : (
            <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {shares.map((s) => {
                const rowBusy = rowBusyId === s.shared_with_user_id;
                // Owner manages every grant; a co_owner may only revoke viewers.
                const canRevoke = isOwner || s.permission === 'viewer';
                return (
                  <li key={s.share_id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 text-sm text-gray-900 truncate">{s.email}</span>
                    {isOwner ? (
                      <select
                        value={s.permission}
                        disabled={rowBusy}
                        onChange={(e) =>
                          handleRoleChange(
                            s.shared_with_user_id,
                            e.target.value as StrategySharePermission,
                          )
                        }
                        aria-label={`Role for ${s.email}`}
                        className={CONTROL_CLS}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="co_owner">Co-owner</option>
                      </select>
                    ) : (
                      <span className="text-xs font-medium text-gray-600 px-2 py-0.5 rounded bg-gray-100">
                        {ROLE_LABEL[s.permission]}
                      </span>
                    )}
                    {canRevoke && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(s)}
                        disabled={rowBusy}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50 shrink-0"
                        aria-label={`Remove ${s.email}`}
                        title="Remove access"
                      >
                        {rowBusy ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {rowError && (
            <div className="mt-2">
              <ErrorBanner message={rowError} />
            </div>
          )}
        </div>

        {/* Transfer ownership — owner only */}
        {isOwner && (
          <div className="border-t border-gray-200 pt-4 space-y-3" data-testid="sb-transfer">
            <div>
              <div className="text-sm font-medium text-gray-700">Transfer ownership</div>
              <p className="text-xs text-gray-500 mt-1">
                The new owner gets full control, including its tracker. You stay on as a co-owner.
              </p>
            </div>
            {transferConfirm === null ? (
              <form onSubmit={handleTransferStart} className="space-y-3">
                <Input
                  label="Transfer to"
                  placeholder="new.owner@example.com"
                  type="email"
                  autoComplete="off"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                />
                {transferError && <ErrorBanner message={transferError} />}
                <div className="flex justify-end">
                  <Button type="submit" variant="secondary">
                    Transfer…
                  </Button>
                </div>
              </form>
            ) : (
              <div
                className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-3"
                data-testid="sb-transfer-confirm"
                role="alertdialog"
                aria-label="Confirm ownership transfer"
              >
                <p className="text-sm text-amber-900">
                  Transfer “{strategyName}” to <b>{transferConfirm}</b>? They become the owner and
                  you keep co-owner access. Only the new owner can undo this.
                </p>
                {transferError && <ErrorBanner message={transferError} />}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={transferring}
                    onClick={() => {
                      setTransferConfirm(null);
                      setTransferError(null);
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    isLoading={transferring}
                    disabled={transferring}
                    onClick={handleTransferConfirm}
                  >
                    Confirm transfer
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
