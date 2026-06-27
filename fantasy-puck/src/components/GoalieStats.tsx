import React, { useEffect, useState, useMemo } from "react";

interface Goalie {
  playerId: number;
  skaterFullName: string;
  teamAbbrevs: string;
  positionCode: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  savePct: number;
  goalsAgainstAverage: number;
  shutouts: number;
  saves: number;
  shotsAgainst: number;
  // ESPN Fantasy Data
  espnADP?: number | null;
  espnPercentOwned?: number;
  espnPercentStarted?: number;
  espnTotalRanking?: number | null;
  espnPositionalRanking?: number | null;
  // Calculated fields
  fantasyPoints?: number;
  fantasyPointsPerGame?: number;
  customRank?: number; // Rank among goalies only
  overallCustomRank?: number; // Rank among ALL players (skaters + goalies)
  valueScore?: number;
}

interface Skater {
  playerId: number;
  skaterFullName: string;
  positionCode: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  plusMinus: number;
  hits: number;
  blockedShots: number;
  shots: number;
  ppPoints: number;
  espnADP?: number | null;
  fantasyPoints?: number;
}

interface Weights {
  wins: number;
  saves: number;
  shutouts: number;
  goalsAgainst: number;
}

interface SkaterWeights {
  goals: number;
  assists: number;
  plusMinus: number;
  hits: number;
  blockedShots: number;
  shots: number;
  ppPoints: number;
}

