"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaseDetail, CaseListItem } from "@/lib/queries/helpdesk-cases";
import type { MacroItem } from "@/lib/queries/helpdesk-macros";
import type { AgentsAndTeams } from "@/lib/queries/helpdesk-agents";
import { ChannelBadge } from "@/components/helpdesk/helpdesk-badges";
import type { Channel } from "@/components/helpdesk/helpdesk-badges";
import { SlaTimer } from "@/components/helpdesk/sla-timer";
import { MessageBubble, Timeline, DateDivider } from "@/components/helpdesk/message-bubble";
import type { MessageType } from "@/components/helpdesk/message-bubble";
import { ReplyComposer } from "@/components/helpdesk/reply-composer";
import { ContextPanel } from "@/components/helpdesk/context-panel";
import type { CaseContextData } from "@/components/helpdesk/context-panel";
import { CaseQueuePanel } from "./case-queue-panel";
import { QuickActionsToolbar } from "@/components/helpdesk/quick-actions-toolbar";
import { CasePropertyDropdowns } from "@/components/helpdesk/case-property-dropdowns";
import { ShortcutHelpOverlay } from "@/components/helpdesk/shortcut-help-overlay";
import { addAgentReply, updateCaseStatus, updateCasePriority } from "@/lib/actions/helpdesk-agent-cases";
import type { MacroContext } from "@/lib/helpdesk/macro-substitution";
import { useHelpdeskHotkeys } from "@/lib/helpdesk/use-helpdesk-hotkeys";
import { CaseWatchers } from "@/components/helpdesk/case-watchers";
import type { CaseWatcherItem } from "@/lib/queries/helpdesk-cases";
import { AiSuggestionCard } from "@/components/helpdesk/ai-suggestion-card";

// =============================================================================
// HELPERS
// =============================================================================

function isSameDay(a: Date | string, b: Date | string) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

type OptimisticMsg = { kind: "message"; id: string; createdAt: Date; direction: string; senderName: string | null; body: string; isOptimistic: true };
type ServerTimelineItem = { kind: "message"; id: string; createdAt: Date; direction: string; senderName: string | null; body: string } | { kind: "event"; id: string; createdAt: Date; eventType: string };
type TimelineItem = ServerTimelineItem | OptimisticMsg;

