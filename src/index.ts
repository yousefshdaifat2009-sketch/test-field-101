import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';

export interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APP_ID: string;
  DISCORD_BOT_TOKEN: string;
  GROQ_API_KEY: string;
  OWNER_DISCORD_ID: string;
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Endpoint to register commands
    if (url.pathname === '/register') {
      const registerUrl = `https://discord.com/api/v10/applications/${env.DISCORD_APP_ID}/commands`;
      const response = await fetch(registerUrl, {
        method: 'PUT', // PUT overwrites existing commands so we don't get duplicates
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`
        },
        body: JSON.stringify([
          { name: 'ping', description: 'Replies with Pong!', type: 1 },
          { 
            name: 'test-ai', 
            description: 'Test the AI connection', 
            type: 1,
            options: [
              { name: 'prompt', description: 'What to say to the AI', type: 3, required: true }
            ]
          }
        ])
      });
      const data = await response.text();
      return new Response(`Registration response: ${data}`, { status: 200 });
    }

    // 2. Verify Discord Requests
    if (request.method === 'POST') {
      const signature = request.headers.get('X-Signature-Ed25519');
      const timestamp = request.headers.get('X-Signature-Timestamp');
      const body = await request.text();

      const isValidRequest = signature && timestamp && verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
      if (!isValidRequest) return new Response('Bad request signature', { status: 401 });

      const interaction = JSON.parse(body);

      // Handle Ping (Discord verification)
      if (interaction.type === InteractionType.PING) {
        return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle Slash Commands
      if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        
        // --- /ping COMMAND ---
        if (interaction.data.name === 'ping') {
          return new Response(JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'Pong! 🏓' }
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        // --- /test-ai COMMAND ---
        if (interaction.data.name === 'test-ai') {
          const prompt = interaction.data.options[0].value;
          
          // We must defer the response because AI takes longer than 3 seconds
          ctx.waitUntil((async () => {
            try {
              // 1. Check AI usage limit in DB
              const today = new Date().toISOString().split('T')[0];
              let usage = await env.DB.prepare('SELECT count FROM ai_usage WHERE date = ?').bind(today).first();
              let currentCount = usage ? (usage.count as number) : 0;

              if (currentCount >= 900) {
                await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: "…the night goes quiet. (AI daily limit reached)." })
                });
                return;
              }

              // 2. Call Groq API
              const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${env.GROQ_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  model: 'llama3-8b-8192', // Cheapest fast model
                  messages: [
                    { role: 'system', content: 'You are a narrator for the anime Call of the Night. Be brief, melancholic, and mysterious.' },
                    { role: 'user', content: prompt }
                  ],
                  max_tokens: 150
                })
              });

              const groqData: any = await groqRes.json();
              const aiReply = groqData.choices[0].message.content;

              // 3. Update usage count in DB
              await env.DB.prepare(`
                INSERT INTO ai_usage (date, count) VALUES (?, 1) 
                ON CONFLICT(date) DO UPDATE SET count = count + 1
              `).bind(today).run();

              // 4. Edit the Discord message with the AI reply
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: `**AI:** ${aiReply}` })
              });

            } catch (error) {
              console.error(error);
            }
          })());

          // Tell Discord we are thinking...
          return new Response(JSON.stringify({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
          }), { headers: { 'Content-Type': 'application/json' } });
        }
      }
    }

    return new Response('Not found', { status: 404 });
  },
};
