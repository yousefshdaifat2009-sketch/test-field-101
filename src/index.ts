import { verifyKey, InteractionType, InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';

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

    // 1. Register Commands
    if (url.pathname === '/register') {
      const registerUrl = `https://discord.com/api/v10/applications/${env.DISCORD_APP_ID}/commands`;
      const response = await fetch(registerUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}` },
        body: JSON.stringify([
          { name: 'ping', description: 'Replies with Pong!', type: 1 },
          { name: 'begin', description: 'Start your character creation', type: 1 },
          { name: 'sheet', description: 'View your character sheet', type: 1 }
        ])
      });
      return new Response(`Registration response: ${await response.text()}`, { status: 200 });
    }

    // 2. Handle Interactions
    if (request.method === 'POST') {
      const signature = request.headers.get('X-Signature-Ed25519');
      const timestamp = request.headers.get('X-Signature-Timestamp');
      const body = await request.text();

      if (!(signature && timestamp && verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY))) {
        return new Response('Bad request signature', { status: 401 });
      }

      const interaction = JSON.parse(body);

      if (interaction.type === InteractionType.PING) {
        return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), { headers: { 'Content-Type': 'application/json' } });
      }

      // --- SLASH COMMANDS ---
      if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        const userId = interaction.member.user.id;
        const username = interaction.member.user.username;

        if (interaction.data.name === 'ping') {
          return new Response(JSON.stringify({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: 'Pong! 🏓' } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (interaction.data.name === 'sheet') {
          ctx.waitUntil((async () => {
            const player = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(userId).first();
            let content = "You haven't created a character yet. Use `/begin` to start.";
            if (player) {
              content = `**${player.name}**\n*${player.appearance}*\n\n**Level ${player.level}** | XP: ${player.xp}\n**Background:** ${player.background}\n**Blood Type:** ${player.blood_type}\n\n**Stats:**\n${player.stats}`;
            }
            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content })
            });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (interaction.data.name === 'begin') {
          ctx.waitUntil((async () => {
            const player = await env.DB.prepare('SELECT id FROM players WHERE id = ?').bind(userId).first();
            if (player) {
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: "You already have a character. Use `/sheet` to view it." })
              });
              return;
            }
            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                content: "Welcome to the night city. Are you ready to create your character?",
                components: [{ type: 1, components: [{ type: 2, style: 1, label: "Begin", custom_id: "start_create" }] }]
              })
            });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
        }
      }

      // --- BUTTONS ---
      if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
        if (interaction.data.custom_id === 'start_create') {
          return new Response(JSON.stringify({
            type: InteractionResponseType.MODAL,
            data: {
              custom_id: 'modal_step1',
              title: 'Step 1: Who are you?',
              components: [
                { type: 1, components: [{ type: 4, custom_id: 'name', label: 'Your Name', style: 1, min_length: 2, max_length: 32, required: true }] },
                { type: 1, components: [{ type: 4, custom_id: 'appearance', label: 'Describe your appearance', style: 2, min_length: 5, max_length: 100, required: true }] }
              ]
            }
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Step 2: Choose traits (buttons for simplicity in testing)
        if (interaction.data.custom_id === 'trait_insomnia') {
          ctx.waitUntil(updatePlayer(ctx, env, interaction, 'traits', 'Insomnia'));
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (interaction.data.custom_id === 'trait_nightowl') {
          ctx.waitUntil(updatePlayer(ctx, env, interaction, 'traits', 'Night Owl'));
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (interaction.data.custom_id === 'trait_mysterious') {
          ctx.waitUntil(updatePlayer(ctx, env, interaction, 'traits', 'Mysterious'));
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }
      }

      // --- MODALS ---
      if (interaction.type === InteractionType.MODAL_SUBMIT) {
        const userId = interaction.member.user.id;
        
        if (interaction.data.custom_id === 'modal_step1') {
          const name = interaction.data.components[0].components[0].value;
          const appearance = interaction.data.components[1].components[0].value;

          ctx.waitUntil((async () => {
            // Save temporary data (we use level 0 to indicate not finished)
            await env.DB.prepare(`
              INSERT INTO players (id, name, appearance, level) VALUES (?, ?, ?, 0)
              ON CONFLICT(id) DO UPDATE SET name = ?, appearance = ?
            `).bind(userId, name, appearance, name, appearance).run();

            // Send Step 2
            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                content: "**Step 2: What is your defining trait?**",
                components: [{ 
                  type: 1, 
                  components: [
                    { type: 2, style: 1, label: "Insomnia", custom_id: "trait_insomnia" },
                    { type: 2, style: 1, label: "Night Owl", custom_id: "trait_nightowl" },
                    { type: 2, style: 1, label: "Mysterious", custom_id: "trait_mysterious" }
                  ] 
                }]
              })
            });
          })());

          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
        }
      }
    }
    return new Response('Not found', { status: 404 });
  },
};

async function updatePlayer(ctx: ExecutionContext, env: Env, interaction: any, field: string, value: string) {
  const userId = interaction.member.user.id;
  // Update the field
  await env.DB.prepare(`UPDATE players SET ${field} = ? WHERE id = ?`).bind(value, userId).run();
  
  // Send the next step (Background)
  await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      content: `You chose **${value}**.\n\n**Step 3: What is your background?**`,
      components: [{ 
        type: 1, 
        components: [
          { type: 2, style: 1, label: "Student", custom_id: "bg_student" },
          { type: 2, style: 1, label: "Worker", custom_id: "bg_worker" },
          { type: 2, style: 1, label: "Drifter", custom_id: "bg_drifter" }
        ] 
      }]
    })
  });
}
