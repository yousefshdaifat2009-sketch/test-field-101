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

// --- HARDCODED MINI-GAME DATA (Guarantees it never breaks) ---
const KARAOKE_SONGS = [
  { lyric: "The moon is high, the night is ____", correct: "young", wrong1: "cold", wrong2: "over" },
  { lyric: "I can't sleep, I'm falling for the ____", correct: "dark", wrong1: "sun", wrong2: "clock" },
  { lyric: "Your fangs are sharp, but your heart is ____", correct: "soft", wrong1: "stone", wrong2: "iron" },
  { lyric: "Walking alone under the neon ____", correct: "lights", wrong1: "stars", wrong2: "rain" },
  { lyric: "Don't look back, the shadow is ____", correct: "close", wrong1: "loud", wrong2: "bright" }
];

const RIDDLES = [
  { riddle: "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?", correct: "A map", wrong1: "A dream", wrong2: "A painting" },
  { riddle: "The more of me you take, the more you leave behind. What am I?", correct: "Footsteps", wrong1: "Memories", wrong2: "Breath" },
  { riddle: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", correct: "An echo", wrong1: "A ghost", wrong2: "A thought" },
  { riddle: "What has a neck but no head?", correct: "A bottle", wrong1: "A shirt", wrong2: "A guitar" },
  { riddle: "What gets wetter the more it dries?", correct: "A towel", wrong1: "A sponge", wrong2: "A shadow" }
];

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
          { name: 'bonds', description: 'View your relationships with NPCs', type: 1 },
          { name: 'play', description: 'Play peaceful mini-games with NPCs or players', type: 1 },
          { name: 'duel', description: 'Duel another player in PvP', type: 1, options: [{ name: 'user', description: 'The player to duel', type: 6, required: true }] },
          { 
            name: 'admin', description: 'Owner commands', type: 1,
            options: [
              { name: 'grantxp', description: 'Give XP to a player', type: 1, options: [{ name: 'user', description: 'The user', type: 6, required: true }, { name: 'amount', description: 'Amount of XP', type: 4, required: true }] },
              { name: 'reset', description: 'Reset a player', type: 1, options: [{ name: 'user', description: 'The user', type: 6, required: true }] },
              { name: 'stats', description: 'Check AI usage', type: 1 },
              { name: 'boss', description: 'Spawn a boss fight', type: 1, options: [{ name: 'user', description: 'The user to fight', type: 6, required: true }] }
            ]
          }
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
        
        if (interaction.data.name === 'play') {
          return new Response(JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              flags: InteractionResponseFlags.EPHEMERAL,
              content: "🎲 **Mini-Games**\nThe night is long. What do you want to do?",
              components: [
                { type: 1, components: [
                  { type: 2, style: 1, label: "Truth or Dare", custom_id: "game_td_start" },
                  { type: 2, style: 1, label: "Stargazing", custom_id: "game_stargaze_start" },
                  { type: 2, style: 1, label: "Karaoke", custom_id: "game_karaoke_start" },
                  { type: 2, style: 1, label: "Anko's Riddle", custom_id: "game_riddle_start" }
                ]}
              ]
            }
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (interaction.data.name === 'duel') {
          const targetId = interaction.data.options[0].value;
          if (targetId === userId) return new Response(JSON.stringify({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "You can't duel yourself.", flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
          
          ctx.waitUntil((async () => {
             const p1: any = await env.DB.prepare('SELECT name, level FROM players WHERE id = ?').bind(userId).first();
             const p2: any = await env.DB.prepare('SELECT name, level FROM players WHERE id = ?').bind(targetId).first();
             if (!p1 || !p2) {
               await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: "Both players must have a character created." }) });
               return;
             }
             await env.DB.prepare('UPDATE combat_sessions SET status = "finished" WHERE channel_id = ?').bind(interaction.channel_id).run();
             
             await fetch(`https://discord.com/api/v10/channels/${interaction.channel_id}/messages`, {
               method: 'POST', headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
               body: JSON.stringify({ 
                 content: `⚔️ **DUEL CHALLENGE** ⚔️\n<@${targetId}>, <@${userId}> has challenged you to a duel!\nDo you accept?`,
                 components: [{ type: 1, components: [
                   { type: 2, style: 3, label: "Accept", custom_id: `duel_accept_${userId}` },
                   { type: 2, style: 4, label: "Decline", custom_id: "duel_decline" }
                 ]}]
               })
             });
             await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'DELETE' });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (interaction.data.name === 'admin') {
          if (userId !== env.OWNER_DISCORD_ID) {
            return new Response(JSON.stringify({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "❌ You are not the owner.", flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
          }
          const subcommand = interaction.data.options[0].name;
          
          if (subcommand === 'stats') {
            ctx.waitUntil((async () => {
              const today = new Date().toISOString().split('T')[0];
              const usage: any = await env.DB.prepare('SELECT count FROM ai_usage WHERE date = ?').bind(today).first();
              const count = usage ? usage.count : 0;
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `**AI Usage Today:** ${count} / 900 calls.` }) });
            })());
            return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
          }

          if (subcommand === 'grantxp') {
            const targetUser = interaction.data.options[0].options[0].value;
            const amount = interaction.data.options[0].options[1].value;
            ctx.waitUntil((async () => {
              await env.DB.prepare('UPDATE players SET xp = xp + ? WHERE id = ?').bind(amount, targetUser).run();
              const levelResult = await processLevelUp(env, targetUser);
              let reply = `✅ Granted **${amount} XP** to <@${targetUser}>.`;
              if (levelResult) reply += `\n✨ **Level Up!** They are now Level ${levelResult.level}.`;
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: reply }) });
            })());
            return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
          }

          if (subcommand === 'reset') {
            const targetUser = interaction.data.options[0].options[0].value;
            ctx.waitUntil((async () => {
              await env.DB.prepare('DELETE FROM players WHERE id = ?').bind(targetUser).run();
              await env.DB.prepare('DELETE FROM quests_progress WHERE player_id = ?').bind(targetUser).run();
              await env.DB.prepare('DELETE FROM npc_bonds WHERE player_id = ?').bind(targetUser).run();
              await env.DB.prepare('DELETE FROM player_npcs_met WHERE player_id = ?').bind(targetUser).run();
              await env.DB.prepare('DELETE FROM infinite_quests WHERE player_id = ?').bind(targetUser).run();
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `✅ Reset all data for <@${targetUser}>.` }) });
            })());
            return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
          }

          if (subcommand === 'boss') {
            const targetUser = interaction.data.options[0].options[0].value;
            ctx.waitUntil((async () => {
               const playerData: any = await env.DB.prepare('SELECT level FROM players WHERE id = ?').bind(targetUser).first();
               const pLevel = playerData ? Number(playerData.level) : 1;
               const bossMaxHp = 50 + (pLevel * 10);
               
               let introDialogue = "A cold wind blows through the abandoned warehouse. The Rogue Vampire steps out of the shadows, its eyes glowing red.";
               let bossTaunt = "You've wandered too deep into the night, human.";
               try {
                 const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                   method: 'POST', headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                   body: JSON.stringify({ model: 'openai/gpt-oss-20b', messages: [{ role: 'system', content: 'You are a Rogue Vampire in Call of the Night. Write one intimidating, short sentence to a player who just confronted you.' }], max_tokens: 100 })
                 });
                 const aiData: any = await aiRes.json();
                 if (aiData.choices && aiData.choices[0].message.content) bossTaunt = aiData.choices[0].message.content;
               } catch(e) {}
               introDialogue += `\n> *"${bossTaunt}"*`;

               await env.DB.prepare('UPDATE combat_sessions SET status = "finished" WHERE channel_id = ?').bind(interaction.channel_id).run();
               await env.DB.prepare('INSERT INTO combat_sessions (channel_id, p1_id, p1_hp, p2_id, p2_hp, turn_id, p1_specials, p2_specials, round) VALUES (?, ?, 100, ?, ?, ?, 2, 2, 1)').bind(interaction.channel_id, targetUser, "rogue_vampire", bossMaxHp, targetUser).run();
               
               const embed = createCombatEmbed(targetUser, 100, 100, "Rogue Vampire", bossMaxHp, bossMaxHp, `${introDialogue}\n\n👉 **<@${targetUser}>, it is your turn!**`, 1, false);
               
               await fetch(`https://discord.com/api/v10/channels/${interaction.channel_id}/messages`, {
                 method: 'POST', headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
                 body: JSON.stringify({ 
                   embeds: [embed],
                   components: [{ type: 1, components: [
                     { type: 2, style: 1, label: "Attack", custom_id: "combat_attack" },
                     { type: 2, style: 2, label: "Defend", custom_id: "combat_defend" },
                     { type: 2, style: 3, label: "Special (2 Left)", custom_id: "combat_special" },
                     { type: 2, style: 4, label: "Flee", custom_id: "combat_flee" }
                   ]}]
                 })
               });
               await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: "Boss spawned." }) });
            })());
            return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
          }
        }

        if (interaction.data.name === 'bonds') {
          ctx.waitUntil((async () => {
            const bonds = await env.DB.prepare('SELECT * FROM npc_bonds WHERE player_id = ?').bind(userId).all();
            let content = "**Your Bonds**\n\n";
            if (bonds.results.length === 0) content += "You haven't bonded with anyone yet.";
            else {
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
            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (interaction.data.name === 'cases') {
          ctx.waitUntil((async () => {
            const quests = await env.DB.prepare('SELECT * FROM quests_progress WHERE player_id = ? AND status = "active"').bind(userId).all();
            const infQuests = await env.DB.prepare('SELECT * FROM infinite_quests WHERE player_id = ? AND status = "active"').bind(userId).all();
            let content = "**Your Active Cases**\n\n";
            if (quests.results.length === 0 && infQuests.results.length === 0) content += "You have no active cases. Explore the city to find clues.";
            else {
              quests.results.forEach((q: any) => { content += `**Main Story:** ${q.quest_id.replace(/_/g, ' ').toUpperCase()}\n`; });
              infQuests.results.forEach((q: any) => { content += `**Investigation:** Mystery at the ${q.location.toUpperCase()}\n`; });
            }
            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (interaction.data.name === 'notebook') {
          ctx.waitUntil((async () => {
            const quests = await env.DB.prepare('SELECT * FROM quests_progress WHERE player_id = ?').bind(userId).all();
            const infQuests = await env.DB.prepare('SELECT * FROM infinite_quests WHERE player_id = ?').bind(userId).all();
            let content = "**Your Notebook**\n\n";
            let hasClues = false;
            quests.results.forEach((q: any) => {
              if (q.clues) {
                hasClues = true;
                content += `**Main Story:** ${q.quest_id.replace(/_/g, ' ').toUpperCase()}\n`;
                JSON.parse(q.clues).forEach((c: string) => { content += `- ${c}\n`; });
                content += "\n";
              }
            });
            infQuests.results.forEach((q: any) => {
               hasClues = true;
               content += `**Mystery at the ${q.location.toUpperCase()}**\n`;
               if (q.clue_1) content += `- ${q.clue_1}\n`;
               if (q.clue_2) content += `- ${q.clue_2}\n`;
               if (q.clue_3) content += `- ${q.clue_3}\n`;
               content += "\n";
            });
            if (!hasClues) content += "Your notebook is empty.";
            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (interaction.data.name === 'progress') {
          ctx.waitUntil((async () => {
            try {
              const player: any = await env.DB.prepare('SELECT level, xp, hp FROM players WHERE id = ?').bind(userId).first();
              let content = "You haven't created a character yet. Use `/begin` to start.";
              if (player) {
                const lvl = Number(player.level) || 1;
                const xp = Math.max(0, Number(player.xp) || 0);
                const hp = Number(player.hp) || 100;
                const xpNeeded = lvl * 100; 
                const barLength = 10;
                const progress = Math.max(0, Math.min(Math.floor((xp / xpNeeded) * barLength), barLength));
                const bar = "▓".repeat(progress) + "░".repeat(barLength - progress);
                content = `**Level ${lvl}** | ❤️ HP: ${hp}/100\nXP: ${xp} / ${xpNeeded}\n[${bar}]`;
              }
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
            } catch (error: any) {
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `**Error:** ${error.message}` }) });
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
                content = `**${player.name}**\n*${player.appearance}*\n\n**Level ${player.level}** | XP: ${player.xp} | ❤️ HP: ${player.hp}/100\n**Trait:** ${player.traits}\n**Background:** ${player.background}\n**Blood Type:** ${player.blood_type}\n\n**Stats:**\n${player.stats}`;
              }
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
            } catch (error: any) {
               await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `**Error:** ${error.message}` }) });
            }
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: InteractionResponseFlags.EPHEMERAL } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (interaction.data.name === 'begin') {
          ctx.waitUntil((async () => {
            const player = await env.DB.prepare('SELECT level FROM players WHERE id = ?').bind(userId).first();
            if (player && player.level > 0) {
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: "You already have a character. Use `/sheet` to view it." }) });
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
          const locations = [];
          if (!isNight) {
            locations.push({ type: 2, style: 1, label: "School", custom_id: "go_school" });
            locations.push({ type: 2, style: 1, label: "Anko's Agency", custom_id: "go_agency" });
            locations.push({ type: 2, style: 1, label: "Park", custom_id: "go_park" });
          } else {
            locations.push({ type: 2, style: 1, label: "Rooftop", custom_id: "go_rooftop" });
            locations.push({ type: 2, style: 1, label: "Konbini", custom_id: "go_konbini" });
            locations.push({ type: 2, style: 1, label: "Park", custom_id: "go_park" });
          }
          locations.push({ type: 2, style: 1, label: "Your Apartment", custom_id: "go_apartment" });
          const components = [];
          for (let i = 0; i < locations.length; i += 5) {
            components.push({ type: 1, components: locations.slice(i, i + 5) });
          }
          return new Response(JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { flags: InteractionResponseFlags.EPHEMERAL, content: `**It is currently ${phaseText} in Tokyo.**\nWhere do you want to go?`, components: components }
          }), { headers: { 'Content-Type': 'application/json' } });
        }
      }

      // --- BUTTONS ---
      if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
        const cid = interaction.data.custom_id;

        // --- MINI-GAMES ---
        if (cid === 'game_td_start') {
          return new Response(JSON.stringify({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
              content: "🎲 **Truth or Dare**\nYou sit on the rooftop with Nazuna. She smirks at you.\n\n*'Truth or Dare?'*",
              components: [{ type: 1, components: [
                { type: 2, style: 1, label: "Truth", custom_id: "game_td_truth" },
                { type: 2, style: 3, label: "Dare", custom_id: "game_td_dare" },
                { type: 2, style: 4, label: "Quit", custom_id: "game_quit" }
              ]}]
            }
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid === 'game_td_truth' || cid === 'game_td_dare') {
          const isTruth = cid === 'game_td_truth';
          ctx.waitUntil((async () => {
            let prompt = isTruth ? "What is the biggest lie you've told to hide your nighttime activities?" : "Change your Discord nickname to 'Vampire Bait' for one hour.";
            try {
              const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST', headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  model: 'openai/gpt-oss-20b', 
                  messages: [{ role: 'system', content: isTruth ? 'You are Nazuna Nanakusa. Ask the player one deep, melancholic, or slightly embarrassing "Truth" question related to the night or their character.' : 'You are Nazuna Nanakusa. Give the player one playful, harmless "Dare" they have to do in the Discord server.' }], 
                  max_tokens: 100 
                })
              });
              const aiData: any = await aiRes.json();
              if (aiData.choices && aiData.choices[0].message.content) {
                const aiText = aiData.choices[0].message.content.trim().replace(/^"|"$/g, '');
                if (aiText.length > 5) { prompt = aiText; }
              }
            } catch (e) {}

            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                content: `🎲 **Truth or Dare**\nNazuna leans in close.\n\n> *"${prompt}"*`,
                components: [{ type: 1, components: [{ type: 2, style: 3, label: "I Accept", custom_id: "game_td_accept" }, { type: 2, style: 4, label: "Quit", custom_id: "game_quit" }]}] 
              })
            });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid === 'game_td_accept') {
          ctx.waitUntil((async () => {
            await env.DB.prepare(`UPDATE players SET xp = xp + 50 WHERE id = ?`).bind(userId).run();
            const levelResult = await processLevelUp(env, userId);
            let extraMsg = levelResult ? `\n✨ **Level Up!** You are now Level ${levelResult.level}.` : "";
            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: `Nazuna laughs. *"You actually did it. Brave."*\n\n**(+50 XP)**${extraMsg}`, components: [] })
            });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (cid === 'game_stargaze_start') {
          return new Response(JSON.stringify({ 
            type: InteractionResponseType.MODAL, 
            data: { 
              custom_id: 'game_stargaze_modal', 
              title: 'Stargazing', 
              components: [{ type: 1, components: [{ type: 4, custom_id: 'constellation', label: 'What do you see in the stars?', style: 2, min_length: 3, max_length: 100, required: true }] }] 
            } 
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (cid === 'game_karaoke_start') {
          const song = KARAOKE_SONGS[Math.floor(Math.random() * KARAOKE_SONGS.length)];
          const options = [
            { label: song.correct, id: "correct" },
            { label: song.wrong1, id: "wrong" },
            { label: song.wrong2, id: "wrong" }
          ].sort(() => Math.random() - 0.5);

          return new Response(JSON.stringify({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
              content: `🎤 **Karaoke Night**\nSeri hands you the mic. *"Don't leave me hanging!"*\n\n*"${song.lyric}"*`,
              components: [{ type: 1, components: options.map(o => ({ type: 2, style: 1, label: o.label, custom_id: `game_karaoke_ans_${o.id}` })) }]
            }
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (cid.startsWith('game_karaoke_ans_')) {
          const isCorrect = cid.endsWith('correct');
          ctx.waitUntil((async () => {
            let reaction = "";
            try {
              const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST', headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  model: 'openai/gpt-oss-20b', 
                  messages: [{ role: 'system', content: `You are Seri from Call of the Night. The player just ${isCorrect ? 'sang perfectly' : 'sang terribly'}. Write one short reaction sentence.` }], 
                  max_tokens: 50 
                })
              });
              const aiData: any = await aiRes.json();
              if (aiData.choices && aiData.choices[0].message.content) reaction = aiData.choices[0].message.content;
            } catch (e) {}
            if (!reaction) reaction = isCorrect ? "Seri cheers! \"Perfect pitch!\"" : "Seri winces. \"Oof. That was rough.\"";

            if (isCorrect) {
              await env.DB.prepare(`UPDATE players SET xp = xp + 100 WHERE id = ?`).bind(userId).run();
              const levelResult = await processLevelUp(env, userId);
              let extraMsg = levelResult ? `\n✨ **Level Up!** You are now Level ${levelResult.level}.` : "";
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: `🎤 **Karaoke Night**\n${reaction}\n\n**(+100 XP)**${extraMsg}`, components: [] })
              });
            } else {
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: `🎤 **Karaoke Night**\n${reaction}`, components: [] })
              });
            }
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (cid === 'game_riddle_start') {
          const riddle = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
          const options = [
            { label: riddle.correct, id: "correct" },
            { label: riddle.wrong1, id: "wrong" },
            { label: riddle.wrong2, id: "wrong" }
          ].sort(() => Math.random() - 0.5);

          return new Response(JSON.stringify({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
              content: `🕵️ **Anko's Riddle**\nAnko blows smoke in your face.\n\n*"${riddle.riddle}"*`,
              components: [{ type: 1, components: options.map(o => ({ type: 2, style: 1, label: o.label, custom_id: `game_riddle_ans_${o.id}` })) }]
            }
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (cid.startsWith('game_riddle_ans_')) {
          const isCorrect = cid.endsWith('correct');
          ctx.waitUntil((async () => {
            let reaction = "";
            try {
              const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST', headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  model: 'openai/gpt-oss-20b', 
                  messages: [{ role: 'system', content: `You are Anko Uguisu. The player just answered a riddle ${isCorrect ? 'correctly' : 'incorrectly'}. Write one short, cynical reaction sentence.` }], 
                  max_tokens: 50 
                })
              });
              const aiData: any = await aiRes.json();
              if (aiData.choices && aiData.choices[0].message.content) reaction = aiData.choices[0].message.content;
            } catch (e) {}
            if (!reaction) reaction = isCorrect ? "Anko raises an eyebrow. \"Not bad, kid.\"" : "Anko sighs. \"Pathetic.\"";

            if (isCorrect) {
              await env.DB.prepare(`UPDATE players SET xp = xp + 150 WHERE id = ?`).bind(userId).run();
              const levelResult = await processLevelUp(env, userId);
              let extraMsg = levelResult ? `\n✨ **Level Up!** You are now Level ${levelResult.level}.` : "";
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: `🕵️ **Anko's Riddle**\n${reaction}\n\n**(+150 XP)**${extraMsg}`, components: [] })
              });
            } else {
              await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: `🕵️ **Anko's Riddle**\n${reaction}`, components: [] })
              });
            }
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (cid === 'game_quit') {
          return new Response(JSON.stringify({ type: InteractionResponseType.UPDATE_MESSAGE, data: { content: "Game closed.", components: [] } }), { headers: { 'Content-Type': 'application/json' } });
        }

        // --- COMBAT ---
        if (cid.startsWith('duel_accept_')) {
          const p1Id = cid.replace('duel_accept_', '');
          const p2Id = userId;
          ctx.waitUntil((async () => {
             await env.DB.prepare('UPDATE combat_sessions SET status = "finished" WHERE channel_id = ?').bind(interaction.channel_id).run();
             await env.DB.prepare('INSERT INTO combat_sessions (channel_id, p1_id, p1_hp, p2_id, p2_hp, turn_id, p1_specials, p2_specials, round) VALUES (?, ?, 100, ?, 100, ?, 2, 2, 1)').bind(interaction.channel_id, p1Id, p2Id, p1Id).run();
             
             const embed = createCombatEmbed(p1Id, 100, 100, "Player 2", 100, 100, `⚔️ **PvP DUEL STARTED** ⚔️\n\n👉 **<@${p1Id}>, it is your turn!**`, 1, true);
             
             await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
               method: 'PATCH', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ 
                 embeds: [embed],
                 components: [{ type: 1, components: [
                   { type: 2, style: 1, label: "Strike", custom_id: "pvp_attack" },
                   { type: 2, style: 2, label: "Guard", custom_id: "pvp_defend" },
                   { type: 2, style: 3, label: "Taunt", custom_id: "pvp_taunt" },
                   { type: 2, style: 4, label: "Ability", custom_id: "pvp_special" }
                 ]}]
               })
             });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (cid === 'duel_decline') {
          return new Response(JSON.stringify({ type: InteractionResponseType.UPDATE_MESSAGE, data: { content: "Duel declined.", components: [] } }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (cid === 'pvp_attack' || cid === 'pvp_defend' || cid === 'pvp_taunt' || cid === 'pvp_special') {
          ctx.waitUntil((async () => {
             const session: any = await env.DB.prepare('SELECT * FROM combat_sessions WHERE channel_id = ? AND status = "active" ORDER BY id DESC LIMIT 1').bind(interaction.channel_id).first();
             if (!session) return;
             if (userId !== session.turn_id) {
               await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: "It is not your turn.", flags: InteractionResponseFlags.EPHEMERAL }) });
               return;
             }

             const isP1 = userId === session.p1_id;
             const opponentId = isP1 ? session.p2_id : session.p1_id;
             
             const pData: any = await env.DB.prepare('SELECT level, stats FROM players WHERE id = ?').bind(userId).first();
             const oppData: any = await env.DB.prepare('SELECT level, stats FROM players WHERE id = ?').bind(opponentId).first();
             
             const pLevel = pData ? Number(pData.level) : 1;
             const oppLevel = oppData ? Number(oppData.level) : 1;
             
             const pNerve = parseStat(pData?.stats, "Nerve");
             const pMystery = parseStat(pData?.stats, "Mystery");
             const pCharm = parseStat(pData?.stats, "Charm");
             const pEmpathy = parseStat(pData?.stats, "Empathy");

             let p1Hp = Number(session.p1_hp);
             let p2Hp = Number(session.p2_hp);
             let p1Specials = Number(session.p1_specials);
             let p2Specials = Number(session.p2_specials);
             let round = Number(session.round);

             let pDmg = 0;
             let actionMsg = "";
             let selfHeal = 0;

             if (cid === 'pvp_attack') {
               pDmg = Math.floor(Math.random() * 10) + 10 + (pNerve * 2);
               if (Math.random() < (0.1 + (pMystery * 0.05))) { pDmg *= 2; actionMsg = `⚔️ **CRITICAL STRIKE!** <@${userId}> hits for **${pDmg}** damage!`; }
               else actionMsg = `⚔️ <@${userId}> strikes for **${pDmg}** damage.`;
             } 
             else if (cid === 'pvp_defend') {
               selfHeal = 10 + (pEmpathy * 3);
               actionMsg = `🛡️ <@${userId}> guards, recovering **${selfHeal}** HP.`;
             }
             else if (cid === 'pvp_taunt') {
               if (p1Specials > 0) {
                 if (isP1) p1Specials--; else p2Specials--;
                 actionMsg = `🗣️ <@${userId}> taunts the enemy, lowering their next attack by **${20 + (pCharm * 5)}%**!`;
               } else {
                 actionMsg = `🗣️ <@${userId}> tries to taunt, but is out of breath.`;
               }
             }
             else if (cid === 'pvp_special') {
               if (isP1 ? p1Specials <= 0 : p2Specials <= 0) {
                 await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: "You are out of Special uses!", flags: InteractionResponseFlags.EPHEMERAL }) });
                 return;
               }
               if (isP1) p1Specials--; else p2Specials--;
               
               const trackData: any = await env.DB.prepare('SELECT track FROM players WHERE id = ?').bind(userId).first();
               if (trackData && trackData.track === 'Vampire Offspring') {
                 pDmg = 20 + pLevel;
                 selfHeal = 20 + pLevel;
                 actionMsg = `🩸 <@${userId}> uses **Blood Drain**! Deals **${pDmg}** damage and heals **${selfHeal}** HP!`;
               } else {
                 pDmg = 40 + (pNerve * 2);
                 actionMsg = `✨ <@${userId}> uses **Stake Throw**! Deals massive **${pDmg}** damage!`;
               }
             }

             if (isP1) {
               p2Hp -= pDmg;
               p1Hp = Math.min(100, p1Hp + selfHeal);
             } else {
               p1Hp -= pDmg;
               p2Hp = Math.min(100, p2Hp + selfHeal);
             }

             if (p1Hp <= 0 || p2Hp <= 0) {
               const winnerId = p1Hp > 0 ? session.p1_id : session.p2_id;
               const loserId = p1Hp <= 0 ? session.p1_id : session.p2_id;
               
               await env.DB.prepare('UPDATE combat_sessions SET status = "finished" WHERE id = ?').bind(session.id).run();
               
               const xpGain = oppLevel * 20;
               await env.DB.prepare('UPDATE players SET xp = xp + ? WHERE id = ?').bind(xpGain, winnerId).run();
               await processLevelUp(env, winnerId);

               const winMsg = `\n\n🏆 **<@${winnerId}> WINS THE DUEL!**\n*Rewards:* +${xpGain} XP`;
               const finalEmbed = createCombatEmbed(session.p1_id, Math.max(0, p1Hp), 100, `<@${session.p2_id}>`, Math.max(0, p2Hp), 100, `${actionMsg}${winMsg}`, round, true);
               
               await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                 method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ embeds: [finalEmbed], components: [] })
               });
               return;
             }

             const nextTurn = isP1 ? session.p2_id : session.p1_id;
             round++;
             await env.DB.prepare('UPDATE combat_sessions SET p1_hp = ?, p2_hp = ?, p1_specials = ?, p2_specials = ?, turn_id = ?, round = ? WHERE id = ?').bind(p1Hp, p2Hp, p1Specials, p2Specials, nextTurn, round, session.id).run();

             const nextEmbed = createCombatEmbed(session.p1_id, p1Hp, 100, `<@${session.p2_id}>`, p2Hp, 100, `${actionMsg}\n\n👉 **<@${nextTurn}>, it is your turn!**`, round, true);
             
             await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
               method: 'PATCH', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ 
                 embeds: [nextEmbed],
                 components: [{ type: 1, components: [
                   { type: 2, style: 1, label: "Strike", custom_id: "pvp_attack" },
                   { type: 2, style: 2, label: "Guard", custom_id: "pvp_defend" },
                   { type: 2, style: 3, label: "Taunt", custom_id: "pvp_taunt" },
                   { type: 2, style: 4, label: "Ability", custom_id: "pvp_special" }
                 ]}]
               })
             });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (cid === 'combat_flee') {
          ctx.waitUntil((async () => {
             const session: any = await env.DB.prepare('SELECT * FROM combat_sessions WHERE channel_id = ? AND status = "active" ORDER BY id DESC LIMIT 1').bind(interaction.channel_id).first();
             if (!session) return;
             if (userId !== session.turn_id) return;

             if (Math.random() < 0.5) {
               await env.DB.prepare('UPDATE combat_sessions SET status = "finished" WHERE id = ?').bind(session.id).run();
               await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                 method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ content: `🏃 **You successfully fled the battle!**\nYou escape into the night.`, embeds: [], components: [] })
               });
             } else {
               const p1Hp = Number(session.p1_hp) - 20;
               if (p1Hp <= 0) {
                  await env.DB.prepare('UPDATE combat_sessions SET status = "finished" WHERE id = ?').bind(session.id).run();
                  await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: `💀 **You failed to escape!**\nThe Vampire strikes you down from behind.`, embeds: [], components: [] })
                  });
               } else {
                  await env.DB.prepare('UPDATE combat_sessions SET p1_hp = ? WHERE id = ?').bind(p1Hp, session.id).run();
                  const embed = createCombatEmbed(userId, p1Hp, 100, "Rogue Vampire", session.p2_hp, session.p2_hp, `🏃 **Failed to flee!**\nThe Vampire blocks your path and strikes you for **20 damage**.\n\n👉 **<@${userId}>, it is your turn!**`, session.round, false);
                  await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ embeds: [embed], components: [{ type: 1, components: [
                      { type: 2, style: 1, label: "Attack", custom_id: "combat_attack" },
                      { type: 2, style: 2, label: "Defend", custom_id: "combat_defend" },
                      { type: 2, style: 3, label: `Special (${session.p1_specials} Left)`, custom_id: "combat_special" },
                      { type: 2, style: 4, label: "Flee", custom_id: "combat_flee" }
                    ]}] })
                  });
               }
             }
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (cid === 'combat_attack' || cid === 'combat_special' || cid === 'combat_defend') {
          ctx.waitUntil((async () => {
             const session: any = await env.DB.prepare('SELECT * FROM combat_sessions WHERE channel_id = ? AND status = "active" ORDER BY id DESC LIMIT 1').bind(interaction.channel_id).first();
             if (!session) return;
             if (userId !== session.turn_id) {
               await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: "It is not your turn.", flags: InteractionResponseFlags.EPHEMERAL }) });
               return;
             }

             const playerData: any = await env.DB.prepare('SELECT level FROM players WHERE id = ?').bind(userId).first();
             const pLevel = playerData ? Number(playerData.level) : 1;

             let p1Hp = Number(session.p1_hp);
             let p2Hp = Number(session.p2_hp);
             let p1Specials = Number(session.p1_specials);
             let p2Specials = Number(session.p2_specials);
             let round = Number(session.round) + 1;

             let pDmg = 0;
             let pActionMsg = "";
             let pDefending = false;
             let isCrit = false;

             let isDesperate = p1Hp < 25;

             if (cid === 'combat_attack') {
               pDmg = Math.floor(Math.random() * 10) + 15 + pLevel;
               if (Math.random() < 0.15) { pDmg *= 2; isCrit = true; }
               if (isDesperate) pDmg = Math.floor(pDmg * 1.5);
               pActionMsg = isCrit ? `⚔️ **CRITICAL HIT!** <@${userId}> strikes a vital point for **${pDmg}** damage!` : `⚔️ <@${userId}> attacks for **${pDmg}** damage.`;
               if (isDesperate && !isCrit) pActionMsg += ` *(Adrenaline Rush!)*`;
             } else if (cid === 'combat_defend') {
               pDefending = true;
               p1Hp = Math.min(100, p1Hp + 15);
               pActionMsg = `🛡️ <@${userId}> takes a defensive stance and recovers 15 HP.`;
             } else if (cid === 'combat_special') {
               if (p1Specials <= 0) {
                  await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: "You are out of Special uses!", flags: InteractionResponseFlags.EPHEMERAL }) });
                  return;
               }
               p1Specials--;
               pDmg = 40 + pLevel;
               if (isDesperate) pDmg = Math.floor(pDmg * 1.5);
               pActionMsg = `✨ <@${userId}> unleashes their Special Ability for massive **${pDmg}** damage!`;
             }

             p2Hp -= pDmg;

             const thinkingEmbed = createCombatEmbed(userId, p1Hp, 100, "Rogue Vampire", p2Hp, 150 + (pLevel * 10), `${pActionMsg}\n\n⏳ **The enemy is calculating its move...**`, round, false);
             await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
               method: 'PATCH', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ embeds: [thinkingEmbed], components: [] })
             });

             let bossMsg = "";
             let bossDmg = 0;
             if (p2Hp > 0 && session.p2_id === 'rogue_vampire') {
               await new Promise(r => setTimeout(r, 2500));

               const bossMove = Math.random();
               
               if (bossMove < 0.6) {
                 bossDmg = Math.floor(Math.random() * 5) + 8 + Math.floor(pLevel * 0.5);
                 bossMsg = `🩸 The Vampire lunges with unnatural speed, tearing into you for **${bossDmg}** damage!`;
               } else if (bossMove < 0.8) {
                 bossMsg = `🛡️ The Vampire dissolves into shadows, avoiding damage and recovering its strength.`;
                 p2Hp = Math.min(150 + (pLevel * 10), p2Hp + 15);
               } else {
                 if (p2Specials > 0) {
                   p2Specials--;
                   bossDmg = 15 + pLevel;
                   bossMsg = `🦇 The Vampire vanishes and reappears behind you, using **Shadow Strike** for **${bossDmg}** damage!`;
                 } else {
                   bossDmg = Math.floor(Math.random() * 5) + 8 + Math.floor(pLevel * 0.5);
                   bossMsg = `🩸 The Vampire strikes for **${bossDmg}** damage!`;
                 }
               }

               if (pDefending) {
                 bossDmg = Math.floor(bossDmg / 2);
                 bossMsg += "\n*(Your defense halved the damage!)*";
               }
               if (cid !== 'combat_defend') {
                 bossDmg = Math.floor(bossDmg * 1.5);
                 bossMsg += "\n*(You left yourself open!)*";
               }

               p1Hp -= bossDmg;

               if (Math.random() < 0.6) {
                 try {
                   const tauntRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                     method: 'POST', headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                     body: JSON.stringify({ model: 'openai/gpt-oss-20b', messages: [{ role: 'system', content: 'You are a Rogue Vampire who just hit a player. Write one short, mocking sentence to them.' }], max_tokens: 50 })
                   });
                   const tauntData: any = await tauntRes.json();
                   if (tauntData.choices && tauntData.choices[0].message.content) {
                     bossMsg += `\n> *"${tauntData.choices[0].message.content}"*`;
                   } else {
                     bossMsg += `\n> *"Is that all you have?"*`;
                   }
                 } catch(e) {
                   bossMsg += `\n> *"You bleed too easily."*`;
                 }
               }
             }

             if (p1Hp <= 0 || p2Hp <= 0) {
               let winMsg = p1Hp <= 0 ? `💀 **You have been defeated.**\nYou wake up in your apartment with a throbbing headache.` : `🏆 **VICTORY!**\nThe Rogue Vampire turns to ash. You survived the night.`;
               await env.DB.prepare('UPDATE combat_sessions SET status = "finished" WHERE id = ?').bind(session.id).run();
               
               if (p1Hp > 0) {
                 const xpGain = pLevel * 100;
                 const yenGain = pLevel * 50;
                 await env.DB.prepare('UPDATE players SET xp = xp + ? WHERE id = ?').bind(xpGain, userId).run();
                 await processLevelUp(env, userId);
                 winMsg += `\n\n**Loot:** +${xpGain} XP | +${yenGain} Yen`;
               }

               const finalEmbed = createCombatEmbed(userId, Math.max(0, p1Hp), 100, "Rogue Vampire", Math.max(0, p2Hp), 150 + (pLevel * 10), `${bossMsg}\n\n${winMsg}`, round, false);
               await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
                 method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ embeds: [finalEmbed], components: [] })
               });
               return;
             }

             await env.DB.prepare('UPDATE combat_sessions SET p1_hp = ?, p2_hp = ?, p1_specials = ?, p2_specials = ?, round = ? WHERE id = ?').bind(p1Hp, p2Hp, p1Specials, p2Specials, round, session.id).run();

             const nextEmbed = createCombatEmbed(userId, p1Hp, 100, "Rogue Vampire", p2Hp, 150 + (pLevel * 10), `${bossMsg}\n\n👉 **<@${userId}>, it is your turn!**`, round, false);
             
             await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, {
               method: 'PATCH', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ 
                 embeds: [nextEmbed],
                 components: [{ type: 1, components: [
                   { type: 2, style: 1, label: "Attack", custom_id: "combat_attack" },
                   { type: 2, style: 2, label: "Defend", custom_id: "combat_defend" },
                   { type: 2, style: 3, label: `Special (${p1Specials} Left)`, custom_id: "combat_special" },
                   { type: 2, style: 4, label: "Flee", custom_id: "combat_flee" }
                 ]}]
               })
             });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (cid === 'sire_nazuna' || cid === 'sire_wildcard') {
          ctx.waitUntil((async () => {
            let sireName = "Nazuna Nanakusa";
            let flavorText = "";
            if (cid === 'sire_wildcard') {
              const wildcards = ["Kiku Hoshimi", "Seri Kikyou", "Midori Kohakobe", "Kabura", "Hatsuka"];
              sireName = wildcards[Math.floor(Math.random() * wildcards.length)];
              flavorText = `A figure steps out of the shadows. You don't know them, but they seem to know you. "${sireName}," they say. "Remember it."`;
            } else {
              flavorText = `Nazuna smiles, her fangs catching the moonlight. "Alright. Let's see if you can handle the night."`;
            }
            await env.DB.prepare(`UPDATE players SET track = 'Vampire Offspring' WHERE id = ?`).bind(userId).run();
            await env.DB.prepare(`UPDATE players SET stats = stats || ' | Sire: ' || ? WHERE id = ?`).bind(sireName, userId).run();
            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `🌙 **You are now an Offspring.**\n\nYour sire is **${sireName}**.\n\n${flavorText}`, components: [] }) });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (cid === 'start_create') {
          return new Response(JSON.stringify({ type: InteractionResponseType.MODAL, data: { custom_id: 'modal_step1', title: 'Step 1: Who are you?', components: [{ type: 1, components: [{ type: 4, custom_id: 'name', label: 'Your Name', style: 1, min_length: 2, max_length: 32, required: true }] }, { type: 1, components: [{ type: 4, custom_id: 'appearance', label: 'Describe your appearance', style: 2, min_length: 5, max_length: 100, required: true }] }] } }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid.startsWith('trait_')) {
          const trait = cid.replace('trait_', '');
          ctx.waitUntil(env.DB.prepare(`UPDATE players SET traits = ? WHERE id = ?`).bind(trait, userId).run());
          return new Response(JSON.stringify({ type: InteractionResponseType.UPDATE_MESSAGE, data: { content: `You chose **${trait}**.\n\n**Step 3: What is your background?**`, components: [{ type: 1, components: [{ type: 2, style: 1, label: "Student", custom_id: "bg_student" }, { type: 2, style: 1, label: "Worker", custom_id: "bg_worker" }, { type: 2, style: 1, label: "Drifter", custom_id: "bg_drifter" }]}] } }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid.startsWith('bg_')) {
          const bg = cid.replace('bg_', '');
          ctx.waitUntil(env.DB.prepare(`UPDATE players SET background = ? WHERE id = ?`).bind(bg, userId).run());
          return new Response(JSON.stringify({ type: InteractionResponseType.UPDATE_MESSAGE, data: { content: `You chose **${bg}**.\n\n**Step 4: What is your blood type?**`, components: [{ type: 1, components: [{ type: 2, style: 1, label: "Type A", custom_id: "blood_A" }, { type: 2, style: 1, label: "Type B", custom_id: "blood_B" }, { type: 2, style: 1, label: "Type AB", custom_id: "blood_AB" }, { type: 2, style: 1, label: "Type O", custom_id: "blood_O" }]}] } }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid.startsWith('blood_')) {
          const blood = cid.replace('blood_', '');
          ctx.waitUntil(env.DB.prepare(`UPDATE players SET blood_type = ? WHERE id = ?`).bind(blood, userId).run());
          return new Response(JSON.stringify({ type: InteractionResponseType.UPDATE_MESSAGE, data: { content: `Blood Type **${blood}**.\n\n**Step 5: Choose your starting stat focus.**`, components: [{ type: 1, components: [{ type: 2, style: 1, label: "Balanced", custom_id: "stats_balanced" }, { type: 2, style: 1, label: "Charming", custom_id: "stats_charm" }, { type: 2, style: 1, label: "Mysterious", custom_id: "stats_mystery" }]}] } }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid.startsWith('stats_')) {
          const statType = cid.replace('stats_', '');
          let statsStr = statType === 'balanced' ? "Charm 3, Mystery 3, Nerve 3, Empathy 3, Night-sense 1" : statType === 'charm' ? "Charm 5, Mystery 2, Nerve 2, Empathy 3, Night-sense 1" : "Charm 1, Mystery 5, Nerve 3, Empathy 2, Night-sense 2";
          ctx.waitUntil(env.DB.prepare(`UPDATE players SET stats = ?, level = 1 WHERE id = ?`).bind(statsStr, userId).run());
          return new Response(JSON.stringify({ type: InteractionResponseType.UPDATE_MESSAGE, data: { content: `**Character Creation Complete!**\n\nUse \`/sheet\` to view your profile. The night awaits.`, components: [] } }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid.startsWith('go_')) {
          const location = cid.replace('go_', '');
          const locName = location.charAt(0).toUpperCase() + location.slice(1);
          ctx.waitUntil((async () => {
            const threadRes = await fetch(`https://discord.com/api/v10/channels/${interaction.channel_id}/threads`, { method: 'POST', headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: locName, type: 11, auto_archive_duration: 60 }) });
            const threadData: any = await threadRes.json();
            const threadId = threadData.id;
            await env.DB.prepare(`INSERT INTO scenes (id, channel_id, location) VALUES (?, ?, ?)`).bind(threadId, interaction.channel_id, location).run();
            const tokyoHour = (new Date().getUTCHours() + 9) % 24;
            const isNight = tokyoHour >= 18 || tokyoHour < 6;
            const timeStr = isNight ? "night" : "day";
            const today = new Date().toISOString().split('T')[0];
            const usage: any = await env.DB.prepare('SELECT count FROM ai_usage WHERE date = ?').bind(today).first();
            let desc = "";
            if (usage && usage.count >= 900) { desc = `**The night goes quiet.** (Daily AI limit reached. Come back tomorrow.)`; } 
            else {
              try {
                const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'openai/gpt-oss-20b', messages: [{ role: 'system', content: `You are a narrator for Call of the Night. Write a 2-sentence atmospheric description of a ${locName} at ${timeStr}. Be melancholic and brief.` }], max_tokens: 1000 }) });
                if (!aiRes.ok) throw new Error(`Groq API Error: ${await aiRes.text()}`);
                const aiData: any = await aiRes.json();
                desc = aiData.choices[0].message.content;
                if (!desc || desc.trim() === "") throw new Error(`Empty AI response.`);
                await env.DB.prepare(`INSERT INTO ai_usage (date, count) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET count = count + 1`).bind(today).run();
              } catch (error: any) { desc = `**Error generating scene:** ${error.message}`; }
            }
            const buttons = [];
            if (location === 'rooftop' && isNight) buttons.push({ type: 2, style: 1, label: "Talk", custom_id: "talk_menu" });
            if (location === 'school' && !isNight) buttons.push({ type: 2, style: 1, label: "Talk", custom_id: "talk_menu" });
            if (location === 'agency' && !isNight) buttons.push({ type: 2, style: 1, label: "Talk", custom_id: "talk_menu" });
            buttons.push({ type: 2, style: 3, label: "Investigate", custom_id: "investigate" });
            buttons.push({ type: 2, style: 4, label: "Leave", custom_id: "leave_scene" });
            await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, { method: 'POST', headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `**${locName}**\n\n${desc}`, components: [{ type: 1, components: buttons }] }) });
            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'DELETE' });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid === 'talk_menu') {
          const threadId = interaction.channel_id;
          ctx.waitUntil((async () => {
             const scene: any = await env.DB.prepare('SELECT location FROM scenes WHERE id = ?').bind(threadId).first();
             const location = scene ? scene.location : "unknown";
             const buttons = [];
             if (location === 'rooftop') { buttons.push({ type: 2, style: 1, label: "Nazuna", custom_id: "talk_nazuna" }); buttons.push({ type: 2, style: 1, label: "Kou", custom_id: "talk_kou" }); }
             else if (location === 'school') { buttons.push({ type: 2, style: 1, label: "Kou", custom_id: "talk_kou" }); buttons.push({ type: 2, style: 1, label: "Akira", custom_id: "talk_akira" }); }
             else if (location === 'agency') { buttons.push({ type: 2, style: 1, label: "Anko", custom_id: "talk_anko" }); }
             await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, { method: 'POST', headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: "Who do you want to speak to?", components: [{ type: 1, components: buttons }] }) });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid === 'talk_nazuna') return new Response(JSON.stringify({ type: InteractionResponseType.MODAL, data: { custom_id: 'modal_nazuna', title: 'Talk to Nazuna', components: [{ type: 1, components: [{ type: 4, custom_id: 'message', label: 'What do you say?', style: 2, min_length: 1, max_length: 500, required: true }] }] } }), { headers: { 'Content-Type': 'application/json' } });
        if (cid === 'talk_kou') return new Response(JSON.stringify({ type: InteractionResponseType.MODAL, data: { custom_id: 'modal_kou', title: 'Talk to Kou', components: [{ type: 1, components: [{ type: 4, custom_id: 'message', label: 'What do you say?', style: 2, min_length: 1, max_length: 500, required: true }] }] } }), { headers: { 'Content-Type': 'application/json' } });
        if (cid === 'talk_akira') return new Response(JSON.stringify({ type: InteractionResponseType.MODAL, data: { custom_id: 'modal_akira', title: 'Talk to Akira', components: [{ type: 1, components: [{ type: 4, custom_id: 'message', label: 'What do you say?', style: 2, min_length: 1, max_length: 500, required: true }] }] } }), { headers: { 'Content-Type': 'application/json' } });
        if (cid === 'talk_anko') return new Response(JSON.stringify({ type: InteractionResponseType.MODAL, data: { custom_id: 'modal_anko', title: 'Talk to Anko', components: [{ type: 1, components: [{ type: 4, custom_id: 'message', label: 'What do you say?', style: 2, min_length: 1, max_length: 500, required: true }] }] } }), { headers: { 'Content-Type': 'application/json' } });

        if (cid === 'investigate') {
          const threadId = interaction.channel_id;
          ctx.waitUntil((async () => {
            try {
              const scene: any = await env.DB.prepare('SELECT location FROM scenes WHERE id = ?').bind(threadId).first();
              const location = scene ? scene.location : "city";
              const lastInvestigation: any = await env.DB.prepare('SELECT created_at FROM infinite_quests WHERE player_id = ? AND location = ? ORDER BY created_at DESC LIMIT 1').bind(userId, location).first();
              if (lastInvestigation && lastInvestigation.created_at) {
                const dateStr = lastInvestigation.created_at.replace(' ', 'T') + 'Z';
                const lastTime = new Date(dateStr).getTime();
                const now = new Date().getTime();
                const hoursDiff = (now - lastTime) / (1000 * 60 * 60);
                if (hoursDiff < 4) {
                   await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, { method: 'POST', headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: "You have already searched this area recently. The night is quiet here for now. *(4-hour cooldown)*" }) });
                   return;
                }
              }
              const today = new Date().toISOString().split('T')[0];
              const usage: any = await env.DB.prepare('SELECT count FROM ai_usage WHERE date = ?').bind(today).first();
              if (usage && usage.count >= 900) { await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, { method: 'POST', headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: "The night goes quiet. (Daily AI limit reached)." }) }); return; }
              const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'openai/gpt-oss-20b', messages: [{ role: 'system', content: `You are a mystery engine for Call of the Night. Create 3 physical clues (objects, smells, sounds) found while investigating a ${location}. Output ONLY valid JSON like this: {"clue1": "...", "clue2": "...", "clue3": "..."}. Do not use markdown formatting.` }], max_tokens: 1000 }) });
              const aiData: any = await aiRes.json();
              let rawText = aiData.choices[0].message.content.trim();
              if (rawText.startsWith('\`\`\`json')) rawText = rawText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
              const clues = JSON.parse(rawText);
              await env.DB.prepare(`INSERT INTO infinite_quests (player_id, location, clue_1, clue_2, clue_3) VALUES (?, ?, ?, ?, ?)`).bind(userId, location, clues.clue1, clues.clue2, clues.clue3).run();
              await env.DB.prepare(`INSERT INTO ai_usage (date, count) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET count = count + 1`).bind(today).run();
              await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, { method: 'POST', headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `🔍 **You investigate the ${location}.**\n> - ${clues.clue1}\n> - ${clues.clue2}\n> - ${clues.clue3}\n\n*Check your clues with \`/notebook\`.* (100 XP)` }) });
              await env.DB.prepare(`UPDATE players SET xp = xp + 100 WHERE id = ?`).bind(userId).run();
              const levelResult = await processLevelUp(env, userId);
              if (levelResult) { await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, { method: 'POST', headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `✨ **Level Up!** You are now Level ${levelResult.level}.` }) }); }
            } catch (error: any) { await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, { method: 'POST', headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `**System Error during investigation:** ${error.message}` }) }); }
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (cid === 'leave_scene') {
          ctx.waitUntil((async () => {
             await fetch(`https://discord.com/api/v10/channels/${interaction.channel_id}`, { method: 'PATCH', headers: { 'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: true }) });
             await env.DB.prepare(`UPDATE scenes SET status = 'closed' WHERE id = ?`).bind(interaction.channel_id).run();
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "You leave the scene. The night moves on." } }), { headers: { 'Content-Type': 'application/json' } });
        }
      }

      // --- MODALS ---
      if (interaction.type === InteractionType.MODAL_SUBMIT) {
        if (interaction.data.custom_id === 'modal_step1') {
          const name = interaction.data.components[0].components[0].value;
          const appearance = interaction.data.components[1].components[0].value;
          ctx.waitUntil((async () => { await env.DB.prepare(`INSERT INTO players (id, name, appearance, level) VALUES (?, ?, ?, 0) ON CONFLICT(id) DO UPDATE SET name = ?, appearance = ?`).bind(userId, name, appearance, name, appearance).run(); })());
          return new Response(JSON.stringify({ type: InteractionResponseType.UPDATE_MESSAGE, data: { content: `Name: **${name}**\nAppearance: *${appearance}*\n\n**Step 2: What is your defining trait?**`, components: [{ type: 1, components: [{ type: 2, style: 1, label: "Insomnia", custom_id: "trait_Insomnia" }, { type: 2, style: 1, label: "Night Owl", custom_id: "trait_NightOwl" }, { type: 2, style: 1, label: "Mysterious", custom_id: "trait_Mysterious" }]}] } }), { headers: { 'Content-Type': 'application/json' } });
        }
               if (interaction.data.custom_id === 'game_stargaze_modal') {
          const constellationName = interaction.data.components[0].components[0].value;
          ctx.waitUntil((async () => {
            const fallbackLegends = [
              "It reminds you of a promise no one kept.",
              "A story lost to the neon lights below.",
              "A quiet place where the lonely gather.",
              "It looks like a map to somewhere you've never been."
            ];
            let legend = fallbackLegends[Math.floor(Math.random() * fallbackLegends.length)];
            
            try {
              const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST', headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  model: 'openai/gpt-oss-20b', 
                  messages: [{ role: 'system', content: `You are Nazuna. The player named a constellation "${constellationName}". Write a 2-sentence legend.` }], 
                  max_tokens: 150 
                })
              });
              const aiData: any = await aiRes.json();
              if (aiData.choices && aiData.choices[0].message.content) {
                 const aiText = aiData.choices[0].message.content.trim().replace(/^"|"$/g, '');
                 if (aiText.length > 5) { legend = aiText; }
              }
            } catch (e) {}
            
            await env.DB.prepare(`UPDATE players SET xp = xp + 50 WHERE id = ?`).bind(userId).run();
            const levelResult = await processLevelUp(env, userId);
            let extraMsg = levelResult ? `\n✨ **Level Up!** You are now Level ${levelResult.level}.` : "";
            
            await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { 
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ content: `✨ **Stargazing**\nYou point at the sky. *"That one is called ${constellationName}."*\n\n> ${legend}\n\n**(+50 XP)**${extraMsg}`, components: [] }) 
            });
          })());
          return new Response(JSON.stringify({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }), { headers: { 'Content-Type': 'application/json' } });
        }
        }
        const modalId = interaction.data.custom_id;
        if (['modal_nazuna', 'modal_kou', 'modal_akira', 'modal_anko'].includes(modalId)) {
          const userMessage = interaction.data.components[0].components[0].value;
          const threadId = interaction.channel_id;
          ctx.waitUntil((async () => {
            try {
              const today = new Date().toISOString().split('T')[0];
              const usage: any = await env.DB.prepare('SELECT count FROM ai_usage WHERE date = ?').bind(today).first();
              if (usage && usage.count >= 900) { await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${interaction.token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `**Error:** The city is quiet. (Daily AI limit reached).` }) }); return; }
              const player: any = await env.DB.prepare('SELECT name, xp, level, track FROM players WHERE id = ?').bind(userId).first();
              const playerName = player ? player.name : "a stranger";
              let npcName = ""; let prompt = ""; let npcId = ""; let avatarUrl = "https://i.imgur.com/your_nazuna_image.png";
              if (modalId === 'modal_nazuna') { npcId = "nazuna"; npcName = "Nazuna Nanakusa"; prompt = `You are Nazuna Nanakusa from Call of the Night. You are a vampire. You are teasing, slightly sarcastic, but caring. You are talking to ${playerName}. Never break character. Keep responses to 1-3 sentences.`; }
              else if (modalId === 'modal_kou') { npcId = "kou"; npcName = "Kou Yamori"; prompt = `You are Kou Yamori from Call of the Night. You are a human boy who can't sleep and wants to be a vampire. You are blunt, observant, and a bit awkward. You are talking to ${playerName}. Keep responses to 1
