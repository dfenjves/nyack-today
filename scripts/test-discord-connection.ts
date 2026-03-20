/**
 * Test Discord bot connection
 *
 * Run with: npx tsx scripts/test-discord-connection.ts
 */

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { Client, GatewayIntentBits } from 'discord.js';

async function testConnection() {
  console.log('🔍 Testing Discord bot connection...\n');

  // Check environment variables
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const channels = process.env.DISCORD_MONITORED_CHANNELS;

  console.log('Environment variables:');
  console.log(`  DISCORD_BOT_TOKEN: ${botToken ? '✓ Set' : '✗ Missing'}`);
  console.log(`  DISCORD_GUILD_ID: ${guildId || '✗ Missing'}`);
  console.log(`  DISCORD_MONITORED_CHANNELS: ${channels || '✗ Missing'}`);
  console.log();

  if (!botToken) {
    console.error('❌ DISCORD_BOT_TOKEN is not set in .env.local');
    console.log('\nSteps to fix:');
    console.log('1. Go to https://discord.com/developers/applications');
    console.log('2. Select your application → Bot → Reset Token');
    console.log('3. Copy the token and add to .env.local:');
    console.log('   DISCORD_BOT_TOKEN=your_token_here');
    process.exit(1);
  }

  // Create client
  console.log('Creating Discord client...');
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Set up event listeners for debugging
  client.on('debug', (info) => {
    console.log(`[DEBUG] ${info}`);
  });

  client.on('error', (error) => {
    console.error('❌ Discord client error:', error.message);
  });

  client.on('ready', () => {
    console.log(`\n✅ Successfully connected!`);
    console.log(`   Bot user: ${client.user?.tag}`);
    console.log(`   Bot ID: ${client.user?.id}`);
    console.log(`   Guilds: ${client.guilds.cache.size}`);

    if (guildId) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        console.log(`   Target guild: ${guild.name}`);
        console.log(`   Channels in guild: ${guild.channels.cache.size}`);
      } else {
        console.warn(`   ⚠️  Bot is not in guild ${guildId}`);
        console.log('\nSteps to fix:');
        console.log('1. Go to https://discord.com/developers/applications');
        console.log('2. Select your application → OAuth2 → URL Generator');
        console.log('3. Select scopes: bot');
        console.log('4. Select permissions: Read Messages/View Channels, Read Message History');
        console.log('5. Use the generated URL to invite the bot to your server');
      }
    }

    client.destroy();
    process.exit(0);
  });

  // Attempt login
  console.log('Attempting to login...');

  try {
    await client.login(botToken);
  } catch (error) {
    console.error('\n❌ Login failed:', error);

    if (error instanceof Error) {
      if (error.message.includes('token')) {
        console.log('\n⚠️  Invalid token error. Possible causes:');
        console.log('1. Token is incorrect or expired');
        console.log('2. Token was regenerated in Discord Developer Portal');
        console.log('3. Application was deleted');
        console.log('\nGet a new token:');
        console.log('1. Go to https://discord.com/developers/applications');
        console.log('2. Select your application → Bot → Reset Token');
        console.log('3. Copy the new token to .env.local');
      } else if (error.message.includes('intents')) {
        console.log('\n⚠️  Missing privileged intents. Fix this:');
        console.log('1. Go to https://discord.com/developers/applications');
        console.log('2. Select your application → Bot');
        console.log('3. Enable "Message Content Intent" under Privileged Gateway Intents');
        console.log('4. Save changes');
      }
    }

    client.destroy();
    process.exit(1);
  }

  // Wait for ready event (with timeout)
  setTimeout(() => {
    console.error('\n❌ Connection timeout after 30 seconds');
    console.log('\nPossible causes:');
    console.log('1. Network connectivity issues');
    console.log('2. Discord API is down (check https://discordstatus.com)');
    console.log('3. Firewall blocking Discord gateway connections');
    client.destroy();
    process.exit(1);
  }, 30000);
}

testConnection();
