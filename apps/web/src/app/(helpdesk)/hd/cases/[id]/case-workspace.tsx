'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CaseDetail, CaseListItem } from '@/lib/queries/helpdesk-cases';
import type { MacroItem } from '@/lib/queries/helpdesk-macros';
import type { AgentsAndTeams } from '@/lib/queries/helpdesk-agents';
import { ChannelBadge } from '@/components/helpdesk/helpdesk-badges';
import type { Channel } from '@/components/helpdesk/helpdesk-badges';
import { SlaTimer } from '@/components/helpdesk/sla-timer';
import { ReplyComposer } from '@/components/helpdesk/reply-composer';
import { ContextPanel } from '@/components/helpdesk/context-panel';
import type { CaseContextData } from '@/components/helpdesk/context-panel';
import { CaseQueuePanel } from './case-queue-panel';
import { CasePropertyDropdowns } from '@/components/helpdesk/case-property-dropdowns';
import { CaseTagEditor } from '@/components/helpdesk/case-tag-editor';
import { ShortcutHelpOverlay } from '@/components/helpdesk/shortcut-help-overlay';
import { addAgentReply, updateCaseStatus, assignCase } from '@/lib/actions/helpdesk-agent-cases';
import { updateCasePriority } from '@/lib/actions/helpdesk-agent-cases-meta';
import type { MacroContext } from '@/lib/helpdesk/macro-substitution';
import { useHelpdeskHotkeys } from '@/lib/helpdesk/use-helpdesk-hotkeys';
import { WatchToggleButton } from '@/components/helpdesk/case-watchers';
import type { CaseWatcherItem } from '@/lib/queries/helpdesk-cases';
import { AiSuggestionCard } from '@/components/helpdesk/ai-suggestion-card';
import { CaseTimeline } from './case-timeline';
import type { OptimisticMsg, ServerTimelineItem, TimelineItem } from './case-timeline';

// =============================================================================
// PROPS
// =============================================================================

interface CaseWorkspaceProps {
  caseDetail: CaseDetail;
  caseQueue: CaseListItem[];
  contextData: CaseContextData;
  macros?: MacroItem[];
  agentsAndTeams?: AgentsAndTeams;
  agentName?: string;
  agentStaffUserId?: string;
  watchers?: CaseWatcherItem[];
  aiSuggestionEnabled?: boolean;
  aiAssistEnabled?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CaseWorkspace({
  caseDetail, caseQueue, contextData, macros = [],
  agentsAndTeams = { agents: [], teams: [] },
  agentName = 'Agent', agentStaffUserId = '',
  watchers = [],
  aiSuggestionEnabled = false,
  aiAssistEnabled = false,
}: CaseWorkspaceProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMsg[]>([]);
  const [composerBody, setComposerBody] = useState<string | null>(null);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ mode: 'reply' | 'internal'; counter: number }>({ mode: 'reply', counter: 0 });
  const [macroToggleSignal, setMacroToggleSignal] = useState(0);
  const isClosed = caseDetail.status === 'CLOSED';

  // Queue navigation
  const currentIdx = caseQueue.findIndex((c) => c.id === caseDetail.id);
  const navigatePrev = useCallback(() => {
    const prev = currentIdx > 0 ? caseQueue[currentIdx - 1] : undefined;
    if (prev) router.push(`/hd/cases/${prev.id}`);
  }, [currentIdx, caseQueue, router]);
  const navigateNext = useCallback(() => {
    const next = currentIdx >= 0 && currentIdx < caseQueue.length - 1 ? caseQueue[currentIdx + 1] : undefined;
    if (next) router.push(`/hd/cases/${next.id}`);
  }, [currentIdx, caseQueue, router]);

