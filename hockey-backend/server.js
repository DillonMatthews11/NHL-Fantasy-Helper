const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();
const PORT = 3000;

app.use(cors({ origin: "http://localhost:5173" }));

app.get("/players", async (req, res) => {
  try {
    const season = req.query.season || 20232024;
    const gameType = 2; // Regular season

    // Fetch both data sources
    const [summaryRes, realtimeRes] = await Promise.all([
      axios.get(
        `https://api.nhle.com/stats/rest/en/skater/summary?limit=-1&cayenneExp=seasonId=${season}%20and%20gameTypeId=${gameType}`
      ),
      axios.get(
        `https://api.nhle.com/stats/rest/en/skater/realtime?limit=-1&cayenneExp=seasonId=${season}%20and%20gameTypeId=${gameType}`
      ),
    ]);

    // Map realtime stats by playerId
    const realtimeMap = Object.fromEntries(
      realtimeRes.data.data.map((p) => [p.playerId, p])
    );

    // Combine data sources
    const combined = summaryRes.data.data.map((p) => {
      const real = realtimeMap[p.playerId] || {};
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
      };
    });

    res.json({ total: combined.length, data: combined });
  } catch (err) {
    console.error("❌ Failed to fetch player data:", err.message);
    res.status(500).json({ error: "Failed to fetch player stats" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});