/**
 * Discord Client
 *
 * Handles Discord.js bot initialization, authentication, and message fetching
 */

import { Client, GatewayIntentBits, TextChannel, Collection, Message } from 'discord.js';
import { DiscordMessageData, DiscordConfig } from './types';

/**
 * Singleton Discord client instance
 */
let discordClient: Client | null = null;

/**
 * Gets Discord configuration from environment variables
 */
export function getDiscordConfig(): DiscordConfig {
  const botToken = process.env.DISCORD_BOT_TOKEN || '';
  const guildId = process.env.DISCORD_GUILD_ID || '';
  const monitoredChannels = JSON.parse(
    process.env.DISCORD_MONITORED_CHANNELS || '[]'
  ) as string[];
  const scraperEnabled = process.env.DISCORD_SCRAPER_ENABLED === 'true';
  const intervalHours = parseInt(
    process.env.DISCORD_SCRAPER_INTERVAL_HOURS || '6',
    10
  );
  const aiProvider = process.env.DISCORD_AI_PROVIDER;
  const aiModel = process.env.DISCORD_AI_MODEL;

  return {
    botToken,
    guildId,
    monitoredChannels,
    scraperEnabled,
    intervalHours,
    aiProvider,
    aiModel,
  };
}

/**
 * Initializes and returns the Discord client
 *
 * Creates a singleton client with necessary intents for reading messages
 */
export async function getDiscordClient(): Promise<Client> {
  // Return existing client if already ready
  if (discordClient && discordClient.isReady()) {
    console.log('Using existing Discord client connection');
    return discordClient;
  }

  // If client exists but not ready, destroy it and recreate
  if (discordClient && !discordClient.isReady()) {
    console.log('Cleaning up stale Discord client...');
    try {
      discordClient.destroy();
    } catch (error) {
      console.warn('Error destroying stale client:', error);
    }
    discordClient = null;
  }

  const config = getDiscordConfig();

  if (!config.botToken) {
    throw new Error('DISCORD_BOT_TOKEN not set in environment variables');
  }

  // Create client with required intents
  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent, // Required to read message text
    ],
  });

  // Wait for client to be ready
  const readyPromise = new Promise<void>((resolve, reject) => {
    if (!discordClient) {
      reject(new Error('Discord client not initialized'));
      return;
    }

    discordClient.once('ready', () => {
      console.log(`Discord bot logged in as: ${discordClient?.user?.tag}`);
      resolve();
    });

    discordClient.once('error', (error) => {
      console.error('Discord client error during login:', error);
      reject(error);
    });

    // Timeout after 30 seconds (increased from 10)
    setTimeout(() => {
      reject(new Error('Discord client login timeout (30s). Check bot token and network connectivity.'));
    }, 30000);
  });

  // Login to Discord
  try {
    console.log('Attempting to login to Discord...');
    await discordClient.login(config.botToken);
    await readyPromise;
    console.log('Discord client initialized and ready');
  } catch (error) {
    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('token')) {
        throw new Error('Invalid Discord bot token. Check DISCORD_BOT_TOKEN in .env.local');
      } else if (error.message.includes('timeout')) {
        throw new Error('Discord login timeout. Check network connectivity and bot token validity.');
      }
    }
    throw error;
  }

  return discordClient;
}

/**
 * Disconnects the Discord client
 */
export async function disconnectDiscordClient(): Promise<void> {
  if (discordClient) {
    discordClient.destroy();
    discordClient = null;
    console.log('Discord client disconnected');
  }
}

/**
 * Gets channel info by ID
 *
 * @param channelId - Discord channel ID
 * @returns Channel info or null if not found
 */
export async function getChannelInfo(
  channelId: string
): Promise<{ id: string; name: string } | null> {
  try {
    const client = await getDiscordClient();
    const channel = await client.channels.fetch(channelId);

    if (!channel || !(channel instanceof TextChannel)) {
      return null;
    }

    return {
      id: channel.id,
      name: channel.name,
    };
  } catch (error) {
    console.error(`Error fetching channel ${channelId}:`, error);
    return null;
  }
}

/**
 * Fetches messages from specified channels posted since a given date
 *
 * Handles pagination and rate limiting automatically
 *
 * @param channelIds - Array of Discord channel IDs to fetch from
 * @param since - Only fetch messages posted after this date
 * @returns Array of Discord messages
 */
export async function fetchMessagesSince(
  channelIds: string[],
  since: Date
): Promise<DiscordMessageData[]> {
  const client = await getDiscordClient();
  const messages: DiscordMessageData[] = [];

  for (const channelId of channelIds) {
    try {
      const channel = await client.channels.fetch(channelId);

      if (!channel || !(channel instanceof TextChannel)) {
        console.warn(`Channel ${channelId} not found or not a text channel`);
        continue;
      }

      console.log(`Fetching messages from #${channel.name}...`);

      // Fetch messages in batches (Discord API returns max 100 per request)
      let lastMessageId: string | undefined = undefined;
      let hasMore = true;
      let fetchedCount = 0;

      while (hasMore) {
        const options: { limit: number; before?: string } = { limit: 100 };
        if (lastMessageId) {
          options.before = lastMessageId;
        }

        const batch: Collection<string, Message> = await channel.messages.fetch(
          options
        );

        if (batch.size === 0) {
          hasMore = false;
          break;
        }

        // Process messages in this batch
        for (const [, message] of batch) {
          // Stop if we've reached messages older than 'since' date
          if (message.createdAt < since) {
            hasMore = false;
            break;
          }

          // Skip bot messages
          if (message.author.bot) {
            continue;
          }

          // Extract attachment URLs (images)
          const attachmentUrls = message.attachments
            .filter((att) => att.contentType?.startsWith('image/'))
            .map((att) => att.url);

          messages.push({
            messageId: message.id,
            channelId: channel.id,
            channelName: channel.name,
            authorId: message.author.id,
            authorName: message.author.username,
            content: message.content,
            attachmentUrls,
            postedAt: message.createdAt,
          });

          fetchedCount++;
        }

        // Set up for next batch
        lastMessageId = batch.last()?.id;

        // Safety limit: don't fetch more than 1000 messages per channel
        if (fetchedCount >= 1000) {
          console.warn(
            `Reached safety limit of 1000 messages for channel #${channel.name}`
          );
          hasMore = false;
        }
      }

      console.log(`  ✓ Fetched ${fetchedCount} messages from #${channel.name}`);
    } catch (error) {
      console.error(`Error fetching messages from channel ${channelId}:`, error);
      // Continue with other channels
    }
  }

  return messages;
}