  const handleResolve = useCallback(async () => {
    if (isClosed || caseDetail.status === 'RESOLVED') return;
    const result = await updateCaseStatus({ caseId: caseDetail.id, status: 'RESOLVED' });
    if (!result.success) return;
    const next = currentIdx >= 0 && currentIdx < caseQueue.length - 1 ? caseQueue[currentIdx + 1] : undefined;
    if (next) {
      router.push(`/hd/cases/${next.id}`);
    } else {
      router.push('/hd/cases');
    }
  }, [isClosed, caseDetail.id, caseDetail.status, currentIdx, caseQueue, router]);

  const handleEscalate = useCallback(async () => {
    if (isClosed) return;
    await updateCaseStatus({ caseId: caseDetail.id, status: 'ESCALATED' });
    router.refresh();
  }, [isClosed, caseDetail.id, router]);

  const handleAssignToMe = useCallback(async () => {
    if (isClosed || caseDetail.assignedAgentId === agentStaffUserId) return;
    await assignCase({ caseId: caseDetail.id, assignedAgentId: agentStaffUserId, assignedTeamId: null });
    router.refresh();
  }, [isClosed, caseDetail.id, caseDetail.assignedAgentId, agentStaffUserId, router]);

  const handleSetPriority = useCallback(async (priority: string) => {
    if (isClosed) return;
    await updateCasePriority({ caseId: caseDetail.id, priority });
    router.refresh();
  }, [isClosed, caseDetail.id, router]);

  useHelpdeskHotkeys({
    navigatePrev,
    navigateNext,
    focusReply: () => setFocusRequest((p) => ({ mode: 'reply', counter: p.counter + 1 })),
    focusNote: () => setFocusRequest((p) => ({ mode: 'internal', counter: p.counter + 1 })),
    escalate: () => void handleEscalate(),
    toggleMacros: () => setMacroToggleSignal((n) => n + 1),
    toggleShortcutHelp: () => setShowShortcutHelp((s) => !s),
    resolve: () => void handleResolve(),
    setPriority: (p) => void handleSetPriority(p),
  });

