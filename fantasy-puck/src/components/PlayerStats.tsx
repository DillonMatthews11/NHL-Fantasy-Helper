import React, { useEffect, useState } from "react";

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
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch("http://localhost:3000/players");
        const data = await res.json();

        const withFantasy = data.data.map((p: Player) => {
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

        const sorted = sortData(withFantasy, sortConfig.key, sortConfig.direction);
        setPlayers(sorted);
      } catch (err) {
        console.error("Failed to fetch players:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [weights]);

  const handleWeightChange = (key: keyof Weights, value: number) => {
    setWeights({ ...weights, [key]: value });
  };

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

  const handleSort = (key: keyof Player) => {
    let direction: "asc" | "desc" = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
    setPlayers(sortData(players, key, direction));
  };

  if (loading) return <p>Loading players...</p>;

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
          {players.map((p, idx) => (
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