import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/inbox";
import { MessageSquare } from "lucide-react";

export function InboxList({
  conversations,
  emptyMessage,
}: {
  conversations: Conversation[];
  emptyMessage: string;
}) {
  if (conversations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingen meldinger ennå</CardTitle>
          <CardDescription>{emptyMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-card">
      {conversations.map((c) => (
        <li key={c.thread_key}>
          <Link
            href={c.href}
            className="flex items-start gap-3 p-4 transition-colors hover:bg-accent/30"
          >
            <div
              className={cn(
                "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                c.unread_count > 0
                  ? "bg-brand/10 text-brand"
                  : "bg-accent text-muted-foreground",
              )}
            >
              {c.counterparty_name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "truncate text-sm",
                        c.unread_count > 0 ? "font-semibold" : "font-medium",
                      )}
                    >
                      {c.counterparty_name}
                    </span>
                    {c.channel === "bid" ? (
                      <Badge
                        variant="outline"
                        className="shrink-0 px-1.5 py-0 text-[10px]"
                      >
                        Tilbud
                      </Badge>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.project_title}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.unread_count > 0 ? (
                    <Badge variant="brand" className="px-1.5 py-0 text-[10px]">
                      {c.unread_count}
                    </Badge>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(c.last_message_at)}
                  </span>
                </div>
              </div>
              <p
                className={cn(
                  "mt-1 line-clamp-1 text-sm",
                  c.unread_count > 0
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {c.last_sender_is_me ? "Du: " : ""}
                {c.last_message_body}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function InboxEmpty({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-muted-foreground">
          {icon ?? <MessageSquare className="h-5 w-5" />}
        </div>
        <div>
          <div className="font-medium">{title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "nå";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}t`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "short",
  });
}
