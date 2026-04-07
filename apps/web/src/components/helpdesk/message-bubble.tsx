"use client";

import { cn } from "@/lib/utils";

// =============================================================================
// MESSAGE TYPES
// =============================================================================

export type MessageType = "INBOUND" | "OUTBOUND" | "INTERNAL" | "SYSTEM";

interface MessageAuthor {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role?: "BUYER" | "SELLER" | "AGENT" | "SYSTEM";
}

interface Attachment {
  id: string;
  filename: string;
  url: string;
  size?: number;
  mimeType?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTimeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// MESSAGE BUBBLE COMPONENT (V2-themed)
// =============================================================================

interface MessageBubbleProps {
  type: MessageType;
  author: MessageAuthor;
  body: string;
  createdAt: string | Date;
  attachments?: Attachment[];
  channel?: "EMAIL" | "WEB" | "SYSTEM";
  isEdited?: boolean;
  className?: string;
  agentSignatureHtml?: string | null;
}

export function MessageBubble({
  type, author, body, createdAt, attachments = [], channel, isEdited, className, agentSignatureHtml,
}: MessageBubbleProps) {
  const initials = author.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const timeAgo = formatTimeAgo(createdAt);

  // V2 theme CSS classes from helpdesk-theme.css
  const bubbleClass: Record<MessageType, string> = {
    INBOUND: "hd-msg-inbound",
    OUTBOUND: "",
    INTERNAL: "",
    SYSTEM: "",
  };

  // Enhanced outbound: gradient + blue left border
  const outboundStyle: React.CSSProperties = type === "OUTBOUND" ? {
    background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.03))",
    borderLeft: "3px solid rgb(59,130,246)",
    borderTop: "1px solid rgba(59,130,246,0.15)",
    borderBottom: "1px solid rgba(59,130,246,0.15)",
    borderRight: "1px solid rgba(59,130,246,0.15)",
    borderRadius: "0.5rem",
    marginBottom: "0.5rem",
  } : {};

  // Enhanced internal: yellow tinted background + dashed amber border
  const internalStyle: React.CSSProperties = type === "INTERNAL" ? {
    background: "rgba(254,243,199,0.15)",
    border: "1px dashed rgba(245,158,11,0.4)",
    borderRadius: "0.5rem",
    marginBottom: "0.5rem",
  } : {};

  const avatarStyles: Record<MessageType, string> = {
    INBOUND: "bg-brand-500/20 text-brand-500",
    OUTBOUND: "bg-green-500/20 text-green-500",
    INTERNAL: "bg-amber-500/20 text-amber-500",
    SYSTEM: "text-slate-500",
  };

  const channelIcons: Record<string, string> = { EMAIL: "📧", WEB: "🌐", SYSTEM: "⚡" };

  if (type === "SYSTEM") {
    return (
      <div className={cn("flex items-start gap-3 py-2", className)}>
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "rgb(var(--hd-bg-card))", color: "rgb(var(--hd-text-dim))" }}>
          ⚙️
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>{body}</span>
          <span className="text-xs ml-2" style={{ color: "rgb(var(--hd-text-dim))" }}>{timeAgo}</span>
        </div>
      </div>
    );
  }

  const computedStyle = type === "OUTBOUND" ? outboundStyle : type === "INTERNAL" ? internalStyle : {};

  return (
    <div className={cn(bubbleClass[type], className)} style={computedStyle}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "inherit" }}>
        <div className="flex items-center gap-3">
          {author.avatarUrl ? (
            <img src={author.avatarUrl} alt={author.name} className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold", avatarStyles[type])}>
              {initials}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm" style={{ color: "rgb(var(--hd-text-primary))" }}>{author.name}</span>
              {type === "INTERNAL" && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/20 text-amber-500">
                  🔒 Internal
                </span>
              )}
              {type === "OUTBOUND" && <span className="text-green-500 text-xs">📤</span>}
            </div>
            {author.email && <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>{author.email}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>
          {channel && (
            <span className="flex items-center gap-1">
              <span>{channelIcons[channel]}</span>
              <span className="capitalize">{channel.toLowerCase()}</span>
            </span>
          )}
          <span>{timeAgo}</span>
          {isEdited && <span className="italic">(edited)</span>}
        </div>
      </div>

      {/* Body */}
      <div className="hd-msg-body px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
        {body}
      </div>

      {/* Agent signature (display-only, outbound only) */}
      {type === "OUTBOUND" && agentSignatureHtml && (
        <div className="px-4 pb-3 border-t" style={{ borderColor: "rgba(59,130,246,0.15)" }}>
          <hr className="my-2" style={{ borderColor: "rgba(59,130,246,0.2)" }} />
          <div
            className="text-xs leading-relaxed whitespace-pre-wrap"
            style={{ color: "rgb(var(--hd-text-dim))", fontSize: "0.7rem" }}
          >
            {agentSignatureHtml}
          </div>
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="px-4 py-3 border-t flex flex-wrap gap-2" style={{ borderColor: "inherit" }}>
          {attachments.map((att) => (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs border hd-transition"
              style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-secondary))" }}
            >
              <span>📎</span>
              <span className="max-w-[150px] truncate">{att.filename}</span>
              {att.size && <span style={{ color: "rgb(var(--hd-text-dim))" }}>({formatFileSize(att.size)})</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TIMELINE WRAPPER
// =============================================================================

interface TimelineProps {
  children: React.ReactNode;
  className?: string;
}

export function Timeline({ children, className }: TimelineProps) {
  return (
    <div className={cn("flex flex-col gap-4 p-4 overflow-y-auto hd-scrollbar", className)}>
      {children}
    </div>
  );
}

// =============================================================================
// DATE DIVIDER
// =============================================================================

interface DateDividerProps {
  date: string | Date;
}

export function DateDivider({ date }: DateDividerProps) {
  const formatted = new Date(date).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex-1 h-px" style={{ background: "rgb(var(--hd-border))" }} />
      <span className="text-xs font-medium" style={{ color: "rgb(var(--hd-text-muted))" }}>{formatted}</span>
      <div className="flex-1 h-px" style={{ background: "rgb(var(--hd-border))" }} />
    </div>
  );
}
