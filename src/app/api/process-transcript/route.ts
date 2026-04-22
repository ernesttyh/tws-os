import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { transcript, title, source } = await req.json();
    
    if (!transcript || transcript.trim().length < 20) {
      return NextResponse.json({ error: 'Transcript too short or empty' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI processing not configured. Add OPENAI_API_KEY to environment.', fallback: true }, { status: 503 });
    }

    // Truncate to ~15000 chars for GPT-4o-mini (fits in 128K context easily)
    const truncated = transcript.length > 15000 ? transcript.slice(0, 15000) + '\n\n[... transcript truncated ...]' : transcript;

    const systemPrompt = `You are an AI assistant that processes meeting transcripts for TWS Branding, a food & beverage marketing agency in Singapore.

Analyze the raw transcript and produce a structured meeting summary as JSON.

Return EXACTLY this JSON structure:
{
  "attendees": ["Name 1", "Name 2"],
  "summary": ["Key discussion point 1", "Key discussion point 2"],
  "decisions": ["Decision 1", "Decision 2"],
  "actionItems": [
    { "task": "Clear description of what needs to be done", "assignee": "Person name or null", "priority": "high|medium|low" }
  ],
  "topics": ["Main Topic 1", "Main Topic 2"]
}

Guidelines:
- **summary**: 5-12 concise bullet points capturing the MOST IMPORTANT discussion points. Focus on business decisions, strategy changes, deadlines, and updates.
- **actionItems**: Extract REAL action items — concrete tasks someone needs to do (not just discussion points). Include who should do it if mentioned. Mark urgent/deadline items as "high" priority.
- **attendees**: Extract names of people who spoke or were referenced as present. Use the name as spoken (e.g., "Ernest", "Linden").
- **decisions**: Firm agreements, confirmations, or conclusions reached during the meeting.
- **topics**: 2-6 high-level topic labels for the meeting.
- Keep each bullet point to 1-2 sentences max.
- The transcript may contain English, Mandarin (Chinese), or Singlish. Summarize everything in English but keep brand names, dish names, and local terms as-is.
- If the transcript quality is poor (speech-to-text errors), do your best to interpret the meaning.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Meeting: "${title || 'Untitled Meeting'}"\nSource: ${source || 'transcript'}\n\nRaw Transcript:\n${truncated}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI API error:', response.status, errText);
      // Parse OpenAI error for user-friendly message
      let detail = '';
      try {
        const errJson = JSON.parse(errText);
        detail = errJson?.error?.message || errText.substring(0, 200);
      } catch { detail = errText.substring(0, 200); }
      return NextResponse.json({ 
        error: `AI service error (${response.status}): ${detail}`, 
        fallback: true 
      }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json({ error: 'AI returned empty response', fallback: true }, { status: 502 });
    }

    const result = JSON.parse(content);
    
    // Validate structure
    return NextResponse.json({
      attendees: Array.isArray(result.attendees) ? result.attendees : [],
      summary: Array.isArray(result.summary) ? result.summary : [],
      decisions: Array.isArray(result.decisions) ? result.decisions : [],
      actionItems: Array.isArray(result.actionItems) ? result.actionItems : [],
      topics: Array.isArray(result.topics) ? result.topics : [],
    });
  } catch (err: unknown) {
    console.error('Process transcript error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message, fallback: true }, { status: 500 });
  }
}
