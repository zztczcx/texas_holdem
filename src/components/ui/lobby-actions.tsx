'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Slider } from '@/components/ui/slider';
import { createTable, joinTable } from '@/app/actions';
import type { GameSettings } from '@/types/game';

const DEFAULT_SETTINGS: GameSettings = {
  maxPlayers: 6,
  startingChips: 1000,
  smallBlind: 10,
  bigBlind: 20,
  maxRaises: 4,
  ante: 0,
  turnTimerSeconds: 30,
  allowBuyBack: true,
  buyBackAmount: 1000,
};

export function LobbyActions(): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Create table modal
  const [createOpen, setCreateOpen] = useState(false);
  const [hostName, setHostName] = useState('');
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join table
  const [joinTableId, setJoinTableId] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  function handleCreate(): void {
    if (!hostName.trim()) {
      setCreateError('Please enter your name.');
      return;
    }
    setCreateError(null);
    startTransition(async () => {
      const result = await createTable(settings, hostName.trim());
      if (result.error) {
        setCreateError(result.error);
      } else if (result.data) {
        router.push(`/table/${result.data.tableId}`);
      }
    });
  }

  function handleJoin(): void {
    if (!joinTableId.trim()) {
      setJoinError('Please enter a table code.');
      return;
    }
    if (!joinName.trim()) {
      setJoinError('Please enter your name.');
      return;
    }
    setJoinError(null);
    startTransition(async () => {
      const result = await joinTable(joinTableId.trim().toUpperCase(), joinName.trim());
      if (result.error) {
        setJoinError(result.error);
      } else {
        router.push(`/table/${joinTableId.trim().toUpperCase()}`);
      }
    });
  }

  return (
    <>
      {/* Action buttons */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <Button
          size="lg"
          variant="gold"
          onClick={() => setCreateOpen(true)}
          aria-haspopup="dialog"
        >
          ♠ Create Table
        </Button>
      </div>

      {/* Join table form */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-center">
        <Input
          id="join-table-id"
          label="Table Code"
          placeholder="ABC123"
          value={joinTableId}
          onChange={(e) => setJoinTableId(e.target.value.toUpperCase())}
          className="w-full sm:w-40"
          maxLength={6}
          aria-label="Table code to join"
        />
        <Input
          id="join-name"
          label="Your Name"
          placeholder="Player name"
          value={joinName}
          onChange={(e) => setJoinName(e.target.value)}
          className="w-full sm:w-44"
          maxLength={20}
        />
        <Button
          variant="primary"
          size="md"
          isLoading={isPending}
          onClick={handleJoin}
          className="mt-1 sm:mt-0 self-end"
        >
          Join Table
        </Button>
      </div>
      {joinError && (
        <p role="alert" className="text-center text-sm text-[var(--color-danger)] mt-2">
          {joinError}
        </p>
      )}

      {/* Create Table Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
        title="Create Table"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Your Name"
            placeholder="Enter your name"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            maxLength={20}
            autoFocus
          />

          <Slider
            label="Max Players"
            value={settings.maxPlayers}
            min={2}
            max={9}
            displayValue={String(settings.maxPlayers)}
            onValueChange={(v) => setSettings((s) => ({ ...s, maxPlayers: v }))}
          />

          <Slider
            label="Starting Chips"
            value={settings.startingChips}
            min={100}
            max={10000}
            step={100}
            displayValue={settings.startingChips.toLocaleString()}
            onValueChange={(v) => setSettings((s) => ({ ...s, startingChips: v }))}
          />

          <Slider
            label="Small Blind"
            value={settings.smallBlind}
            min={5}
            max={500}
            step={5}
            displayValue={String(settings.smallBlind)}
            onValueChange={(v) =>
              setSettings((s) => ({ ...s, smallBlind: v, bigBlind: v * 2 }))
            }
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="allow-buy-back"
              checked={settings.allowBuyBack}
              onChange={(e) =>
                setSettings((s) => ({ ...s, allowBuyBack: e.target.checked }))
              }
              className="w-4 h-4 accent-[var(--color-gold)] cursor-pointer"
            />
            <label
              htmlFor="allow-buy-back"
              className="text-sm text-[var(--color-text-muted)] cursor-pointer"
            >
              Allow buy-backs
            </label>
          </div>

          {createError && (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {createError}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setCreateOpen(false);
                setCreateError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              size="md"
              isLoading={isPending}
              onClick={handleCreate}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
