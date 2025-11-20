import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ---- Assumptions for projections ----
const ASSUMPTIONS = {
  ANNUAL_RETURN: 0.05, // 5% annual growth
  RETIREMENT_AGE: 65
};

// ---- Mock "database" ----
let contributionState = {
  userId: "mock-user-123",
  age: 30,
  salary: 120000,            // annual salary
  payPeriodsPerYear: 24,     // semi-monthly
  ytdContribution: 8500,     // mock YTD contributions
  contributionType: "percent", // "percent" | "dollar"
  contributionValue: 10,       // 10% by default
  currentBalance: 15000        // existing 401k balance
};

// ---- Routes ----

// Get current contribution settings and assumptions
app.get("/api/contribution", (req, res) => {
  const {
    userId,
    age,
    salary,
    payPeriodsPerYear,
    ytdContribution,
    contributionType,
    contributionValue,
    currentBalance
  } = contributionState;

  // Convert current selection to an equivalent % of salary
  let currentPercent = 0;
  if (contributionType === "percent") {
    currentPercent = contributionValue;
  } else if (salary > 0 && payPeriodsPerYear > 0) {
    const yearlyDollar = contributionValue * payPeriodsPerYear;
    currentPercent = (yearlyDollar / salary) * 100;
  }

  res.json({
    userId,
    age,
    salary,
    payPeriodsPerYear,
    ytdContribution,
    currentBalance,
    contributionType,
    contributionValue,
    currentPercent,
    assumptions: {
      retirementAge: ASSUMPTIONS.RETIREMENT_AGE,
      annualReturnPercent: ASSUMPTIONS.ANNUAL_RETURN * 100
    }
  });
});

// Save new contribution selection (and optional snapshot fields)
app.post("/api/contribution", (req, res) => {
  const {
    contributionType,
    contributionValue,
    age,
    salary,
    ytdContribution,
    currentBalance,
    payPeriodsPerYear
  } = req.body;

  // --- Required: contribution type & value ---
  if (!["percent", "dollar"].includes(contributionType)) {
    return res.status(400).json({ error: "Invalid contributionType" });
  }

  const valueNum = Number(contributionValue);
  if (!Number.isFinite(valueNum) || valueNum < 0) {
    return res.status(400).json({ error: "Invalid contributionValue" });
  }

  // Sanity limits to keep values realistic
  if (contributionType === "percent" && valueNum > 50) {
    return res.status(400).json({ error: "Percent too high" });
  }
  if (contributionType === "dollar" && valueNum > 5000) {
    return res.status(400).json({ error: "Dollar amount too high" });
  }

  // Start from previous state and update fields
  let nextState = {
    ...contributionState,
    contributionType,
    contributionValue: valueNum
  };

  // --- Optional: snapshot fields (only update if valid numbers were sent) ---
  if (age !== undefined) {
    const ageNum = Number(age);
    if (Number.isFinite(ageNum) && ageNum > 0 && ageNum < 100) {
      nextState.age = ageNum;
    }
  }

  if (salary !== undefined) {
    const salaryNum = Number(salary);
    if (Number.isFinite(salaryNum) && salaryNum >= 0) {
      nextState.salary = salaryNum;
    }
  }

  if (ytdContribution !== undefined) {
    const ytdNum = Number(ytdContribution);
    if (Number.isFinite(ytdNum) && ytdNum >= 0) {
      nextState.ytdContribution = ytdNum;
    }
  }

  if (currentBalance !== undefined) {
    const balNum = Number(currentBalance);
    if (Number.isFinite(balNum) && balNum >= 0) {
      nextState.currentBalance = balNum;
    }
  }

  if (payPeriodsPerYear !== undefined) {
    const ppNum = Number(payPeriodsPerYear);
    if (Number.isFinite(ppNum) && ppNum > 0 && ppNum <= 52) {
      nextState.payPeriodsPerYear = ppNum;
    }
  }

  contributionState = nextState;

  return res.json({ ok: true, contributionState });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