function directionToType(dir: string): MessageType {
  if (dir === "INBOUND") return "INBOUND";
  if (dir === "INTERNAL") return "INTERNAL";
  return "OUTBOUND";
}

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
  agentName = "Agent", agentStaffUserId = "",
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
  const [focusRequest, setFocusRequest] = useState<{ mode: "reply" | "internal"; counter: number }>({ mode: "reply", counter: 0 });
  const [macroToggleSignal, setMacroToggleSignal] = useState(0);
  const isClosed = caseDetail.status === "CLOSED";

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
    if (isClosed || caseDetail.status === "RESOLVED") return;
    await updateCaseStatus({ caseId: caseDetail.id, status: "RESOLVED" });
    router.refresh();
  }, [isClosed, caseDetail.id, caseDetail.status, router]);

  const handleEscalate = useCallback(async () => {
    if (isClosed) return;
    await updateCaseStatus({ caseId: caseDetail.id, status: "ESCALATED" });
    router.refresh();
  }, [isClosed, caseDetail.id, router]);

  const handleSetPriority = useCallback(async (priority: string) => {
    if (isClosed) return;
    await updateCasePriority({ caseId: caseDetail.id, priority });
    router.refresh();
  }, [isClosed, caseDetail.id, router]);

  // Register hotkeys per canonical §6.2
  useHelpdeskHotkeys({
    navigatePrev,
    navigateNext,
    focusReply: () => setFocusRequest((p) => ({ mode: "reply", counter: p.counter + 1 })),
    focusNote: () => setFocusRequest((p) => ({ mode: "internal", counter: p.counter + 1 })),
    escalate: () => void handleEscalate(),
    toggleMacros: () => setMacroToggleSignal((n) => n + 1),
    toggleShortcutHelp: () => setShowShortcutHelp((s) => !s),
    resolve: () => void handleResolve(),
    setPriority: (p) => void handleSetPriority(p),
  });

  // Optimistic send handlers
  const handleSendReply = useCallback(async (body: string) => {
    const id = `optimistic-${Date.now()}`;
    const item: OptimisticMsg = { kind: "message", id, createdAt: new Date(), direction: "OUTBOUND", senderName: agentName, body, isOptimistic: true };
    setOptimisticMessages((prev) => [...prev, item]);
    setIsSubmitting(true);
    setReplyError(null);
    try {
      const result = await addAgentReply({ caseId: caseDetail.id, body, isInternal: false });
      if (!result.success) {
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== id));
        setReplyError(result.error ?? "Failed to send reply.");
      } else {
        router.refresh();
      }
    } finally { setIsSubmitting(false); }
  }, [caseDetail.id, router, agentName]);

  const handleSendNote = useCallback(async (body: string) => {
    const id = `optimistic-${Date.now()}`;
    const item: OptimisticMsg = { kind: "message", id, createdAt: new Date(), direction: "INTERNAL", senderName: agentName, body, isOptimistic: true };
    setOptimisticMessages((prev) => [...prev, item]);
    setIsSubmitting(true);
    setReplyError(null);
    try {
      const result = await addAgentReply({ caseId: caseDetail.id, body, isInternal: true });
      if (!result.success) {
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== id));
        setReplyError(result.error ?? "Failed to add note.");
      } else {
        router.refresh();
      }
    } finally { setIsSubmitting(false); }
  }, [caseDetail.id, router, agentName]);

  // Build merged timeline
  const serverItems: ServerTimelineItem[] = [
    ...caseDetail.messages.map((m) => ({ kind: "message" as const, id: m.id, createdAt: m.createdAt, direction: m.direction, senderName: m.senderName, body: m.body })),
    ...caseDetail.events.map((e) => ({ kind: "event" as const, id: e.id, createdAt: e.createdAt, eventType: e.eventType })),
  ];
  const serverIds = new Set(serverItems.map((i) => i.id));
  const timeline: TimelineItem[] = [...serverItems, ...optimisticMessages.filter((m) => !serverIds.has(m.id))]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const macroContext: MacroContext = {
    buyerName: contextData.requesterName,
    caseNumber: caseDetail.caseNumber,
    orderNumber: contextData.order?.orderNumber,
    agentName,
  };

  return (
    <div className="hd-workspace">
      <CaseQueuePanel cases={caseQueue} selectedCaseId={caseDetail.id} />

      <div className="hd-workspace-center">
        {/* Header */}
        <div className="border-b px-6 py-3 flex-shrink-0 flex flex-col gap-2" style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs" style={{ color: "rgb(var(--hd-text-dim))" }}>{caseDetail.caseNumber}</span>
                <ChannelBadge channel={caseDetail.channel as Channel} />
              </div>
              <h1 className="text-base font-semibold truncate mt-0.5" style={{ color: "rgb(var(--hd-text-primary))" }}>{caseDetail.subject}</h1>
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
          <CaseWatchers
            caseId={caseDetail.id}
            watchers={watchers}
            currentStaffUserId={agentStaffUserId}
          />
        </div>

        <QuickActionsToolbar
          caseId={caseDetail.id} caseNumber={caseDetail.caseNumber} currentStatus={caseDetail.status}
          currentAgentId={caseDetail.assignedAgentId} currentStaffUserId={agentStaffUserId}
        />

        {/* Timeline */}
        <Timeline className="flex-1">
          {timeline.map((item, index) => {
            const prev = index > 0 ? timeline[index - 1] : null;
            const showDate = !prev || !isSameDay(prev.createdAt, item.createdAt);
            if (item.kind === "event") {
              return (
                <div key={`e-${item.id}`}>
                  {showDate && <DateDivider date={item.createdAt} />}
                  <div className="flex justify-center py-1">
                    <span className="rounded-full px-3 py-1 text-xs" style={{ background: "rgb(var(--hd-bg-card))", color: "rgb(var(--hd-text-muted))" }}>
                      {item.eventType.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              );
            }
            const isOpt = "isOptimistic" in item && item.isOptimistic;
            const authorName = item.senderName ?? (item.direction === "INBOUND" ? "User" : "Agent");
            return (
              <div key={`m-${item.id}`} className={isOpt ? "opacity-70" : undefined}>
                {showDate && <DateDivider date={item.createdAt} />}
                <MessageBubble type={directionToType(item.direction)} author={{ id: item.id, name: authorName }} body={item.body} createdAt={item.createdAt} />
                {isOpt && (
                  <div className="flex justify-end px-4 pb-1">
                    <span className="text-[10px] animate-pulse" style={{ color: "rgb(var(--hd-text-dim))" }}>Sending...</span>
                  </div>
                )}
              </div>
            );
          })}
        </Timeline>

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
              <div className="px-4 py-2 text-sm border-t" style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))", color: "rgb(220 38 38)" }}>
                {replyError}
              </div>
            )}
          </>
        ) : (
          <div className={cn("border-t px-4 py-3 flex items-center gap-2 text-sm")} style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-card))", color: "rgb(var(--hd-text-muted))" }}>
            <Lock className="h-4 w-4" /> This case is closed.
          </div>
        )}
      </div>

      <ContextPanel data={contextData} />
      <ShortcutHelpOverlay isVisible={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />
    </div>
  );
}
