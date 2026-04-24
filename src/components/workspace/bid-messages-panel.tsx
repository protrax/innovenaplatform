"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Send } from "lucide-react";

interface Message {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
}

interface Actor {
  user_id: string;
  name: string;
}

export function BidMessagesPanel({
  bidId,
  currentUserId,
  initialMessages,
  actors,
  counterpartyName,
}: {
  bidId: string;
  currentUserId: string;
  initialMessages: Message[];
  actors: Actor[];
  counterpartyName: string;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:bid:${bidId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `bid_id=eq.${bidId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bidId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "bid",
          bid_id: bidId,
          body,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kunne ikke sende");
        return;
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
      setBody("");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Still spørsmål før du aksepterer</CardTitle>
        <CardDescription>
          Snakk direkte med {counterpartyName} om tilbudet. Meldinger er private
          for dette tilbudet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={scrollRef}
          className="max-h-80 min-h-40 space-y-3 overflow-y-auto rounded-md border border-border bg-background p-3"
        >
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ingen meldinger ennå. Hva lurer du på?
            </p>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === currentUserId;
              const sender = actors.find((a) => a.user_id === m.sender_id);
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-col",
                    isMine ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      isMine
                        ? "bg-brand text-brand-foreground"
                        : "bg-accent text-foreground",
                    )}
                  >
                    {m.body}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {sender?.name ?? "Ukjent"} ·{" "}
                    {new Date(m.created_at).toLocaleTimeString("nb-NO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={send} className="flex gap-2">
          <Textarea
            rows={2}
            placeholder="F.eks. Inkluderer pris også hosting første året?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="brand"
            size="icon"
            disabled={sending || !body.trim()}
            aria-label="Send"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