const GoalieStats: React.FC = () => {
  const [rawPlayers, setRawPlayers] = useState<any[]>([]); // All players (skaters + goalies)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Goalie; direction: "asc" | "desc" }>({
    key: "fantasyPoints",
    direction: "desc",
  });

  const [weights, setWeights] = useState<Weights>({
    wins: 5,
    saves: 0.6,
    shutouts: 5,
    goalsAgainst: -3,
  });

  const [skaterWeights] = useState<SkaterWeights>({
    goals: 6,
    assists: 4,
    plusMinus: 1,
    hits: 0.4,
    blockedShots: 1,
    shots: 0.9,
    ppPoints: 2,
  });

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [minGamesPlayed, setMinGamesPlayed] = useState<number>(10);

  // Fetch all player data (skaters + goalies) once on mount
  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const res = await fetch(`${apiUrl}/players`);

        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        if (!data.data || !Array.isArray(data.data)) {
          throw new Error("Invalid response format from server");
        }

        // Keep all players (both skaters and goalies) for overall ranking
        setRawPlayers(data.data);
      } catch (err) {
        console.error("Failed to fetch players:", err);
        setError(err instanceof Error ? err.message : "Failed to load player data");
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, []);

  // Helper function to sort data
  const sortData = (
    data: Goalie[],
    key: keyof Goalie,
    direction: "asc" | "desc"
  ) => {
    return [...data].sort((a, b) => {
      const aValue = a[key] ?? 0;
      const bValue = b[key] ?? 0;
      if (aValue < bValue) return direction === "asc" ? -1 : 1;
      if (aValue > bValue) return direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  // Calculate fantasy points for all players (goalies + skaters), then rank overall
  const allPlayersWithFantasy = useMemo(() => {
    // Calculate goalie fantasy points
    const goaliesWithFP = rawPlayers
      .filter((p: any) => p.positionCode === 'G')
      .map((g: any) => {
        const goalsAgainst = (g.goalsAgainstAverage || 0) * (g.gamesPlayed || 0);
        const fantasyPoints =
          (g.wins || 0) * weights.wins +
          (g.saves || 0) * weights.saves +
          (g.shutouts || 0) * weights.shutouts +
          goalsAgainst * weights.goalsAgainst;

        const fantasyPointsPerGame =
          g.gamesPlayed > 0 ? fantasyPoints / g.gamesPlayed : 0;

        return {
          ...g,
          fantasyPoints,
          fantasyPointsPerGame,
        };
      });

    // Calculate skater fantasy points
    const skatersWithFP = rawPlayers
      .filter((p: any) => p.positionCode !== 'G' && p.goals !== undefined)
      .map((p: any) => {
        const fantasyPoints =
          (p.goals || 0) * skaterWeights.goals +
          (p.assists || 0) * skaterWeights.assists +
          (p.plusMinus || 0) * skaterWeights.plusMinus +
          (p.hits || 0) * skaterWeights.hits +
          (p.blockedShots || 0) * skaterWeights.blockedShots +
          (p.shots || 0) * skaterWeights.shots +
          (p.ppPoints || 0) * skaterWeights.ppPoints;

        const fantasyPointsPerGame =
          p.gamesPlayed > 0 ? fantasyPoints / p.gamesPlayed : 0;

        return {
          ...p,
          fantasyPoints,
          fantasyPointsPerGame,
        };
      });

    // Combine all players
    const allPlayers = [...skatersWithFP, ...goaliesWithFP];

    // Calculate overall rank across ALL players
    const rankedOverall = [...allPlayers].sort((a, b) => {
      const aFP = a.fantasyPoints ?? 0;
      const bFP = b.fantasyPoints ?? 0;
      return bFP - aFP;
    });

    const overallRankMap = new Map();
    rankedOverall.forEach((player, idx) => {
      overallRankMap.set(player.playerId, idx + 1);
    });

    // Add overall rank to all players
    return allPlayers.map(player => ({
      ...player,
      overallCustomRank: overallRankMap.get(player.playerId),
    }));
  }, [rawPlayers, weights, skaterWeights]);

  // Filter to just goalies for this page
  const goaliesWithFantasy = useMemo(() => {
    return allPlayersWithFantasy.filter((p: any) => p.positionCode === 'G');
  }, [allPlayersWithFantasy]);

  // Sort goalies and calculate custom rank + value score
  const sortedGoalies = useMemo(() => {
    // First, filter by search term
    let filteredGoalies = goaliesWithFantasy;

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filteredGoalies = filteredGoalies.filter((g) =>
        g.skaterFullName.toLowerCase().includes(searchLower) ||
        g.teamAbbrevs.toLowerCase().includes(searchLower)
      );
    }

    // Filter by minimum games played
    filteredGoalies = filteredGoalies.filter((g) => g.gamesPlayed >= minGamesPlayed);

    // Create a position-specific ranking (among goalies only) for display
    const rankedByFantasy = [...filteredGoalies].sort((a, b) => {
      const aFP = a.fantasyPoints ?? 0;
      const bFP = b.fantasyPoints ?? 0;
      return bFP - aFP; // Descending order
    });

    // Assign position-specific custom ranks and calculate value scores using overall rank
    const goaliesWithRanks = rankedByFantasy.map((goalie, index) => {
      const customRank = index + 1; // Position-specific rank (among filtered goalies)
      const espnADP = goalie.espnADP;

      // Value Score: Use OVERALL custom rank (includes skaters) for accurate comparison to ADP
      const valueScore =
        espnADP && espnADP > 0 && goalie.overallCustomRank
          ? espnADP - goalie.overallCustomRank
          : undefined;

      return {
        ...goalie,
        customRank, // Display rank (goalies only)
        valueScore, // Calculated using overallCustomRank
      };
    });

    // Then apply the user's selected sort
    return sortData(goaliesWithRanks, sortConfig.key, sortConfig.direction);
  }, [goaliesWithFantasy, sortConfig, searchTerm, minGamesPlayed]);

  const handleWeightChange = (key: keyof Weights, value: number) => {
    setWeights({ ...weights, [key]: value });
  };

  const handleSort = (key: keyof Goalie) => {
    let direction: "asc" | "desc" = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>NHL Fantasy Goalie Rankings</h1>
        <div style={{ marginTop: "40px", fontSize: "18px", color: "#666" }}>
          <p>Loading goalie data...</p>
          <p style={{ fontSize: "14px", marginTop: "10px" }}>
            Fetching stats from NHL API
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>NHL Fantasy Goalie Rankings</h1>
        <div
          style={{
            marginTop: "40px",
            padding: "20px",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "8px",
            maxWidth: "600px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <h2 style={{ color: "#c00", marginBottom: "10px" }}>Error Loading Data</h2>
          <p style={{ color: "#666", marginBottom: "20px" }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const renderSortArrow = (key: keyof Goalie) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>NHL Fantasy Goalie Rankings</h1>

      {/* Fantasy Weight Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "8px",
          marginBottom: "20px",
          maxWidth: "700px",
        }}
      >
        {Object.entries(weights).map(([key, value]) => (
          <label key={key} style={{ display: "flex", flexDirection: "column" }}>
            {key === 'goalsAgainst' ? 'Goals Against' : key.charAt(0).toUpperCase() + key.slice(1)}
            <input
              type="number"
              step="0.1"
              value={value}
              onChange={(e) =>
                handleWeightChange(key as keyof Weights, parseFloat(e.target.value))
              }
              style={{ padding: "4px" }}
            />
          </label>
        ))}
      </div>

      {/* Search Box and Min Games Filter */}
      <div
        style={{
          marginBottom: "15px",
          maxWidth: "800px",
          display: "flex",
          gap: "10px",
        }}
      >
        <input
          type="text"
          placeholder="Search by goalie name or team..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            padding: "12px 16px",
            fontSize: "16px",
            border: "2px solid #ddd",
            borderRadius: "8px",
            boxSizing: "border-box",
            outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#007bff")}
          onBlur={(e) => (e.target.style.borderColor = "#ddd")}
        />
        <label style={{ display: "flex", flexDirection: "column", minWidth: "150px" }}>
          Min Games Played
          <input
            type="number"
            min="0"
            value={minGamesPlayed}
            onChange={(e) => setMinGamesPlayed(parseInt(e.target.value) || 0)}
            style={{
              padding: "12px 16px",
              fontSize: "16px",
              border: "2px solid #ddd",
              borderRadius: "8px",
            }}
          />
        </label>
      </div>

      <div style={{ marginBottom: "20px", fontSize: "13px", color: "#666" }}>
        Showing {sortedGoalies.length} goalie{sortedGoalies.length !== 1 ? "s" : ""}
      </div>

      {/* Goalie Table */}
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          textAlign: "left",
        }}
      >
        <thead>
          <tr>
            {[
              ["#", "playerId"],
              ["Goalie", "skaterFullName"],
              ["Team", "teamAbbrevs"],
              ["GP", "gamesPlayed"],
              ["Wins", "wins"],
              ["Saves", "saves"],
              ["SV%", "savePct"],
              ["GAA", "goalsAgainstAverage"],
              ["SO", "shutouts"],
              ["Fantasy Pts", "fantasyPoints"],
              ["FPPG", "fantasyPointsPerGame"],
              ["Goalie Rank", "customRank"],
              ["Overall Rank", "overallCustomRank"],
              ["ESPN ADP", "espnADP"],
              ["ESPN G Rank", "espnPositionalRanking"],
              ["ESPN Overall", "espnTotalRanking"],
              ["Value", "valueScore"],
            ].map(([label, key]) => {
              const isSorted = sortConfig.key === (key as keyof Goalie);
              return (
                <th
                  key={key}
                  onClick={() => handleSort(key as keyof Goalie)}
                  style={{
                    ...th,
                    backgroundColor: isSorted ? "#555" : undefined,
                    color: isSorted ? "#fff" : undefined,
                  }}
                >
                  {label} {renderSortArrow(key as keyof Goalie)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedGoalies.map((g, idx) => (
            <tr key={g.playerId}>
              <td style={td}>{idx + 1}</td>
              <td style={td}>{g.skaterFullName}</td>
              <td style={td}>{g.teamAbbrevs}</td>
              <td style={td}>{g.gamesPlayed}</td>
              <td style={td}>{g.wins}</td>
              <td style={td}>{g.saves}</td>
              <td style={td}>{g.savePct?.toFixed(3)}</td>
              <td style={td}>{g.goalsAgainstAverage?.toFixed(2)}</td>
              <td style={td}>{g.shutouts}</td>
              <td style={td}>{g.fantasyPoints?.toFixed(1)}</td>
              <td style={td}>{g.fantasyPointsPerGame?.toFixed(2)}</td>
              <td style={td}>{g.customRank || "-"}</td>
              <td style={td}>{g.overallCustomRank || "-"}</td>
              <td style={td}>{g.espnADP ? Math.round(g.espnADP) : "-"}</td>
              <td style={td}>{g.espnPositionalRanking || "-"}</td>
              <td style={td}>{g.espnTotalRanking || "-"}</td>
              <td
                style={{
                  ...td,
                  fontWeight: "bold",
                  color:
                    g.valueScore === null || g.valueScore === undefined
                      ? "#666"
                      : g.valueScore > 50
                      ? "#0a0"
                      : g.valueScore > 20
                      ? "#0c0"
                      : g.valueScore > 0
                      ? "#090"
                      : g.valueScore > -20
                      ? "#c60"
                      : "#c00",
                }}
              >
                {g.valueScore !== null && g.valueScore !== undefined
                  ? (g.valueScore > 0 ? "+" : "") + g.valueScore.toFixed(0)
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const th: React.CSSProperties = {
  borderBottom: "2px solid #ddd",
  padding: "8px",
  fontWeight: "bold",
  cursor: "pointer",
  userSelect: "none",
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #ddd",
  padding: "8px",
};

export default GoalieStats;
