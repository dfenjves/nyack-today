/**
 * Get Discord server and channel information
 *
 * Run with: npx tsx scripts/get-discord-server-info.ts
 */

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { Client, GatewayIntentBits } from 'discord.js';

async function getServerInfo() {
  console.log('🔍 Fetching Discord server information...\n');

  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!botToken) {
    console.error('❌ DISCORD_BOT_TOKEN is not set in .env.local');
    process.exit(1);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.on('ready', () => {
    console.log(`✅ Bot connected as: ${client.user?.tag}\n`);
    console.log('📋 Servers the bot is in:\n');

    client.guilds.cache.forEach((guild) => {
      console.log(`Server: ${guild.name}`);
      console.log(`  Guild ID: ${guild.id}`);
      console.log(`  Members: ${guild.memberCount}`);
      console.log(`  Channels:`);

      // List text channels
      const textChannels = guild.channels.cache.filter(
        (channel) => channel.type === 0 // Text channels
      );

      textChannels.forEach((channel) => {
        console.log(`    - #${channel.name} (ID: ${channel.id})`);
      });

      console.log('');
    });

    console.log('\n📝 To update your .env.local:');
    console.log('1. Copy the Guild ID of your production server');
    console.log('2. Copy the Channel IDs you want to monitor');
    console.log('3. Update .env.local with:');
    console.log('   DISCORD_GUILD_ID="your_guild_id"');
    console.log('   DISCORD_MONITORED_CHANNELS=\'["channel_id_1", "channel_id_2"]\'');

    client.destroy();
    process.exit(0);
  });

  client.on('error', (error) => {
    console.error('❌ Discord error:', error.message);
    client.destroy();
    process.exit(1);
  });

  try {
    await client.login(botToken);
  } catch (error) {
    console.error('❌ Login failed:', error);
    process.exit(1);
  }

  // Timeout after 30 seconds
  setTimeout(() => {
    console.error('❌ Connection timeout');
    client.destroy();
    process.exit(1);
  }, 30000);
}

getServerInfo();
