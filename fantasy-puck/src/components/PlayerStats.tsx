import React, { useEffect, useState, useMemo } from "react";

interface Player {
  playerId: number;
  skaterFullName: string;
  teamAbbrevs: string;
  goals: number;
  assists: number;
  points: number;
  gamesPlayed: number;
  hits: number;
  blockedShots: number;
  giveaways: number;
  takeaways: number;
  plusMinus: number;
  shots: number;
  ppPoints: number;
  shPoints: number;
  fantasyPoints?: number;
  fantasyPointsPerGame?: number;
  // ESPN Fantasy Data
  espnADP?: number | null;
  espnPercentOwned?: number;
  espnPercentStarted?: number;
  espnTotalRanking?: number | null;
  espnPositionalRanking?: number | null;
  // Calculated fields
  customRank?: number;
  valueScore?: number;
}

interface Weights {
  goals: number;
  assists: number;
  plusMinus: number;
  hits: number;
  blockedShots: number;
  shots: number;
  ppPoints: number;
}

const PlayerStats: React.FC = () => {
  const [rawPlayers, setRawPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Player; direction: "asc" | "desc" }>({
    key: "fantasyPoints",
    direction: "desc",
  });

  const [weights, setWeights] = useState<Weights>({
    goals: 6,
    assists: 4,
    plusMinus: 1,
    hits: 0.4,
    blockedShots: 1,
    shots: 0.9,
    ppPoints: 2,
  });

  // Fetch player data only once on mount
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

        setRawPlayers(data.data);
      } catch (err) {
        console.error("Failed to fetch players:", err);
        setError(err instanceof Error ? err.message : "Failed to load player data");
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, []); // Only fetch once on mount

  // Helper function to sort data
  const sortData = (
    data: Player[],
    key: keyof Player,
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

  // Calculate fantasy points whenever weights or rawPlayers change (client-side only)
  const playersWithFantasy = useMemo(() => {
    return rawPlayers.map((p: Player) => {
      const fantasyPoints =
        p.goals * weights.goals +
        p.assists * weights.assists +
        p.plusMinus * weights.plusMinus +
        p.hits * weights.hits +
        p.blockedShots * weights.blockedShots +
        p.shots * weights.shots +
        p.ppPoints * weights.ppPoints;

      const fantasyPointsPerGame =
        p.gamesPlayed > 0 ? fantasyPoints / p.gamesPlayed : 0;

      return {
        ...p,
        fantasyPoints,
        fantasyPointsPerGame,
      };
    });
  }, [rawPlayers, weights]);

  // Sort players and calculate custom rank + value score
  const sortedPlayers = useMemo(() => {
    // First, create a ranking based on fantasy points (descending)
    const rankedByFantasy = [...playersWithFantasy].sort((a, b) => {
      const aFP = a.fantasyPoints ?? 0;
      const bFP = b.fantasyPoints ?? 0;
      return bFP - aFP; // Descending order
    });

    // Assign custom ranks and calculate value scores
    const playersWithRanks = rankedByFantasy.map((player, index) => {
      const customRank = index + 1;
      const espnADP = player.espnADP;

      // Value Score: positive = undervalued, negative = overvalued
      // If ESPN ADP is 100 and custom rank is 50, value is +50 (good pick!)
      const valueScore =
        espnADP && espnADP > 0 ? espnADP - customRank : null;

      return {
        ...player,
        customRank,
        valueScore,
      };
    });

    // Then apply the user's selected sort
    return sortData(playersWithRanks, sortConfig.key, sortConfig.direction);
  }, [playersWithFantasy, sortConfig]);

  const handleWeightChange = (key: keyof Weights, value: number) => {
    setWeights({ ...weights, [key]: value });
  };

  const handleSort = (key: keyof Player) => {
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
        <h1>NHL Fantasy Rankings</h1>
        <div style={{ marginTop: "40px", fontSize: "18px", color: "#666" }}>
          <p>Loading player data...</p>
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
        <h1>NHL Fantasy Rankings</h1>
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

  const renderSortArrow = (key: keyof Player) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>NHL Fantasy Rankings</h1>

      {/* Fantasy Weight Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "8px",
          marginBottom: "20px",
          maxWidth: "800px",
        }}
      >
        {Object.entries(weights).map(([key, value]) => (
          <label key={key} style={{ display: "flex", flexDirection: "column" }}>
            {key}
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

      {/* Player Table */}
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
            ["Player", "skaterFullName"],
            ["Team", "teamAbbrevs"],
            ["GP", "gamesPlayed"],
            ["G", "goals"],
            ["A", "assists"],
            ["+/-", "plusMinus"],
            ["Hits", "hits"],
            ["Blocks", "blockedShots"],
            ["Shots", "shots"],
            ["PP Pts", "ppPoints"],
            ["Fantasy Pts", "fantasyPoints"],
            ["FPPG", "fantasyPointsPerGame"],
            ["Custom Rank", "customRank"],
            ["ESPN ADP", "espnADP"],
            ["ESPN Rank", "espnTotalRanking"],
            ["Value", "valueScore"],
            ].map(([label, key]) => {
            const isSorted = sortConfig.key === (key as keyof Player);
            return (
                <th
                key={key}
                onClick={() => handleSort(key as keyof Player)}
                style={{
                    ...th,
                    backgroundColor: isSorted ? "#555" : undefined, // darken if sorted
                    color: isSorted ? "#fff" : undefined,           // white text for contrast
                }}
                >
                {label} {renderSortArrow(key as keyof Player)}
                </th>
            );
            })}
        </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((p, idx) => (
            <tr key={p.playerId}>
              <td style={td}>{idx + 1}</td>
              <td style={td}>{p.skaterFullName}</td>
              <td style={td}>{p.teamAbbrevs}</td>
              <td style={td}>{p.gamesPlayed}</td>
              <td style={td}>{p.goals}</td>
              <td style={td}>{p.assists}</td>
              <td style={td}>{p.plusMinus}</td>
              <td style={td}>{p.hits}</td>
              <td style={td}>{p.blockedShots}</td>
              <td style={td}>{p.shots}</td>
              <td style={td}>{p.ppPoints}</td>
              <td style={td}>{p.fantasyPoints?.toFixed(1)}</td>
              <td style={td}>{p.fantasyPointsPerGame?.toFixed(2)}</td>
              <td style={td}>{p.customRank || "-"}</td>
              <td style={td}>{p.espnADP ? Math.round(p.espnADP) : "-"}</td>
              <td style={td}>{p.espnTotalRanking || "-"}</td>
              <td
                style={{
                  ...td,
                  fontWeight: "bold",
                  color:
                    p.valueScore === null || p.valueScore === undefined
                      ? "#666"
                      : p.valueScore > 50
                      ? "#0a0" // Dark green for high value
                      : p.valueScore > 20
                      ? "#0c0" // Green for good value
                      : p.valueScore > 0
                      ? "#090" // Light green for slight value
                      : p.valueScore > -20
                      ? "#c60" // Orange for slight overvalue
                      : "#c00", // Red for overvalued
                }}
              >
                {p.valueScore !== null && p.valueScore !== undefined
                  ? (p.valueScore > 0 ? "+" : "") + p.valueScore.toFixed(0)
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

export default PlayerStats;