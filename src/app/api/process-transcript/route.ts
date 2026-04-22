import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    let transcript = '';
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const textContent = formData.get('transcript') as string | null;
      const file = formData.get('file') as File | null;
      
      if (textContent && textContent.trim().length > 10) {
        transcript = textContent;
      } else if (file) {
        // Try reading file as text (works for .txt, .md)
        const buffer = await file.arrayBuffer();
        transcript = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
        // Clean up any binary garbage for PDFs read as text
        transcript = transcript.replace(/[^\x20-\x7E\n\r\t\u00A0-\uFFFF]/g, ' ').replace(/ {3,}/g, ' ');
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

OUTPUT FORMAT (use this exact structure with HTML tags for rich text editor):

<h2>📋 Meeting Summary</h2>
<p><em>AI-processed transcript. Review and edit as needed.</em></p>
<p><strong>Topics:</strong> [Topic 1] · [Topic 2] · [Topic 3] · ...</p>

<h3>👥 Attendees</h3>
<ul>
<li>[Name 1] — [role if mentioned]</li>
<li>[Name 2]</li>
</ul>

<h3>📝 Key Discussion Points</h3>

<h4>[Topic 1 Title]</h4>
<ul>
<li>[Main point with specific detail]
<ul><li>[Sub-detail: dates, numbers, decisions]</li><li>[Sub-detail: who said what]</li></ul>
</li>
<li>[Another point under this topic]</li>
</ul>

<h4>[Topic 2 Title]</h4>
<ul>
<li>[Main point]
<ul><li>[Sub-detail]</li></ul>
</li>
</ul>

[Continue for ALL topics discussed...]

<h3>✅ Decisions Made</h3>
<ul>
<li>[Decision 1 — with context]</li>
<li>[Decision 2 — with context]</li>
</ul>

<h3>📌 Action Items</h3>
<ul>
<li>[Task description] → <strong>[Person]</strong> — [Deadline] 🔴</li>
<li>[Task description] → <strong>[Person]</strong> 🟡</li>
</ul>

<h3>💡 Notes & Context</h3>
<ul>
<li>[Important context or concerns]</li>
<li>[Follow-up items]</li>
</ul>

Priority: 🔴 = urgent/this week, 🟡 = medium/next week, 🟢 = low/no rush

IMPORTANT: A 30-minute meeting typically has 15-25 discussion bullets across 5-8 topics, 3-8 decisions, and 5-15 action items. If your output has fewer, you are missing details. Go back and re-read the transcript.

OUTPUT MUST BE VALID HTML. Use <h2>, <h3>, <h4>, <ul>, <li>, <strong>, <em>, <p> tags. Do NOT use markdown.`
          },
          {
            role: 'user',
            content: `Process this meeting transcript into comprehensive, detailed meeting notes. Capture EVERY topic discussed, every decision made, and every action item or follow-up mentioned. Do not skip anything. Output as HTML.\n\n---\n\n${truncatedTranscript}`
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
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'No content returned from AI' }, { status: 500 });
    }

    // Count action items from the HTML
    const actionItemCount = (content.match(/📌|→\s*<strong>/g) || []).length;
    // Count by li items in action items section
    const actionSection = content.match(/<h3>📌 Action Items<\/h3>\s*<ul>([\s\S]*?)<\/ul>/);
    const liCount = actionSection ? (actionSection[1].match(/<li>/g) || []).length : 0;

    return NextResponse.json({
      success: true,
      html: content,
      actionItemCount: liCount || actionItemCount,
      extractedText: transcript,
    });

  } catch (error) {
    console.error('Process transcript error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
