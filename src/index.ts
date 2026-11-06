import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';

export interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APP_ID: string;
  DISCORD_BOT_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Endpoint to register commands
    if (url.pathname === '/register') {
      const registerUrl = `https://discord.com/api/v10/applications/${env.DISCORD_APP_ID}/commands`;
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`
        },
        body: JSON.stringify({
          name: 'ping',
          description: 'Replies with Pong!',
          type: 1
        })
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

      if (!isValidRequest) {
        return new Response('Bad request signature', { status: 401 });
      }

      const interaction = JSON.parse(body);

      // 3. Handle Ping (Discord verification)
      if (interaction.type === InteractionType.PING) {
        return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 4. Handle Slash Commands
      if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        if (interaction.data.name === 'ping') {
          return new Response(JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'Pong! 🏓' }
          }), { headers: { 'Content-Type': 'application/json' } });
        }
      }
    }

    return new Response('Not found', { status: 404 });
  },
};
