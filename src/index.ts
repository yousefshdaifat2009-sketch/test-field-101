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

    if (url.pathname === '/register') {
      const registerUrl = `https://discord.com/api/v10/applications/${env.DISCORD_APP_ID}/commands`;
      const response = await fetch(registerUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}` },
        body: JSON.stringify([
          { name: 'ping', description: 'Replies with Pong!', type: 1 },
          { name: 'begin', description: 'Start your character creation', type: 1 },
          { name: 'sheet', description: 'View your character sheet', type: 1 },
          { name: 'explore', description: 'Explore the city', type: 1 }
        ])
      });
      return new Response(`Registration response: ${await response.text()}`, { status: 200 });
    }

    if (request.method === 'POST') {
      const signature = request.headers.get('X-Signature-Ed25519');
      const timestamp = request.headers.get('X-Signature-Timestamp');
      const body = await request.text();

      if (!(signature && timestamp && verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY))) {
        return new Response('Bad request signature', { status: 401 });
      }

      const interaction = JSON.parse(body);
      const userId = interaction.member?.user?.id;

      if (interaction.type === InteractionType.PING) {
        return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), { headers: { 'Content-Type': 'application/json' } });
      }

      // --- SLASH COMMANDS ---
      if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        if (interaction.data.name === 'sheet') {
          ctx.waitUntil((async () => {
            const player = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(userId).first();
            let content = "You haven't created a character yet. Use `/begin` to start.";
            if (player && player.level > 0) {
              content = `**${player.name}**\n*${player.appearance}*\n\n**Level ${player.level}** | XP: ${player.xp}\n**Trait:** ${player.traits}\n**Background:** ${player.background}\n**Blood Type:** ${player.blood_type}\n\n**Stats:**\n${player.stats}`;
            }
            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content })
            });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (interaction.data.name === 'begin') {
          ctx.waitUntil((async () => {
            const player = await env.DB.prepare('SELECT level FROM players WHERE id = ?').bind(userId).first();
            if (player && player.level > 0) {
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: "You already have a character. Use `/sheet` to view it." })
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

        if (interaction.data.name === 'explore') {
          const tokyoHour = (new Date().getUTCHours() + 9) % 24;
          const isNight = tokyoHour >= 18 || tokyoHour < 6;
          const phaseText = isNight ? "🌙 Night" : "☀️ Day";

          return new Response(JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: InteractionResponseFlags.EPHEMERAL,
              content: `**It is currently ${phaseText} in Tokyo.**\nWhere do you want to go?`,
              components: [
                { type: 1, components: [
                  { type: 2, style: 1, label: "Rooftop", custom_id: "go_rooftop" },
                  { type: 2, style: 1, label: "Konbini", custom_id: "go_konbini" },
                  { type: 2, style: 1, label: "Park", custom_id: "go_park" },
                  { type: 2, style: 1, label: "Your Apartment", custom_id: "go_apartment" }
                ]}
              ]
            }
          }), { headers: { 'Content-Type': 'application/json' } });
        }
      }

      // --- BUTTONS ---
      if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
        const cid = interaction.data.custom_id;

        // Character Creation Buttons
        if (cid === 'start_create') {
          return new Response(JSON.stringify({
            type: InteractionResponseType.MODAL,
            data: {
              custom_id: 'modal_step1', title: 'Step 1: Who are you?',
              components: [
                { type: 1, components: [{ type: 4, custom_id: 'name', label: 'Your Name', style: 1, min_length: 2, max_length: 32, required: true }] },
                { type: 1, components: [{ type: 4, custom_id: 'appearance', label: 'Describe your appearance', style: 2, min_length: 5, max_length: 100, required: true }] }
              ]
            }
          }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid.startsWith('trait_')) {
          const trait = cid.replace('trait_', '');
          ctx.waitUntil(env.DB.prepare(`UPDATE players SET traits = ? WHERE id = ?`).bind(trait, userId).run());
          return new Response(JSON.stringify({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: { content: `You chose **${trait}**.\n\n**Step 3: What is your background?**`, components: [{ type: 1, components: [{ type: 2, style: 1, label: "Student", custom_id: "bg_student" }, { type: 2, style: 1, label: "Worker", custom_id: "bg_worker" }, { type: 2, style: 1, label: "Drifter", custom_id: "bg_drifter" }]}] }
          }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid.startsWith('bg_')) {
          const bg = cid.replace('bg_', '');
          ctx.waitUntil(env.DB.prepare(`UPDATE players SET background = ? WHERE id = ?`).bind(bg, userId).run());
          return new Response(JSON.stringify({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: { content: `You chose **${bg}**.\n\n**Step 4: What is your blood type?**`, components: [{ type: 1, components: [{ type: 2, style: 1, label: "Type A", custom_id: "blood_A" }, { type: 2, style: 1, label: "Type B", custom_id: "blood_B" }, { type: 2, style: 1, label: "Type AB", custom_id: "blood_AB" }, { type: 2, style: 1, label: "Type O", custom_id: "blood_O" }]}] }
          }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid.startsWith('blood_')) {
          const blood = cid.replace('blood_', '');
          ctx.waitUntil(env.DB.prepare(`UPDATE players SET blood_type = ? WHERE id = ?`).bind(blood, userId).run());
          return new Response(JSON.stringify({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: { content: `Blood Type **${blood}**.\n\n**Step 5: Choose your starting stat focus.**`, components: [{ type: 1, components: [{ type: 2, style: 1, label: "Balanced", custom_id: "stats_balanced" }, { type: 2, style: 1, label: "Charming", custom_id: "stats_charm" }, { type: 2, style: 1, label: "Mysterious", custom_id: "stats_mystery" }]}] }
          }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid.startsWith('stats_')) {
          const statType = cid.replace('stats_', '');
          let statsStr = statType === 'balanced' ? "Charm 3, Mystery 3, Nerve 3, Empathy 3, Night-sense 1" : statType === 'charm' ? "Charm 5, Mystery 2, Nerve 2, Empathy 3, Night-sense 1" : "Charm 1, Mystery 5, Nerve 3, Empathy 2, Night-sense 2";
          ctx.waitUntil(env.DB.prepare(`UPDATE players SET stats = ?, level = 1 WHERE id = ?`).bind(statsStr, userId).run());
          return new Response(JSON.stringify({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: { content: `**Character Creation Complete!**\n\nUse \`/sheet\` to view your profile. The night awaits.`, components: [] }
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        // --- EXPLORE BUTTONS ---
        if (cid.startsWith('go_')) {
          const location = cid.replace('go_', '');
          const locName = location.charAt(0).toUpperCase() + location.slice(1);
          
          ctx.waitUntil((async () => {
            // 1. Create a thread
            const threadRes = await fetch(`https://discord.com/api/v10/channels/${interaction.channel_id}/threads`, {
              method: 'POST',
              headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: locName, type: 11, auto_archive_duration: 60 })
            });
            const threadData: any = await threadRes.json();
            const threadId = threadData.id;

            // 2. Save scene to DB
            await env.DB.prepare(`INSERT INTO scenes (id, channel_id, location) VALUES (?, ?, ?)`).bind(threadId, interaction.channel_id, location).run();

            // 3. Ask AI to describe the scene
            const tokyoHour = (new Date().getUTCHours() + 9) % 24;
            const isNight = tokyoHour >= 18 || tokyoHour < 6;
            const timeStr = isNight ? "night" : "day";

            let desc = "";
            try {
              const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: 'openai/gpt-oss-20b',
                  messages: [{ role: 'system', content: `You are a narrator for Call of the Night. Write a 2-sentence atmospheric description of a ${locName} at ${timeStr}. Be melancholic and brief.` }],
                  max_tokens: 1000
                })
              });
              if (!aiRes.ok) throw new Error(`Groq API Error: ${await aiRes.text()}`);
              const aiData: any = await aiRes.json();
              desc = aiData.choices[0].message.content;
              if (!desc || desc.trim() === "") throw new Error(`Empty AI response.`);
            } catch (error: any) {
              desc = `**Error generating scene:** ${error.message}`;
            }

            // 4. Send message to the thread with Actions
            const buttons = [];
            if (location === 'rooftop') buttons.push({ type: 2, style: 1, label: "Talk to Nazuna", custom_id: "talk_nazuna" });
            buttons.push({ type: 2, style: 4, label: "Leave", custom_id: "leave_scene" });

            await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
              method: 'POST',
              headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                content: `**${locName}**\n\n${desc}`,
                components: [{ type: 1, components: buttons }]
              })
            });

            // 5. Delete the ephemeral message
            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
              method: 'DELETE'
            });
          })());

          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }

        // --- TALK TO NAZUNA ---
        if (cid === 'talk_nazuna') {
          return new Response(JSON.stringify({
            type: InteractionResponseType.MODAL,
            data: {
              custom_id: 'modal_nazuna', title: 'Talk to Nazuna',
              components: [
                { type: 1, components: [{ type: 4, custom_id: 'message', label: 'What do you say?', style: 2, min_length: 1, max_length: 500, required: true }] }
              ]
            }
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        // --- LEAVE SCENE ---
        if (cid === 'leave_scene') {
          ctx.waitUntil((async () => {
             await fetch(`https://discord.com/api/v10/channels/${interaction.channel_id}`, {
              method: 'PATCH',
              headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ archived: true })
            });
             await env.DB.prepare(`UPDATE scenes SET status = 'closed' WHERE id = ?`).bind(interaction.channel_id).run();
          })());
          return new Response(JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: "You leave the scene. The night moves on." }
          }), { headers: { 'Content-Type': 'application/json' } });
        }
      }

      // --- MODALS ---
      if (interaction.type === InteractionType.MODAL_SUBMIT) {
        if (interaction.data.custom_id === 'modal_step1') {
          const name = interaction.data.components[0].components[0].value;
          const appearance = interaction.data.components[1].components[0].value;

          ctx.waitUntil((async () => {
            await env.DB.prepare(`
              INSERT INTO players (id, name, appearance, level) VALUES (?, ?, ?, 0)
              ON CONFLICT(id) DO UPDATE SET name = ?, appearance = ?
            `).bind(userId, name, appearance, name, appearance).run();
          })());

          return new Response(JSON.stringify({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: { content: `Name: **${name}**\nAppearance: *${appearance}*\n\n**Step 2: What is your defining trait?**`, components: [{ type: 1, components: [{ type: 2, style: 1, label: "Insomnia", custom_id: "trait_Insomnia" }, { type: 2, style: 1, label: "Night Owl", custom_id: "trait_NightOwl" }, { type: 2, style: 1, label: "Mysterious", custom_id: "trait_Mysterious" }]}] }
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        // --- NAZUNA DIALOGUE ---
        if (interaction.data.custom_id === 'modal_nazuna') {
          const userMessage = interaction.data.components[0].components[0].value;
          const threadId = interaction.channel_id;
          
          ctx.waitUntil((async () => {
            try {
              // Fetch player info to make the AI know who they are talking to
              const player: any = await env.DB.prepare('SELECT name FROM players WHERE id = ?').bind(userId).first();
              const playerName = player ? player.name : "a stranger";

              const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: 'openai/gpt-oss-20b',
                  messages: [
                    { role: 'system', content: `You are Nazuna Nanakusa from Call of the Night. You are a vampire. You are teasing, slightly sarcastic, but caring. You are talking to ${playerName}. Never break character. Keep responses to 1-3 sentences.` },
                    { role: 'user', content: userMessage }
                  ],
                  max_tokens: 1000
                })
              });
              const aiData: any = await aiRes.json();
              const reply = aiData.choices[0].message.content;

              // Send Nazuna's reply as a webhook to look like her
              const webhookRes = await fetch(`https://discord.com/api/v10/channels/${threadId}/webhooks`, {
                method: 'POST',
                headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: "Nazuna" })
              });
              const webhookData: any = await webhookRes.json();
              
              await fetch(`https://discord.com/api/webhooks/${webhookData.id}/${webhookData.token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  content: reply,
                  username: "Nazuna Nanakusa",
                  avatar_url: "https://i.imgur.com/your_nazuna_image.png" // Placeholder
                })
              });

            } catch (error) {
              console.error(error);
            }
          })());

          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE }), { headers: { 'Content-Type': 'application/json' } });
        }
      }
    }
    return new Response('Not found', { status: 404 });
  },
};
