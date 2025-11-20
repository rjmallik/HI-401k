import { useEffect, useState, useMemo } from "react";

const API_BASE = "http://localhost:4000";

function formatCurrency(n, { noCents = false } = {}) {
  if (n == null || Number.isNaN(n)) return "-";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: noCents ? 0 : 2
  });
}

function formatPercent(p, digits = 1) {
  if (p == null || Number.isNaN(p)) return "-";
  return `${p.toFixed(digits)}%`;
}

// Same projection math as backend assumptions
function computeProjection({
  age,
  retirementAge,
  annualReturn,
  currentBalance,
  salary,
  contributionPercent
}) {
  if (
    age == null ||
    retirementAge == null ||
    salary == null ||
    currentBalance == null
  ) {
    return null;
  }

  const years = retirementAge - age;
  const r = annualReturn;
  const yearlyContribution = salary * (contributionPercent / 100);

  if (years <= 0) {
    // already at or past retirement age
    return currentBalance + yearlyContribution;
  }

  const futureBalance = currentBalance * Math.pow(1 + r, years);
  const annuityFactor = r === 0 ? years : (Math.pow(1 + r, years) - 1) / r;
  const futureContributions = yearlyContribution * annuityFactor;

  return futureBalance + futureContributions;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [age, setAge] = useState(null);
  const [salary, setSalary] = useState(null);
  const [payPeriods, setPayPeriods] = useState(null);
  const [ytd, setYtd] = useState(null);
  const [currentBalance, setCurrentBalance] = useState(null);

  const [assumptions, setAssumptions] = useState(null);

  // Saved contribution (what's on server)
  const [savedType, setSavedType] = useState("percent");
  const [savedValue, setSavedValue] = useState(0);
  const [savedPercent, setSavedPercent] = useState(0);

  // Working UI state (what user is editing)
  const [contributionType, setContributionType] = useState("percent");
  const [contributionValue, setContributionValue] = useState(0);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/contribution`);
        if (!res.ok) {
          throw new Error("Failed to load contribution data.");
        }
        const data = await res.json();

        setAge(data.age);
        setSalary(data.salary);
        setPayPeriods(data.payPeriodsPerYear);
        setYtd(data.ytdContribution);
        setCurrentBalance(data.currentBalance);
        setAssumptions({
          retirementAge: data.assumptions?.retirementAge ?? 65,
          annualReturn: (data.assumptions?.annualReturnPercent ?? 5) / 100
        });

        setSavedType(data.contributionType);
        setSavedValue(data.contributionValue);
        setSavedPercent(data.currentPercent);

        setContributionType(data.contributionType);
        setContributionValue(data.contributionValue);
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to load contribution data.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Derived values from current UI state
  const isPercent = contributionType === "percent";
  const numericContribution = Number(contributionValue) || 0;

  const livePercent = useMemo(() => {
    if (isPercent) {
      return numericContribution;
    }
    if (!salary || !payPeriods) return 0;
    const yearlyDollar = numericContribution * payPeriods;
    return (yearlyDollar / salary) * 100;
  }, [isPercent, numericContribution, salary, payPeriods]);

  const perPaycheckDollar = useMemo(() => {
    if (!salary || !payPeriods) return 0;
    if (isPercent) {
      return (salary * (numericContribution / 100)) / payPeriods;
    }
    return numericContribution;
  }, [isPercent, numericContribution, salary, payPeriods]);

  const yearlyContribution = useMemo(() => {
    if (!payPeriods) return 0;
    return perPaycheckDollar * payPeriods;
  }, [perPaycheckDollar, payPeriods]);

  const { liveProjection, liveProjectionPlusOne, liveDelta } = useMemo(() => {
    if (!assumptions) {
      return { liveProjection: null, liveProjectionPlusOne: null, liveDelta: null };
    }
    const base = computeProjection({
      age,
      retirementAge: assumptions.retirementAge,
      annualReturn: assumptions.annualReturn,
      currentBalance,
      salary,
      contributionPercent: livePercent
    });
    const plusOne = computeProjection({
      age,
      retirementAge: assumptions.retirementAge,
      annualReturn: assumptions.annualReturn,
      currentBalance,
      salary,
      contributionPercent: livePercent + 1
    });
    return {
      liveProjection: base,
      liveProjectionPlusOne: plusOne,
      liveDelta: plusOne != null && base != null ? plusOne - base : null
    };
  }, [assumptions, age, currentBalance, salary, livePercent]);

  const hasChanges =
    contributionType !== savedType ||
    Number(numericContribution.toFixed(2)) !== Number(savedValue.toFixed(2));

  const showHighSavingsWarning = livePercent > 20;
  const showLowSavingsNote = livePercent > 0 && livePercent < 5;

  async function handleSave() {
    setError("");
    setSuccessMessage("");

    if (!hasChanges) {
      setSuccessMessage("No changes to save.");
      return;
    }

    setSaving(true);
    try {
        const res = await fetch(`${API_BASE}/api/contribution`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contributionType,
              contributionValue: numericContribution,
              age,
              salary,
              ytdContribution: ytd,
              currentBalance,
              payPeriodsPerYear: payPeriods
            })
          });          

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }

      // Re-fetch to sync saved state + percent from server
      const res2 = await fetch(`${API_BASE}/api/contribution`);
      if (!res2.ok) {
        throw new Error("Saved, but failed to refresh data.");
      }
      const refreshed = await res2.json();

      setSavedType(refreshed.contributionType);
      setSavedValue(refreshed.contributionValue);
      setSavedPercent(refreshed.currentPercent);

      setContributionType(refreshed.contributionType);
      setContributionValue(refreshed.contributionValue);

      setSuccessMessage("Your contribution rate has been saved.");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function handleResetRecommended() {
    setContributionType("percent");
    setContributionValue(10);
  }

  if (loading) {
    return <div className="app-container">Loading…</div>;
  }

  return (
    <div className="app-container">
      <h1>401(k) Contribution</h1>
      <div className="subtitle">
        Choose how much you’d like to contribute from each paycheck toward your retirement.
      </div>

      {/* Snapshot */}
      <div className="section">
        <div className="section-title">Your snapshot</div>
        <div className="section-caption">
          These numbers start as mock values to simulate a real account. You can
          adjust them to explore different scenarios.
        </div>
        <div className="stats-grid">
          {/* Age */}
          <div className="stat-card">
            <div className="stat-label">Age</div>
            <div className="stat-value">
              <input
                type="number"
                min="18"
                max="70"
                value={age ?? ""}
                onChange={(e) => setAge(Number(e.target.value) || 0)}
                className="stat-input"
              />
            </div>
          </div>

          {/* Salary */}
          <div className="stat-card">
            <div className="stat-label">Annual salary</div>
            <div className="stat-value">
              <div className="stat-input-prefix">$</div>
              <input
                type="number"
                min="0"
                step="1000"
                value={salary ?? ""}
                onChange={(e) => setSalary(Number(e.target.value) || 0)}
                className="stat-input stat-input-money"
              />
            </div>
          </div>

          {/* YTD contributions */}
          <div className="stat-card">
            <div className="stat-label">YTD contributions</div>
            <div className="stat-value">
              <div className="stat-input-prefix">$</div>
              <input
                type="number"
                min="0"
                step="500"
                value={ytd ?? ""}
                onChange={(e) => setYtd(Number(e.target.value) || 0)}
                className="stat-input stat-input-money"
              />
            </div>
          </div>

          {/* Current balance */}
          <div className="stat-card">
            <div className="stat-label">Current 401(k) balance</div>
            <div className="stat-value">
              <div className="stat-input-prefix">$</div>
              <input
                type="number"
                min="0"
                step="1000"
                value={currentBalance ?? ""}
                onChange={(e) => setCurrentBalance(Number(e.target.value) || 0)}
                className="stat-input stat-input-money"
              />
            </div>
          </div>
        </div>
      </div>


      {/* Contribution controls */}
      <div className="section">
        <div className="section-title">Contribution per paycheck</div>
        <div className="section-caption" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <span>You’re currently saving</span>

            <input
                type="number"
                min="0"
                max="50"
                step="0.1"
                value={savedPercent}
                onChange={(e) => setSavedPercent(Number(e.target.value) || 0)}
                style={{
                width: "60px",
                padding: "0.15rem 0.35rem",
                border: "1px solid #ccc",
                borderRadius: "6px",
                fontSize: "0.85rem",
                fontWeight: 500,
                textAlign: "center"
                }}
            />

        <span>% of your salary in your 401(k).</span>
        </div>


        <div className="toggle-group">
          <button
            type="button"
            className={`toggle-button ${isPercent ? "active" : ""}`}
            onClick={() => setContributionType("percent")}
          >
            Percentage of paycheck
          </button>
          <button
            type="button"
            className={`toggle-button ${!isPercent ? "active" : ""}`}
            onClick={() => setContributionType("dollar")}
          >
            Fixed dollar amount
          </button>
        </div>

        <div className="slider-row">
          {isPercent ? (
            <>
              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                value={contributionValue}
                onChange={(e) => setContributionValue(e.target.value)}
              />
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={contributionValue}
                onChange={(e) => setContributionValue(e.target.value)}
              />
              <span>%</span>
            </>
          ) : (
            <>
              <input
                type="range"
                min="0"
                max="5000"
                step="25"
                value={contributionValue}
                onChange={(e) => setContributionValue(e.target.value)}
              />
              <span>$</span>
              <input
                type="number"
                min="0"
                max="5000"
                step="25"
                value={contributionValue}
                onChange={(e) => setContributionValue(e.target.value)}
              />
            </>
          )}
        </div>

        <div className="helper-text">
          This selection is approximately{" "}
          <strong>
            {formatCurrency(Math.round(perPaycheckDollar), { noCents: true })}
          </strong>{" "}
          per paycheck, or{" "}
          <strong>
            {formatCurrency(Math.round(yearlyContribution), { noCents: true })}
          </strong>{" "}
          per year (
          <strong>{formatPercent(livePercent)}</strong> of your salary).
        </div>

        {showHighSavingsWarning && (
          <div className="warning-text">
            This is a relatively high savings rate. Make sure it fits your day-to-day budget.
          </div>
        )}
        {showLowSavingsNote && !showHighSavingsWarning && (
          <div className="warning-text">
            Even small increases can make a big difference over time. Try sliding up 1–2% to see the impact.
          </div>
        )}

        <div className="actions-row">
          <button
            type="button"
            className="button-secondary"
            onClick={handleResetRecommended}
          >
            Reset to 10% (recommended)
          </button>
          <button
            className="button-primary"
            disabled={saving || !hasChanges}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save contribution rate"}
          </button>
        </div>

        {successMessage && <div className="message success">{successMessage}</div>}
        {error && <div className="message error">{error}</div>}
      </div>

      {/* Impact visualization */}
      <div className="section">
        <div className="section-title">How this impacts your retirement</div>
        <div className="section-caption">
          Projections assume a constant salary,{" "}
          {formatPercent((assumptions?.annualReturn ?? 0.05) * 100, 2)} annual
          return, and contributions until age{" "}
          {assumptions?.retirementAge ?? 65}.
        </div>

        <div className="section-projection-layout">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Projected balance at retirement</div>
              <div className="stat-value">
                {liveProjection != null
                  ? formatCurrency(Math.round(liveProjection), { noCents: true })
                  : "-"}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                If you increased your contribution by +1%
              </div>
              <div className="stat-value">
                {liveProjectionPlusOne != null
                  ? formatCurrency(Math.round(liveProjectionPlusOne), {
                      noCents: true
                    })
                  : "-"}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Extra savings from +1%</div>
              <div className="stat-value">
                {liveDelta != null
                  ? formatCurrency(Math.round(liveDelta), { noCents: true })
                  : "-"}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Today vs new choice</div>
            <div className="stat-value" style={{ fontSize: "0.98rem" }}>
              You’re currently saving{" "}
              <strong>{formatPercent(savedPercent)}</strong> of your salary.
              <br />
              With this new selection, you’d save{" "}
              <strong>{formatPercent(livePercent)}</strong>.
            </div>
            <div className="helper-text" style={{ marginTop: "0.5rem" }}>
              Try dragging the slider slowly to see how small changes ripple out to
              retirement. The numbers update instantly as you adjust.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
