"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, RefreshCw, ArrowDownToLine } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

interface Conversation {
  id: string;
  phoneNumber: string;
  inboxStatus: string;
  lastMessageAt?: string;
  tenant?: { fullName: string; primaryPhone?: string };
  property?: { name: string; address1: string };
  messages: { id: string; body: string; direction: string; sentAt?: string; status: string }[];
}

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  status: string;
  sentAt?: string;
}

export default function MessagesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [generatedReplyId, setGeneratedReplyId] = useState<string | null>(null);

  const { data: convData } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ["conversations", search],
    queryFn: () => fetch(`/api/messages/conversations?search=${encodeURIComponent(search)}`).then((r) => r.json()),
    refetchInterval: 5000,
  });

  const { data: threadData } = useQuery<{ conversation: Conversation & { messages: Message[] } }>({
    queryKey: ["conversation", selectedId],
    queryFn: () => fetch(`/api/messages/conversations/${selectedId}`).then((r) => r.json()),
    enabled: !!selectedId,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (data: { body: string, aiGenerationId?: string }) =>
      fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, ...data }),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) toast.error("Failed to send message.");
      else {
        setMessageText("");
        setAiDraft("");
        setGeneratedReplyId(null);
        qc.invalidateQueries({ queryKey: ["conversation", selectedId] });
        qc.invalidateQueries({ queryKey: ["conversations"] });
      }
    },
  });

  const generateAiMutation = useMutation({
    mutationFn: () =>
      fetch("/api/messages/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId }),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) {
        toast.error("AI reply generation failed. Please try again.");
      } else {
        setAiDraft(res.draftText);
        setGeneratedReplyId(res.generatedReplyId);
        toast.success("AI reply generated successfully.");
      }
    },
  });

  return (
    <div className="p-4 md:p-8 flex flex-col h-screen max-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="mt-1 text-gray-500">View and manage tenant conversations.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 flex flex-1 overflow-hidden min-h-0">
        {/* Left pane */}
        <div className={cn("w-full md:w-80 border-r border-gray-200 flex flex-col", selectedId ? "hidden md:flex" : "flex")}>
          <div className="p-4 border-b border-gray-200 shrink-0">
            <h2 className="font-medium text-gray-900 mb-3">Conversations</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by tenant name or phone number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {convData?.conversations?.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors",
                  selectedId === c.id && "bg-blue-50 border-l-2 border-l-blue-600"
                )}
              >
                <div className="font-medium text-gray-900 text-sm">
                  {c.tenant?.fullName ?? c.phoneNumber}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{c.phoneNumber}</div>
                {c.messages[0] && (
                  <div className="text-xs text-gray-400 mt-1 truncate">{c.messages[0].body}</div>
                )}
                {c.lastMessageAt && (
                  <div className="text-xs text-gray-400 mt-1">{formatDateTime(c.lastMessageAt)}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right pane */}
        <div className={cn("flex-1 flex flex-col w-full min-w-0", !selectedId ? "hidden md:flex" : "flex")}>
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Select a conversation to view messages.
            </div>
          ) : (
            <>
              {/* Header */}
              {threadData?.conversation && (
                <div className="p-4 border-b border-gray-200 flex items-center gap-3 shrink-0">
                  <button 
                    onClick={() => setSelectedId(null)} 
                    className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 bg-gray-50 rounded-full"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {threadData.conversation.tenant?.fullName ?? threadData.conversation.phoneNumber}
                    </div>
                    <div className="text-sm text-gray-500 truncate">{threadData.conversation.phoneNumber}</div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {threadData?.conversation?.messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn("flex", msg.direction === "OUTBOUND" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-xs rounded-lg px-3 py-2 text-sm",
                        msg.direction === "OUTBOUND"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-900"
                      )}
                    >
                      <p>{msg.body}</p>
                      <p className={cn("text-xs mt-1", msg.direction === "OUTBOUND" ? "text-blue-200" : "text-gray-400")}>
                        {formatDateTime(msg.sentAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Assistant Area */}
              <div className="border-t border-gray-200 bg-gray-50 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-200 shrink-0 min-h-[220px]">
                
                {/* AI Suggested Reply */}
                <div className="flex-1 p-4 flex flex-col">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-4 h-4 text-blue-600" /> AI Suggested Reply
                  </h3>
                  
                  <textarea
                    className="flex-1 w-full p-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none min-h-[80px]"
                    placeholder={generateAiMutation.isPending ? "Generating AI reply..." : "Click “Generate AI Reply” to create a suggested response."}
                    value={aiDraft}
                    onChange={(e) => setAiDraft(e.target.value)}
                    disabled={generateAiMutation.isPending}
                  />
                  
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {!aiDraft ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="bg-white"
                        onClick={() => generateAiMutation.mutate()}
                        disabled={generateAiMutation.isPending}
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        Generate AI Reply
                      </Button>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="bg-white"
                          onClick={() => generateAiMutation.mutate()}
                          disabled={generateAiMutation.isPending}
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", generateAiMutation.isPending && "animate-spin")} />
                          Regenerate
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="bg-white"
                          onClick={() => {
                            setMessageText(aiDraft);
                            toast.success("AI reply copied to manual composer.");
                          }}
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" />
                          Use in Manual Reply
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => sendMutation.mutate({ body: aiDraft, aiGenerationId: generatedReplyId! })}
                          disabled={sendMutation.isPending}
                        >
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          Send AI Reply
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Manual Reply */}
                <div className="flex-1 p-4 flex flex-col">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Manual Reply</h3>
                  <textarea
                    className="flex-1 w-full p-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none min-h-[80px]"
                    placeholder="Type your message here..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && messageText.trim()) {
                        e.preventDefault();
                        sendMutation.mutate({ body: messageText.trim() });
                      }
                    }}
                  />
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => messageText.trim() && sendMutation.mutate({ body: messageText.trim() })}
                      disabled={!messageText.trim() || sendMutation.isPending}
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Send Message
                    </Button>
                  </div>
                </div>

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
