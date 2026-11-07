import { verifyKey, InteractionType, InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';

export interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APP_ID: string;
  DISCORD_BOT_TOKEN: string;
  GROQ_API_KEY: string;
  OWNER_DISCORD_ID: string;
  GAME_CHANNEL_ID: string;
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
          { name: 'explore', description: 'Explore the city', type: 1 },
          { name: 'progress', description: 'Check your XP and level', type: 1 },
          { name: 'cases', description: 'View your active cases', type: 1 },
          { name: 'notebook', description: 'View your collected clues', type: 1 },
          { name: 'bonds', description: 'View your relationships with NPCs', type: 1 }
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
        
        if (interaction.data.name === 'bonds') {
          ctx.waitUntil((async () => {
            const bonds = await env.DB.prepare('SELECT * FROM npc_bonds WHERE player_id = ?').bind(userId).all();
            let content = "**Your Bonds**\n\n";
            
            if (bonds.results.length === 0) {
              content += "You haven't bonded with anyone yet.";
            } else {
              bonds.results.forEach((b: any) => {
                let tier = "Stranger";
                const pts = Number(b.points) || 0;
                if (pts >= 120) tier = "Best Friend 🟢";
                else if (pts >= 60) tier = "Trusted 🔵";
                else if (pts >= 30) tier = "Ally 🟣";
                else if (pts >= 10) tier = "Acquaintance 🟡";

                content += `**${b.npc_id.toUpperCase()}:** ${tier} (${pts} pts)\n`;
              });
            }

            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content })
            });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (interaction.data.name === 'cases') {
          ctx.waitUntil((async () => {
            const quests = await env.DB.prepare('SELECT * FROM quests_progress WHERE player_id = ? AND status = "active"').bind(userId).all();
            
            let content = "**Your Active Cases**\n\n";
            if (quests.results.length === 0) {
              content += "You have no active cases. Explore the city to find clues.";
            } else {
              quests.results.forEach((q: any) => {
                content += `**Case:** ${q.quest_id.replace(/_/g, ' ').toUpperCase()}\n`;
              });
            }

            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content })
            });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (interaction.data.name === 'notebook') {
          ctx.waitUntil((async () => {
            const quests = await env.DB.prepare('SELECT * FROM quests_progress WHERE player_id = ?').bind(userId).all();
            
            let content = "**Your Notebook**\n\n";
            let hasClues = false;
            
            quests.results.forEach((q: any) => {
              if (q.clues) {
                hasClues = true;
                content += `**Case:** ${q.quest_id.replace(/_/g, ' ').toUpperCase()}\n`;
                const cluesArr = JSON.parse(q.clues);
                cluesArr.forEach((c: string) => {
                  content += `- ${c}\n`;
                });
                content += "\n";
              }
            });

            if (!hasClues) content += "Your notebook is empty.";

            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content })
            });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (interaction.data.name === 'progress') {
          ctx.waitUntil((async () => {
            try {
              const player: any = await env.DB.prepare('SELECT level, xp FROM players WHERE id = ?').bind(userId).first();
              let content = "You haven't created a character yet. Use `/begin` to start.";
              
              if (player) {
                const lvl = Number(player.level) || 1;
                const xp = Math.max(0, Number(player.xp) || 0);
                const xpNeeded = lvl * 100; 
                
                const barLength = 10;
                const progress = Math.max(0, Math.min(Math.floor((xp / xpNeeded) * barLength), barLength));
                const bar = "▓".repeat(progress) + "░".repeat(barLength - progress);
                content = `**Level ${lvl}**\nXP: ${xp} / ${xpNeeded}\n[${bar}]`;
              }
              
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content })
              });
            } catch (error: any) {
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ content: `**Error:** ${error.message}` })
              });
            }
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (interaction.data.name === 'sheet') {
          ctx.waitUntil((async () => {
            try {
              const player: any = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(userId).first();
              let content = "You haven't created a character yet. Use `/begin` to start.";
              if (player && player.level > 0) {
                content = `**${player.name}**\n*${player.appearance}*\n\n**Level ${player.level}** | XP: ${player.xp}\n**Trait:** ${player.traits}\n**Background:** ${player.background}\n**Blood Type:** ${player.blood_type}\n\n**Stats:**\n${player.stats}`;
              }
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content })
              });
            } catch (error: any) {
               await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `**Error:** ${error.message}` })
              });
            }
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

        // Sire Selection
        if (cid === 'sire_nazuna' || cid === 'sire_wildcard') {
          ctx.waitUntil((async () => {
            let sireName = "Nazuna Nanakusa";
            let flavorText = "";

            if (cid === 'sire_wildcard') {
              const wildcards = ["Kiku Hoshimi", "Seri Kikyou", "Midori Kohakobe"];
              sireName = wildcards[Math.floor(Math.random() * wildcards.length)];
              flavorText = `A figure steps out of the shadows. You don't know them, but they seem to know you. "${sireName}," they say. "Remember it."`;
            } else {
              flavorText = `Nazuna smiles, her fangs catching the moonlight. "Alright. Let's see if you can handle the night."`;
            }

            await env.DB.prepare(`UPDATE players SET track = 'Vampire Offspring' WHERE id = ?`).bind(userId).run();
            await env.DB.prepare(`UPDATE players SET stats = stats || ' | Sire: ' || ? WHERE id = ?`).bind(sireName, userId).run();

            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: `🌙 **You are now an Offspring.**\n\nYour sire is **${sireName}**.\n\n${flavorText}`, components: [] })
            });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }

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
            const threadRes = await fetch(`https://discord.com/api/v10/channels/${interaction.channel_id}/threads`, {
              method: 'POST',
              headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: locName, type: 11, auto_archive_duration: 60 })
            });
            const threadData: any = await threadRes.json();
            const threadId = threadData.id;

            await env.DB.prepare(`INSERT INTO scenes (id, channel_id, location) VALUES (?, ?, ?)`).bind(threadId, interaction.channel_id, location).run();

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

            const buttons = [];
            if (location === 'rooftop') {
              buttons.push({ type: 2, style: 1, label: "Talk to Nazuna", custom_id: "talk_nazuna" });
              buttons.push({ type: 2, style: 3, label: "Search for Clues", custom_id: "search_clue" });
            }
            buttons.push({ type: 2, style: 4, label: "Leave", custom_id: "leave_scene" });

            await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
              method: 'POST',
              headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                content: `**${locName}**\n\n${desc}`,
                components: [{ type: 1, components: buttons }]
              })
            });

            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
              method: 'DELETE'
            });
          })());

          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (cid === 'search_clue') {
          const threadId = interaction.channel_id;
          
          ctx.waitUntil((async () => {
            const questId = "rooftop_mystery";
            const allClues = [
              "A torn receipt from a 24-hour konbini.",
              "A faint smell of iron near the ledge.",
              "Scuff marks near the roof door."
            ];

            let progress: any = await env.DB.prepare('SELECT * FROM quests_progress WHERE player_id = ? AND quest_id = ?').bind(userId, questId).first();
            
            let collectedClues = [];
            if (progress && progress.clues) {
              collectedClues = JSON.parse(progress.clues);
            }

            const availableClues = allClues.filter(c => !collectedClues.includes(c));

            if (availableClues.length === 0) {
              await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: "You search the area, but find nothing new. You've found all the clues here." })
              });
              return;
            }

            const newClue = availableClues[0];
            collectedClues.push(newClue);

            if (progress) {
              await env.DB.prepare('UPDATE quests_progress SET clues = ? WHERE player_id = ? AND quest_id = ?').bind(JSON.stringify(collectedClues), userId, questId).run();
            } else {
              await env.DB.prepare('INSERT INTO quests_progress (player_id, quest_id, clues) VALUES (?, ?, ?)').bind(userId, questId, JSON.stringify(collectedClues)).run();
            }

            // Grant 100 XP
            const player: any = await env.DB.prepare('SELECT level, xp, track FROM players WHERE id = ?').bind(userId).first();
            if (player) {
              const currentLvl = Number(player.level) || 1;
              const currentXp = Number(player.xp) || 0;
              const newXp = currentXp + 100;
              const xpNeeded = currentLvl * 100;
              
              if (newXp >= xpNeeded) {
                const remainingXp = newXp - xpNeeded;
                await env.DB.prepare(`UPDATE players SET level = level + 1, xp = ? WHERE id = ?`).bind(remainingXp, userId).run();
                await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: `✨ **Level Up!** You are now Level ${currentLvl + 1}.` })
                });
              } else {
                await env.DB.prepare(`UPDATE players SET xp = xp + 100 WHERE id = ?`).bind(userId).run();
              }
            }

            await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
              method: 'POST',
              headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                content: `🔍 **You found a clue!**\n> *${newClue}*\n\n*Check your clues with \`/notebook\`.* (100 XP)`
              })
            });
          })());

          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }

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

        if (interaction.data.custom_id === 'modal_nazuna') {
          const userMessage = interaction.data.components[0].components[0].value;
          const threadId = interaction.channel_id;
          
          ctx.waitUntil((async () => {
            try {
              const player: any = await env.DB.prepare('SELECT name, xp, level, track FROM players WHERE id = ?').bind(userId).first();
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
              
              if (!aiRes.ok) throw new Error(`Groq API Error: ${await aiRes.text()}`);
              const aiData: any = await aiRes.json();
              const reply = aiData.choices[0].message.content;

              const threadInfoRes = await fetch(`https://discord.com/api/v10/channels/${threadId}`, {
                headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}` }
              });
              const threadInfo: any = await threadInfoRes.json();
              const parentChannelId = threadInfo.parent_id;

              // --- REUSE WEBHOOK LOGIC ---
              let webhookId = "";
              let webhookToken = "";

              const existingHooksRes = await fetch(`https://discord.com/api/v10/channels/${parentChannelId}/webhooks`, {
                headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}` }
              });
              
              if (existingHooksRes.ok) {
                const existingHooks: any = await existingHooksRes.json();
                const nazunaHook = existingHooks.find((h: any) => h.name === "Nazuna");
                if (nazunaHook) {
                  webhookId = nazunaHook.id;
                  webhookToken = nazunaHook.token;
                }
              }

              if (!webhookId) {
                const webhookRes = await fetch(`https://discord.com/api/v10/channels/${parentChannelId}/webhooks`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: "Nazuna" })
                });
                if (!webhookRes.ok) throw new Error(`Webhook creation failed. Error: ${await webhookRes.text()}`);
                const webhookData: any = await webhookRes.json();
                webhookId = webhookData.id;
                webhookToken = webhookData.token;
              }
              
              // Execute webhook
              await fetch(`https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}?thread_id=${threadId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: reply, username: "Nazuna Nanakusa" })
              });

              if (player) {
                const currentLvl = Number(player.level) || 1;
                const currentXp = Number(player.xp) || 0;
                const newXp = currentXp + 50;
                const xpNeeded = currentLvl * 100;
                
                if (newXp >= xpNeeded) {
                  const remainingXp = newXp - xpNeeded;
                  await env.DB.prepare(`UPDATE players SET level = level + 1, xp = ? WHERE id = ?`).bind(remainingXp, userId).run();
                  await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: `✨ **Level Up!** ${playerName} is now Level ${currentLvl + 1}.` })
                  });

                  if (currentLvl + 1 === 5 && player.track !== 'Vampire Offspring') {
                    await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
                      method: 'POST',
                      headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        content: `🌙 **The night notices you.**\n\nYou have reached Level 5. It is time to choose your path. Will you become an Offspring?`,
                        components: [{ type: 1, components: [
                          { type: 2, style: 3, label: "Choose Nazuna as Sire", custom_id: "sire_nazuna" },
                          { type: 2, style: 3, label: "Choose a Wildcard Sire", custom_id: "sire_wildcard" }
                        ]}]
                      })
                    });
                  }

                } else {
                  await env.DB.prepare(`UPDATE players SET xp = xp + 50 WHERE id = ?`).bind(userId).run();
                }

                const bond = await env.DB.prepare('SELECT points FROM npc_bonds WHERE player_id = ? AND npc_id = ?').bind(userId, 'nazuna').first();
                if (bond) {
                  await env.DB.prepare('UPDATE npc_bonds SET points = points + 1 WHERE player_id = ? AND npc_id = ?').bind(userId, 'nazuna').run();
                } else {
                  await env.DB.prepare('INSERT INTO npc_bonds (player_id, npc_id, points) VALUES (?, ?, 1)').bind(userId, 'nazuna').run();
                }
              }

              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'DELETE'
              });

            } catch (error: any) {
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: `**Error:** ${error.message}` })
              });
            }
          })());

          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE }), { headers: { 'Content-Type': 'application/json' } });
        }
      }
    }
    return new Response('Not found', { status: 404 });
  },

  // --- CRON TRIGGERS (DAY/NIGHT CYCLE) ---
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const utcHour = new Date().getUTCHours();
    const tokyoHour = (utcHour + 9) % 24;
    
    let message = "";
    
    if (tokyoHour === 18) {
      message = "🌙 **The night begins.**\nThe city exhales. Somewhere, a door opens.";
    } else if (tokyoHour === 6) {
      message = "☀️ **The sun rises.**\nThe night lets go — for now.";
    }

    if (message) {
      await fetch(`https://discord.com/api/v10/channels/${env.GAME_CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
      });
    }
  }
};
