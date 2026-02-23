/**
 * Migration script to resolve Google News redirect URLs to actual article URLs
 * Run with: node src/scripts/resolveGoogleNewsUrls.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Article from '../models/Article.js';

dotenv.config();

/**
 * Decode Google News article URL
 * The URL contains a base64-encoded string with the actual article URL
 */
function decodeGoogleNewsUrl(googleUrl) {
  try {
    // Extract the encoded part from URL
    const match = googleUrl.match(/articles\/([^?]+)/);
    if (!match) return null;

    let encoded = match[1];

    // Fix base64 padding
    encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (encoded.length % 4) {
      encoded += '=';
    }

    // Decode base64
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');

    // Find URL in the decoded string (it's in a protobuf format)
    // URLs typically start with http:// or https://
    const urlMatch = decoded.match(/https?:\/\/[^\s\x00-\x1f]+/);
    if (urlMatch) {
      // Clean up the URL (remove any trailing garbage)
      let url = urlMatch[0];
      // Remove any non-URL characters at the end
      url = url.replace(/[\x00-\x1f]/g, '').split(/[\s"'>]/)[0];
      return url;
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function resolveUrl(googleUrl) {
  // First try to decode directly
  const decoded = decodeGoogleNewsUrl(googleUrl);
  if (decoded) {
    return decoded;
  }

  // Fallback: try following redirect with GET
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(googleUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    clearTimeout(timeout);

    if (response.url && !response.url.includes('news.google.com')) {
      return response.url;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected!\n');

  // Find articles with Google News URLs
  const articles = await Article.find({
    url: { $regex: /news\.google\.com\/rss\/articles/ }
  }).limit(100);

  console.log(`Found ${articles.length} articles with Google News URLs\n`);

  let resolved = 0;
  let failed = 0;

  for (const article of articles) {
    console.log(`Processing: ${article.title?.substring(0, 50)}...`);

    const newUrl = await resolveUrl(article.url);

    if (newUrl) {
      // Check if an article with this URL already exists
      const existing = await Article.findOne({ url: newUrl });

      if (existing && existing._id.toString() !== article._id.toString()) {
        // Delete the duplicate
        await Article.deleteOne({ _id: article._id });
        console.log(`  Deleted duplicate (original exists)`);
      } else {
        // Update the URL
        await Article.updateOne(
          { _id: article._id },
          { $set: { url: newUrl } }
        );
        console.log(`  Resolved to: ${newUrl.substring(0, 60)}...`);
      }
      resolved++;
    } else {
      failed++;
      console.log(`  Could not resolve`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nComplete! Resolved: ${resolved}, Failed: ${failed}`);

  await mongoose.disconnect();
}

main().catch(console.error);
