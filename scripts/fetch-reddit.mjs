import fs from "node:fs/promises";

const subreddits = ["MSI_Gaming", "buildapc", "asusrog", "pcmasterrace"];
const cutoff = Date.now() / 1000 - 48 * 60 * 60;
const userAgent = "github-pages-reddit-dashboard/1.0";

async function getToken() {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;

  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    throw new Error(`OAuth failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return payload.access_token;
}

async function redditJson(path, token) {
  const host = token ? "https://oauth.reddit.com" : "https://www.reddit.com";
  const response = await fetch(`${host}${path}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : undefined,
      "User-Agent": userAgent
    }
  });

  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function normalize(post) {
  return {
    id: post.id,
    title: post.title,
    score: post.score || 0,
    num_comments: post.num_comments || 0,
    created_utc: post.created_utc,
    permalink: post.permalink,
    author: post.author || "",
    subreddit: post.subreddit
  };
}

async function fetchSubreddit(subreddit, token) {
  const paths = [
    `/r/${subreddit}/top.json?t=week&limit=100&raw_json=1`,
    `/r/${subreddit}/hot.json?limit=100&raw_json=1`
  ];

  const posts = [];
  const seen = new Set();
  const errors = [];

  for (const path of paths) {
    try {
      const payload = await redditJson(path, token);
      for (const item of payload.data?.children || []) {
        const post = item.data;
        if (!post || post.stickied || post.created_utc < cutoff || seen.has(post.id)) continue;
        seen.add(post.id);
        posts.push(normalize(post));
      }
    } catch (error) {
      errors.push(error.message);
    }
  }

  posts.sort((a, b) => b.score - a.score);
  return {
    posts: posts.slice(0, 5),
    errors
  };
}

let token = null;
const setupErrors = [];
let previousData = null;

try {
  previousData = JSON.parse(await fs.readFile("data.json", "utf8"));
} catch {
  previousData = null;
}

try {
  token = await getToken();
} catch (error) {
  setupErrors.push(error.message);
}

const output = {
  updatedAt: new Date().toISOString(),
  windowHours: 48,
  source: token ? "reddit-oauth-api" : "reddit-public-json",
  setupErrors,
  subreddits: {}
};

for (const subreddit of subreddits) {
  output.subreddits[subreddit] = await fetchSubreddit(subreddit, token);
}

await fs.writeFile("data.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");

const total = Object.values(output.subreddits).reduce((sum, item) => sum + item.posts.length, 0);
if (total === 0) {
  const previousTotal = previousData?.subreddits
    ? Object.values(previousData.subreddits).reduce((sum, item) => sum + (item.posts?.length || 0), 0)
    : 0;

  if (previousTotal > 0) {
    previousData.updatedAt = output.updatedAt;
    previousData.source = `${previousData.source || "previous-data"}; refresh-failed`;
    previousData.setupErrors = [
      ...setupErrors,
      "No new Reddit posts were fetched. Existing data was preserved.",
      "Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET for reliable updates."
    ];
    await fs.writeFile("data.json", `${JSON.stringify(previousData, null, 2)}\n`, "utf8");
    console.log(`No new posts fetched. Preserved existing data.json with ${previousTotal} posts.`);
    process.exit(0);
  }

  output.setupErrors.push("No Reddit posts were fetched. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET for reliable updates.");
  await fs.writeFile("data.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log("No Reddit posts fetched. Wrote empty data.json without failing the workflow.");
  process.exit(0);
}

console.log(`Wrote data.json with ${total} posts.`);
