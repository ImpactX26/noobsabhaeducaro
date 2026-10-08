import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/store/AuthContext";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, type PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import agent from "@/assets/sieg-agent.png";

const SUGGESTIONS = [
  "Which German universities fit my profile?",
  "What documents am I still missing?",
  "How does the APS certificate work?",
  "What will studying in Germany cost me per year?",
];

function ChatWindow({ initial, userId }: { initial: UIMessage[]; userId: string }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(() => new DefaultChatTransport({
    api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
    headers: async () => {
      const { data } = await supabase.auth.getSession();
      return { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${data.session?.access_token ?? ""}` };
    },
  }), []);
  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: userId, messages: initial, transport,
    onError: (e) => toast.error(e.message?.includes("{") ? (JSON.parse(e.message).error ?? "Something went wrong.") : e.message || "Something went wrong."),
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => { if (!busy) ref.current?.focus(); }, [busy]);

  const send = (t: string) => { if (!t.trim() || busy) return; sendMessage({ text: t }); setText(""); };
  const clear = async () => {
    const { error } = await supabase.from("chat_messages").delete().eq("user_id", userId);
    if (error) return toast.error("Could not clear the chat.");
    setMessages([]);
  };

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[480px] flex-col border border-sieg-white/15 bg-sieg-black md:h-[calc(100vh-12rem)]">
      <div className="flex items-center gap-3 border-b border-sieg-white/10 px-5 py-3">
        <img src={agent} alt="" width={32} height={32} className="h-8 w-8" />
        <div className="flex-1">
          <p className="font-display text-lg uppercase leading-none">sieg.ai advisor</p>
          <p className="font-mono-label text-[9px] text-sieg-white/50">Knows your profile & documents</p>
        </div>
        {messages.length > 0 && (
          <button onClick={clear} className="font-mono-label flex items-center gap-1 text-[10px] text-sieg-white/50 hover:text-sieg-red"><Trash2 className="h-3 w-3" />Clear</button>
        )}
      </div>

      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <img src={agent} alt="sieg.ai" width={72} height={72} className="h-18 w-18" />
              <p className="font-display mt-4 text-3xl uppercase">Ask me anything about Germany</p>
              <p className="mt-2 max-w-md text-sm text-sieg-white/60">I use your profile and uploaded documents to give advice that fits you.</p>
              <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="border border-sieg-white/20 px-3 py-2 text-left text-sm hover:border-sieg-yellow hover:text-sieg-yellow">{s}</button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => (
              <Message from={m.role} key={m.id}>
                <MessageContent className={m.role === "user" ? "!bg-sieg-yellow !text-sieg-black" : "!bg-transparent text-sieg-white"}>
                  {m.parts.map((p, i) => p.type === "text"
                    ? (m.role === "assistant" ? <MessageResponse key={i}>{p.text}</MessageResponse> : <p key={i} className="whitespace-pre-wrap">{p.text}</p>)
                    : null)}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && <Shimmer className="px-1 text-sm">Thinking about your journey…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-sieg-white/10 p-3">
        <PromptInput onSubmit={(msg: PromptInputMessage) => send(msg.text ?? "")} className="border-sieg-white/20 bg-sieg-ink">
          <PromptInputTextarea ref={ref} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about universities, visas, documents…" className="text-sieg-white" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} className="bg-sieg-red text-sieg-white hover:bg-sieg-yellow hover:text-sieg-black" />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export default function Chat() {
  const { user } = useAuth();
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.from("chat_messages").select("message").eq("user_id", user.id).order("created_at").then(({ data, error }) => {
      if (error) toast.error("Could not load your chat history.");
      setInitial((data ?? []).map((r) => r.message as unknown as UIMessage));
    });
  }, [user]);
  if (!user || !initial) return <Shimmer>Loading your advisor…</Shimmer>;
  return <ChatWindow initial={initial} userId={user.id} />;
}
