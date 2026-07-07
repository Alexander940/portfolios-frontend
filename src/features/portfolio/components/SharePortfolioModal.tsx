import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import {
  createShare,
  deleteShare,
  listShares,
  transferOwnership,
  updateShare,
  type PortfolioResponse,
  type ShareResponse,
  type SharePermission,
} from '@/services/portfolioService';
import { getErrorMessage } from '@/lib/apiErrors';

interface SharePortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolio: PortfolioResponse;
  /** Called after a successful ownership transfer (caller becomes co-owner). */
  onTransferred?: (updated: PortfolioResponse) => void;
}

const ROLE_LABEL: Record<SharePermission, string> = {
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
 * Manage a portfolio's collaborators: invite by email, change/revoke roles, and
 * (owner-only) transfer ownership. The backend is the source of truth for
 * permissions — the UI only hides/disables what the caller can't do:
 *   - owner   → invite/manage viewers AND co-owners, transfer ownership.
 *   - co_owner→ invite/remove ONLY viewers; cannot mint/touch co-owners or transfer.
 */
export function SharePortfolioModal({
  isOpen,
  onClose,
  portfolio,
  onTransferred,
}: SharePortfolioModalProps) {
  const isOwner = portfolio.is_owner === true;

  const [shares, setShares] = useState<ShareResponse[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<SharePermission>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Which collaborator row is mid-request (role change or revoke).
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Load collaborators whenever the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setListLoading(true);
    setListError(null);
    listShares(portfolio.portfolio_id, controller.signal)
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
  }, [isOpen, portfolio.portfolio_id]);

  function handleClose() {
    setShares([]);
    setListError(null);
    setInviteEmail('');
    setInvitePermission('viewer');
    setInviteError(null);
    setInviting(false);
    setRowBusyId(null);
    setRowError(null);
    setTransferOpen(false);
    setTransferEmail('');
    setTransferError(null);
    setTransferring(false);
    onClose();
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
      const created = await createShare(portfolio.portfolio_id, {
        email,
        permission: invitePermission,
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

  async function handleRoleChange(userId: string, permission: SharePermission) {
    setRowError(null);
    setRowBusyId(userId);
    try {
      const updated = await updateShare(portfolio.portfolio_id, userId, { permission });
      setShares((prev) =>
        prev.map((s) => (s.shared_with_user_id === userId ? updated : s)),
      );
    } catch (err) {
      setRowError(getErrorMessage(err));
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleRevoke(share: ShareResponse) {
    const ok = window.confirm(
      `Remove ${share.email}'s access to "${portfolio.name}"?`,
    );
    if (!ok) return;
    setRowError(null);
    setRowBusyId(share.shared_with_user_id);
    try {
      await deleteShare(portfolio.portfolio_id, share.shared_with_user_id);
      setShares((prev) =>
        prev.filter((s) => s.shared_with_user_id !== share.shared_with_user_id),
      );
    } catch (err) {
      setRowError(getErrorMessage(err));
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    const email = transferEmail.trim();
    setTransferError(null);
    if (!email) {
      setTransferError("Enter the new owner's email.");
      return;
    }
    setTransferring(true);
    try {
      const updated = await transferOwnership(portfolio.portfolio_id, { email });
      onTransferred?.(updated);
      handleClose();
    } catch (err) {
      setTransferError(getErrorMessage(err));
    } finally {
      setTransferring(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Share portfolio"
      description={`Invite people to “${portfolio.name}” and manage their access.`}
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
                className={segClass(invitePermission === 'viewer')}
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
              <p className="text-xs text-gray-500 mt-1">
                Only the owner can grant co-owner access.
              </p>
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
          <div className="text-sm font-medium text-gray-700 mb-2">
            People with access
          </div>

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
                  <li
                    key={s.share_id}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 text-sm text-gray-900 truncate">
                      {s.email}
                    </span>
                    {isOwner ? (
                      <select
                        value={s.permission}
                        disabled={rowBusy}
                        onChange={(e) =>
                          handleRoleChange(
                            s.shared_with_user_id,
                            e.target.value as SharePermission,
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
          <div className="border-t border-gray-200 pt-4">
            {!transferOpen ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    Transfer ownership
                  </div>
                  <div className="text-xs text-gray-500">
                    Make another user the owner. You become a co-owner.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setTransferOpen(true)}
                >
                  Transfer…
                </Button>
              </div>
            ) : (
              <form onSubmit={handleTransfer} className="space-y-3">
                <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-sm">
                  The new owner gains full control, including deleting this
                  portfolio. You will be downgraded to co-owner.
                </div>
                <Input
                  label="New owner's email"
                  type="email"
                  autoComplete="off"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                />
                {transferError && <ErrorBanner message={transferError} />}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setTransferOpen(false);
                      setTransferError(null);
                    }}
                    disabled={transferring}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    isLoading={transferring}
                    disabled={transferring}
                  >
                    {transferring ? 'Transferring…' : 'Transfer ownership'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
