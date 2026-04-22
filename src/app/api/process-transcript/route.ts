import { NextRequest, NextResponse } from 'next/server';
import { extractText } from 'unpdf';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    let transcript = '';
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const textContent = formData.get('transcript') as string | null;
      const file = formData.get('file') as File | null;
      
      // For PDFs, try server-side extraction (much more reliable than client-side)
      if (file && file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const buffer = await file.arrayBuffer();
          const { text: pdfPages } = await extractText(new Uint8Array(buffer));
          // unpdf returns text as string[] (one per page) — join them
          const pdfText = Array.isArray(pdfPages) ? pdfPages.join('\n') : String(pdfPages);
          if (pdfText && pdfText.trim().length > 50) {
            transcript = pdfText;
            console.log(`Server-side PDF extraction: ${transcript.length} chars`);
          }
        } catch (pdfError) {
          console.error('Server-side PDF extraction failed:', pdfError);
        }
      }
      
      // Fall back to client-sent text if server extraction failed or wasn't applicable
      if (!transcript || transcript.trim().length < 50) {
        if (textContent && textContent.trim().length > 50) {
          transcript = textContent;
          console.log(`Using client-sent text: ${transcript.length} chars`);
        } else if (file && !file.name.toLowerCase().endsWith('.pdf')) {
          // .txt files — read as text
          const buffer = await file.arrayBuffer();
          transcript = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
        }
      }
    } else {
      const body = await request.json();
      transcript = body.transcript || '';
    }
    
    if (!transcript || transcript.trim().length < 50) {
      return NextResponse.json({ error: 'Transcript too short or empty (' + transcript.trim().length + ' chars). Please ensure the file has readable text content.' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const maxChars = 50000;
    const truncatedTranscript = transcript.length > maxChars 
      ? transcript.substring(0, maxChars) + '\n\n[Transcript truncated due to length]'
      : transcript;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 8000,
        messages: [
          {
            role: 'system',
            content: `You are a meeting notes assistant for TWS Branding, an F&B marketing agency managing restaurant brands in Singapore. Your job is to produce COMPREHENSIVE, DETAILED meeting notes from transcripts.

CRITICAL RULES:
- Be EXTREMELY THOROUGH. This is a workplan meeting — every detail matters.
- Capture EVERY distinct topic, decision, and action item discussed. Do NOT over-summarize or skip anything.
- The transcript is likely bilingual (English + Mandarin Chinese). Process BOTH languages equally.
- Use the ACTUAL names mentioned in the transcript. Never invent or substitute names.
- If you cannot identify specific names, write "Speaker" or describe by role — NEVER use placeholder names like "John Doe".
- Discussion points: Create a bullet for EVERY separate topic. Group sub-points under topics with specific details (dates, numbers, names, locations, amounts, deadlines).
- For each topic, include ALL sub-points discussed — typically 2-6 per topic.
- Action items: Extract EVERY task, to-do, follow-up, or commitment. Include WHO is responsible and WHEN if mentioned.

OUTPUT FORMAT — use ONLY these HTML tags (h2, h3, h4, ul, li, strong, em, p). Do NOT wrap in code fences or markdown:

<h2>📋 Meeting Summary</h2>
<p><em>AI-processed transcript. Review and edit as needed.</em></p>
<p><strong>Topics:</strong> [Topic 1] · [Topic 2] · [Topic 3] · ...</p>

<h3>👥 Attendees</h3>
<ul>
<li>[Real Name 1] — [role if mentioned]</li>
<li>[Real Name 2]</li>
</ul>

<h3>📝 Key Discussion Points</h3>

<h4>[Topic 1 Title]</h4>
<ul>
<li>[Main point with specific detail]
<ul><li>[Sub-detail: dates, numbers, decisions]</li><li>[Sub-detail: who said what]</li></ul>
</li>
</ul>

[Repeat h4 + ul for EVERY topic discussed...]

<h3>✅ Decisions Made</h3>
<ul>
<li>[Decision 1 — with context]</li>
</ul>

<h3>📌 Action Items</h3>
<ul>
<li>[Task description] → <strong>[Person]</strong> — [Deadline if mentioned] 🔴</li>
</ul>

<h3>💡 Notes & Context</h3>
<ul>
<li>[Important context, concerns, or follow-ups]</li>
</ul>

Priority: 🔴 = urgent/this week, 🟡 = medium/next week, 🟢 = low/no rush

IMPORTANT: A typical 30-min F&B workplan meeting covers 5-10 topics with 15-30+ discussion bullets, 3-8 decisions, and 5-15 action items. If your output has significantly fewer, you are missing details.

OUTPUT MUST BE VALID HTML ONLY. No markdown, no code fences, no backticks. Start directly with <h2>.`
          },
          {
            role: 'user',
            content: `Process this meeting transcript into comprehensive, detailed meeting notes. Capture EVERY topic, decision, and action item. Use ONLY real names from the transcript — never invent names. Output as raw HTML only (no markdown wrapping).\n\n---\n\n${truncatedTranscript}`
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errObj = errorData as Record<string, unknown>;
      const errorMessage = errObj?.error 
        ? ((errObj.error as Record<string, string>)?.message || JSON.stringify(errObj.error))
        : `OpenAI API error: ${response.status}`;
      return NextResponse.json({ error: `AI processing failed: ${errorMessage}` }, { status: 502 });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'No content returned from AI' }, { status: 500 });
    }

    // Strip markdown code fences if AI wrapped them
    content = content.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // Count action items
    const actionSection = content.match(/<h3>📌 Action Items<\/h3>[\s\S]*?<ul>([\s\S]*?)<\/ul>/);
    const liCount = actionSection ? (actionSection[1].match(/<li>/g) || []).length : 0;

    return NextResponse.json({
      success: true,
      html: content,
      actionItemCount: liCount,
      extractedText: transcript.substring(0, 500) + (transcript.length > 500 ? '...' : ''),
      extractedLength: transcript.length,
    });

  } catch (error) {
    console.error('Process transcript error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
