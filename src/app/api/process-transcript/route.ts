import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// Server-side PDF text extraction using pdfjs-dist (works on Vercel serverless)
async function extractPDFText(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Reconstruct text preserving line breaks based on Y position changes
      let lastY = -1;
      let line = '';
      const lines: string[] = [];
      for (const item of content.items) {
        const textItem = item as { str: string; transform: number[] };
        if (!textItem.str) continue;
        const y = Math.round(textItem.transform[5]);
        if (lastY !== -1 && Math.abs(y - lastY) > 2) {
          if (line.trim()) lines.push(line.trim());
          line = textItem.str;
        } else {
          line += (line && !line.endsWith(' ') ? ' ' : '') + textItem.str;
        }
        lastY = y;
      }
      if (line.trim()) lines.push(line.trim());
      pages.push(lines.join('\n'));
    }
    return pages.join('\n\n');
  } catch (e) {
    console.error('PDF parse error:', e);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    let transcript = '';
    
    // Handle multipart form data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const textContent = formData.get('transcript') as string | null;
      
      if (file) {
        const buffer = await file.arrayBuffer();
        if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
          transcript = await extractPDFText(buffer);
          if (!transcript.trim()) {
            // Fallback: try reading as text
            transcript = new TextDecoder().decode(buffer);
          }
        } else {
          transcript = new TextDecoder().decode(buffer);
        }
      } else if (textContent) {
        transcript = textContent;
      }
    } else {
      // Handle JSON body (text already extracted by client)
      const body = await request.json();
      transcript = body.transcript || '';
    }
    
    if (!transcript || transcript.trim().length < 50) {
      return NextResponse.json({ error: 'Transcript too short or empty. Extracted: ' + transcript.length + ' chars' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Truncate very long transcripts to stay within token limits
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
        temperature: 0.3,
        max_tokens: 4000,
        messages: [
          {
            role: 'system',
            content: `You are a meeting notes assistant for TWS Branding, an F&B marketing agency managing restaurant brands in Singapore. Your job is to produce COMPREHENSIVE, DETAILED meeting notes from transcripts.

CRITICAL RULES:
- Be THOROUGH. Capture EVERY distinct topic, decision, and action item discussed. Do NOT over-summarize.
- The transcript may be bilingual (English + Mandarin Chinese). Process BOTH languages.
- Attendee names: extract real names mentioned (not brand names). If someone is referred to by role only, note the role.
- Discussion points: Create a bullet for EVERY separate topic discussed. Group related sub-points under the main topic. Include specific details (dates, numbers, names, locations, amounts).
- For each discussion topic, include 2-4 sub-bullets with the specific details discussed.
- Action items: Extract EVERY task, to-do, follow-up, or commitment mentioned. Be specific about what needs to be done.

OUTPUT FORMAT (use this exact structure):

## 📋 Meeting Summary

**Topics:** [List all major topics separated by · ]

## 👥 Attendees
- [Name 1] — [role if mentioned]
- [Name 2] — [role if mentioned]

## 📝 Key Discussion Points

### [Topic 1 Title]
- [Main point with specific detail]
  - [Sub-detail: dates, numbers, decisions]
  - [Sub-detail: who said what, context]

### [Topic 2 Title]
- [Main point]
  - [Sub-detail]

[Continue for ALL topics discussed...]

## ✅ Decisions Made
- [Decision 1 — with context on why]
- [Decision 2 — with context on why]
- [Continue for ALL decisions...]

## 📌 Action Items
- [Specific task description] → **[Person responsible]** — [Deadline if mentioned] 🔴
- [Specific task description] → **[Person responsible]** — [Deadline if mentioned] 🟡
- [Task with no clear owner] → **TBD** 🟡

Priority: 🔴 = urgent/this week, 🟡 = medium/next week, 🟢 = low/no rush

## 💡 Notes & Context
- [Any important context, concerns raised, or things to watch]
- [Follow-up items that aren't tasks but need attention]

IMPORTANT: A 30-minute meeting typically has 15-25 discussion bullets across 5-8 topics, 3-8 decisions, and 5-15 action items. If your output has fewer, you are missing details. Go back and re-read the transcript.`
          },
          {
            role: 'user',
            content: `Process this meeting transcript into comprehensive, detailed meeting notes. Capture EVERY topic discussed, every decision made, and every action item or follow-up mentioned. Do not skip anything.\n\n---\n\n${truncatedTranscript}`
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as Record<string, unknown>)?.error 
        ? ((errorData as Record<string, { message?: string }>).error?.message || JSON.stringify((errorData as Record<string, unknown>).error))
        : `OpenAI API error: ${response.status}`;
      console.error('OpenAI error:', errorMessage);
      return NextResponse.json({ 
        error: `AI processing failed: ${errorMessage}` 
      }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'No content returned from AI' }, { status: 500 });
    }

    // Parse the structured response
    const sections = parseAIResponse(content);

    return NextResponse.json({
      success: true,
      raw_ai_response: content,
      extractedText: transcript,
      ...sections
    });

  } catch (error) {
    console.error('Process transcript error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error processing transcript' 
    }, { status: 500 });
  }
}

function parseAIResponse(content: string) {
  // Extract attendees
  const attendeeSection = content.match(/## 👥 Attendees\n([\s\S]*?)(?=\n## )/);
  const attendees = attendeeSection 
    ? attendeeSection[1].match(/- .+/g)?.map(a => a.replace(/^- /, '').trim()) || []
    : [];

  // Extract topics
  const topicMatch = content.match(/\*\*Topics?:\*\*\s*(.+)/);
  const topics = topicMatch 
    ? topicMatch[1].split(/[·,]/).map(t => t.trim()).filter(Boolean)
    : [];

  // Extract action items
  const actionSection = content.match(/## 📌 Action Items\n([\s\S]*?)(?=\n## |$)/);
  const actionItems = actionSection
    ? actionSection[1].match(/- .+/g)?.map(item => {
        const text = item.replace(/^- /, '').trim();
        const priorityMatch = text.match(/🔴|🟡|🟢/);
        const personMatch = text.match(/\*\*(.+?)\*\*/);
        return {
          task: text.replace(/→.*$/, '').replace(/🔴|🟡|🟢/g, '').trim(),
          assignee: personMatch ? personMatch[1] : null,
          priority: priorityMatch?.[0] === '🔴' ? 'high' : priorityMatch?.[0] === '🟡' ? 'medium' : 'low'
        };
      }) || []
    : [];

  // Extract decisions
  const decisionSection = content.match(/## ✅ Decisions Made\n([\s\S]*?)(?=\n## )/);
  const decisions = decisionSection
    ? decisionSection[1].match(/- .+/g)?.map(d => d.replace(/^- /, '').trim()) || []
    : [];

  return {
    attendees,
    topics,
    actionItems,
    decisions,
    formattedContent: content
  };
}
