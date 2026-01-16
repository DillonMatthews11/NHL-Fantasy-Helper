require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();

// Environment variables with defaults
const PORT = process.env.PORT || 3000;
const NHL_API_BASE = process.env.NHL_API_BASE || "https://api.nhle.com";
const ESPN_API_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl";

// CORS configuration - supports multiple origins
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  })
);

// Helper function to fetch ESPN fantasy data
async function fetchESPNData() {
  try {
    const currentSeason = 2025;
    const url = `${ESPN_API_BASE}/seasons/${currentSeason}/segments/0/leaguedefaults/3?scoringPeriodId=0&view=kona_player_info`;

    console.log("🔍 Fetching ESPN data from:", url);

    // Use x-fantasy-filter header to request more players
    const filterHeader = {
      players: {
        limit: 1000,
        sortPercOwned: {
          sortPriority: 1,
          sortAsc: false
        }
      }
    };

    const response = await axios.get(url, {
      headers: {
        'x-fantasy-filter': JSON.stringify(filterHeader)
      }
    });

    if (!response.data || !response.data.players) {
      console.log("⚠️ ESPN response missing players data");
      return {};
    }

    console.log(`✅ ESPN API returned ${response.data.players.length} players`);

    // Create a map of player names to ESPN data
    const espnMap = {};

    if (response.data && response.data.players) {
      console.log(`✅ ESPN API returned ${response.data.players.length} players`);

      response.data.players.forEach((playerObj) => {
        const player = playerObj.player;
        if (player && player.fullName) {
          const name = player.fullName.toLowerCase().trim();

          espnMap[name] = {
            adp: player.ownership?.averageDraftPosition || null,
            percentOwned: player.ownership?.percentOwned || 0,
            percentStarted: player.ownership?.percentStarted || 0,
            totalRanking: playerObj.ratings?.[0]?.totalRanking || null,
            positionalRanking: playerObj.ratings?.[0]?.positionalRanking || null,
          };
        }
      });

      console.log(`✅ Created ESPN map with ${Object.keys(espnMap).length} entries`);

      // Log sample ESPN names to help debug matching
      const sampleNames = Object.keys(espnMap).slice(0, 5);
      console.log("📝 Sample ESPN names:", sampleNames);
    } else {
      console.log("⚠️ ESPN response missing players data");
    }

    return espnMap;
  } catch (err) {
    console.error("⚠️ Failed to fetch ESPN data:", err.message);
    console.error("Full error:", err);
    return {}; // Return empty map on error, don't fail the whole request
  }
}

app.get("/players", async (req, res) => {
  try {
    const season = req.query.season || 20232024;
    const gameType = 2; // Regular season

    // Fetch NHL stats and ESPN data in parallel
    const [summaryRes, realtimeRes, espnMap] = await Promise.all([
      axios.get(
        `${NHL_API_BASE}/stats/rest/en/skater/summary?limit=-1&cayenneExp=seasonId=${season}%20and%20gameTypeId=${gameType}`
      ),
      axios.get(
        `${NHL_API_BASE}/stats/rest/en/skater/realtime?limit=-1&cayenneExp=seasonId=${season}%20and%20gameTypeId=${gameType}`
      ),
      fetchESPNData(),
    ]);

    // Map realtime stats by playerId
    const realtimeMap = Object.fromEntries(
      realtimeRes.data.data.map((p) => [p.playerId, p])
    );

    // Log sample NHL names to compare with ESPN
    const sampleNHLNames = summaryRes.data.data.slice(0, 5).map(p => p.skaterFullName.toLowerCase().trim());
    console.log("📝 Sample NHL names:", sampleNHLNames);

    // Combine data sources (NHL + ESPN)
    let matchedCount = 0;
    const combined = summaryRes.data.data.map((p) => {
      const real = realtimeMap[p.playerId] || {};
      const playerName = p.skaterFullName.toLowerCase().trim();
      const espn = espnMap[playerName] || {};

      if (espn.adp) matchedCount++;

      return {
        playerId: p.playerId,
        skaterFullName: p.skaterFullName,
        teamAbbrevs: p.teamAbbrevs,
        positionCode: p.positionCode,
        gamesPlayed: p.gamesPlayed,
        goals: p.goals,
        assists: p.assists,
        points: p.points,
        plusMinus: p.plusMinus,
        shots: p.shots,
        shootingPct: p.shootingPct,
        pointsPerGame: p.pointsPerGame,
        ppGoals: p.ppGoals,
        ppPoints: p.ppPoints,
        shGoals: p.shGoals,
        shPoints: p.shPoints,
        gameWinningGoals: p.gameWinningGoals,
        hits: real.hits || 0,
        blockedShots: real.blockedShots || 0,
        giveaways: real.giveaways || 0,
        takeaways: real.takeaways || 0,
        // ESPN Fantasy Data
        espnADP: espn.adp,
        espnPercentOwned: espn.percentOwned,
        espnPercentStarted: espn.percentStarted,
        espnTotalRanking: espn.totalRanking,
        espnPositionalRanking: espn.positionalRanking,
      };
    });

    // Log matching stats
    console.log(`🔗 Matched ${matchedCount} out of ${combined.length} NHL players with ESPN data`);

    // Log a sample player to verify ESPN data is included
    if (combined.length > 0) {
      const sample = combined.find(p => p.espnADP) || combined[0];
      console.log("📊 Sample player with ESPN data:", {
        name: sample.skaterFullName,
        espnADP: sample.espnADP,
        espnRanking: sample.espnTotalRanking
      });
    }

    res.json({ total: combined.length, data: combined });
  } catch (err) {
    console.error("❌ Failed to fetch player data:", err.message);
    res.status(500).json({ error: "Failed to fetch player stats" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});