  const handleSendReply = useCallback(async (body: string) => {
    const id = `optimistic-${Date.now()}`;
    const item: OptimisticMsg = { kind: 'message', id, createdAt: new Date(), direction: 'OUTBOUND', senderName: agentName, body, isOptimistic: true };
    setOptimisticMessages((prev) => [...prev, item]);
    setIsSubmitting(true);
    setReplyError(null);
    try {
      const result = await addAgentReply({ caseId: caseDetail.id, body, isInternal: false });
      if (!result.success) {
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== id));
        setReplyError(result.error ?? 'Failed to send reply.');
      } else { router.refresh(); }
    } finally { setIsSubmitting(false); }
  }, [caseDetail.id, router, agentName]);

  const handleSendNote = useCallback(async (body: string) => {
    const id = `optimistic-${Date.now()}`;
    const item: OptimisticMsg = { kind: 'message', id, createdAt: new Date(), direction: 'INTERNAL', senderName: agentName, body, isOptimistic: true };
    setOptimisticMessages((prev) => [...prev, item]);
    setIsSubmitting(true);
    setReplyError(null);
    try {
      const result = await addAgentReply({ caseId: caseDetail.id, body, isInternal: true });
      if (!result.success) {
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== id));
        setReplyError(result.error ?? 'Failed to add note.');
      } else { router.refresh(); }
    } finally { setIsSubmitting(false); }
  }, [caseDetail.id, router, agentName]);

  // Build merged timeline
  const serverItems: ServerTimelineItem[] = [
    ...caseDetail.messages.map((m) => ({ kind: 'message' as const, id: m.id, createdAt: m.createdAt, direction: m.direction, senderName: m.senderName, body: m.body })),
    ...caseDetail.events.map((e) => ({ kind: 'event' as const, id: e.id, createdAt: e.createdAt, eventType: e.eventType })),
  ];
  const serverIds = new Set(serverItems.map((i) => i.id));
  const timeline: TimelineItem[] = [
    ...serverItems,
    ...optimisticMessages.filter((m) => !serverIds.has(m.id)),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const macroContext: MacroContext = {
    buyerName: contextData.requesterName,
    caseNumber: caseDetail.caseNumber,
    orderNumber: contextData.order?.orderNumber,
    agentName,
  };

  return (
    <div className="hd-workspace">
      <CaseQueuePanel cases={caseQueue} selectedCaseId={caseDetail.id} watchers={watchers} />

      <div className="hd-workspace-center">
        {/* Header */}
        <div className="border-b px-6 py-3 flex-shrink-0 flex flex-col gap-2" style={{ background: 'rgb(var(--hd-bg-panel))', borderColor: 'rgb(var(--hd-border))' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-start gap-2">
              <button
                type="button"
                onClick={() => router.push('/hd/cases')}
                className="flex-shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hd-transition hover:opacity-70"
                style={{ color: 'rgb(var(--hd-text-muted))' }}
                title="Back to cases"
                aria-label="Back to cases"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs" style={{ color: 'rgb(var(--hd-text-dim))' }}>{caseDetail.caseNumber}</span>
                  <ChannelBadge channel={caseDetail.channel as Channel} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <h1 className="text-base font-semibold truncate" style={{ color: 'rgb(var(--hd-text-primary))' }}>{caseDetail.subject}</h1>
                  <WatchToggleButton caseId={caseDetail.id} watchers={watchers} currentStaffUserId={agentStaffUserId} />
                </div>
              </div>
            </div>
            {caseDetail.slaFirstResponseDueAt && !caseDetail.firstResponseAt && (
              <SlaTimer dueAt={caseDetail.slaFirstResponseDueAt} isMet={false} label="Response" size="sm" />
            )}
          </div>
          <CasePropertyDropdowns
            caseId={caseDetail.id} currentStatus={caseDetail.status} currentPriority={caseDetail.priority}
            currentAgentId={caseDetail.assignedAgentId} currentTeamId={caseDetail.assignedTeamId}
            agents={agentsAndTeams.agents} teams={agentsAndTeams.teams} isClosed={isClosed}
          />
          <CaseTagEditor caseId={caseDetail.id} tags={caseDetail.tags} isClosed={isClosed} />
        </div>

        <CaseTimeline timeline={timeline} />

        {!isClosed ? (
          <>
            <AiSuggestionCard
              caseId={caseDetail.id}
              suggestionEnabled={aiSuggestionEnabled}
              onUseSuggestion={(text) => setComposerBody(text)}
            />
            <ReplyComposer
              onSendReply={handleSendReply} onSendNote={handleSendNote} isSubmitting={isSubmitting}
              macros={macros} recipientName={contextData.requesterName} macroContext={macroContext}
              focusRequest={focusRequest} macroToggleSignal={macroToggleSignal}
              aiAssistEnabled={aiAssistEnabled}
              initialBody={composerBody ?? undefined}
            />
            {replyError && (
              <div className="px-4 py-2 text-sm border-t" style={{ background: 'rgb(var(--hd-bg-card))', borderColor: 'rgb(var(--hd-border))', color: 'rgb(220 38 38)' }}>
                {replyError}
              </div>
            )}
          </>
        ) : (
          <div className={cn('border-t px-4 py-3 flex items-center gap-2 text-sm')} style={{ borderColor: 'rgb(var(--hd-border))', background: 'rgb(var(--hd-bg-card))', color: 'rgb(var(--hd-text-muted))' }}>
            <Lock className="h-4 w-4" /> This case is closed.
          </div>
        )}
      </div>

      <ContextPanel
        data={contextData}
        caseId={caseDetail.id}
        caseNumber={caseDetail.caseNumber}
        currentStatus={caseDetail.status}
        currentAgentId={caseDetail.assignedAgentId}
        currentStaffUserId={agentStaffUserId}
        onResolve={() => void handleResolve()}
        onEscalate={() => void handleEscalate()}
        onAssignToMe={() => void handleAssignToMe()}
      />
      <ShortcutHelpOverlay isVisible={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />
    </div>
  );
}
