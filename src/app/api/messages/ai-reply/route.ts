export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hasPermission } from "@/lib/auth";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hasAccess = await hasPermission(user.id, "generate_ai_replies");
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { conversationId } = await req.json();
    if (!conversationId) return NextResponse.json({ error: "conversationId is required" }, { status: 400 });

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const property = conversation.propertyId ? await prisma.property.findUnique({ where: { id: conversation.propertyId } }) : null;
    const tenant = conversation.tenantId ? await prisma.tenant.findUnique({ where: { id: conversation.tenantId } }) : null;

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    if (!process.env.GROQ_API_KEY || !process.env.GROQ_MODEL_NAME) {
      return NextResponse.json({ error: "Groq is not configured" }, { status: 500 });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Build the system prompt
    let systemPrompt = `You are an AI assistant for a professional property management company.
Your job is to generate a short, professional, and helpful SMS-style response to the tenant.
Do NOT make unsupported promises or financial guarantees.
Do NOT reveal internal-only data.
Keep it concise and conversational.
Always sign off with "- KPMS BOT" on a new line at the very end.`;

    if (property) {
      systemPrompt += `\nProperty Context: ${property.address1}, ${property.city}, ${property.state}.`;
    }
    if (tenant) {
      systemPrompt += `\nTenant Context: ${tenant.fullName}.`;
    }

    const chatMessages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of messages) {
      chatMessages.push({
        role: msg.direction === "INBOUND" ? "user" : "assistant",
        content: msg.body,
      });
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: chatMessages,
      model: process.env.GROQ_MODEL_NAME,
      temperature: 0.3,
      max_tokens: 250,
    });

    const draftText = chatCompletion.choices[0]?.message?.content?.trim() || "";

    const generation = await prisma.aiReplyGeneration.create({
      data: {
        conversationId,
        sourceMessageId: messages.length > 0 ? messages[messages.length - 1].id : null,
        draftText,
        wasAutoSent: false,
      }
    });

    return NextResponse.json({
      ok: true,
      draftText,
      generatedReplyId: generation.id,
    });
  } catch (error: any) {
    console.error("[ai-reply]", error);
    return NextResponse.json({ error: "Failed to generate AI reply" }, { status: 500 });
  }
}
