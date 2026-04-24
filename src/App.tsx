import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  Cell,
} from "recharts";
import {
  Users,
  UserPlus,
  Droplets,
  User,
  CalendarDays,
  Building2,
  AlertCircle,
} from "lucide-react";

const CONFIG = {
  spreadsheetId: "1RjyW06vy1DoIQ9bvHbhhlltHTo6S03iNh71et4QB4hQ",
  mainSheetName: "stat2026",
  newBelieverSheetName: "ผู้เชื่อใหม่ 2026",
};
const KPI_COLORS = {
  hall: "#69B7FF",
  outside: "#F4D35E",
  ctVisitor: "#FF8A3D",
  visitor: "#BFE7EF",
  newBeliever: "#A44CC5",
  baptism: "#63C7D9",
};

const GROUP_BAR_COLORS = [
  "#F6E58D",
  "#F8E08C",
  "#F7DC7B",
  "#F4D56B",
  "#EFD05F",
  "#EDD77A",
  "#ECCC5A",
  "#E8D46D",
  "#E6CF61",
  "#E3C854",
];

const MONTHS_TH = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[._]/g, "")
    .replace(/beliver/g, "believer");
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(date) {
  if (!date) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

function parseThaiDate(value, fallbackYear = 2026) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "string") {
    const text = value.trim();

    const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, dd, mm, yyyy] = slashMatch;
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    }

    const shortMatch = text.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (shortMatch) {
      const [, dd, mm] = shortMatch;
      return new Date(fallbackYear, Number(mm) - 1, Number(dd));
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function formatDate(date) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatShortDate(date) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(date);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function findColumnIndex(headers, candidates) {
  const normalized = headers.map(normalizeKey);

  for (const candidate of candidates) {
    const target = normalizeKey(candidate);
    const exact = normalized.findIndex((h) => h === target);
    if (exact >= 0) return exact;
  }

  for (const candidate of candidates) {
    const target = normalizeKey(candidate);
    const partial = normalized.findIndex(
      (h) => h.includes(target) || target.includes(h)
    );
    if (partial >= 0) return partial;
  }

  return -1;
}

async function fetchGoogleSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${
    CONFIG.spreadsheetId
  }/gviz/tq?sheet=${encodeURIComponent(sheetName)}&tqx=out:json`;
  const res = await fetch(url);
  const text = await res.text();
  const json = JSON.parse(text.substring(47, text.length - 2));

  const cols = json.table.cols.map((c) => c.label || c.id || "");
  const rows = json.table.rows.map((row) =>
    row.c.map((cell) => {
      if (!cell) return "";
      if (cell.f !== undefined && cell.f !== null) return cell.f;
      if (cell.v !== undefined && cell.v !== null) return cell.v;
      return "";
    })
  );

  return { cols, rows };
}

function parseMainStats(table) {
  const headers = table.cols;
  const dateIdx = findColumnIndex(headers, ["วันที่", "date"]);
  const monthIdx = findColumnIndex(headers, ["เดือน", "month"]);
  const hallIdx = findColumnIndex(headers, ["hall"]);
  const outsideIdx = findColumnIndex(headers, ["outside"]);
  const ctVisitorIdx = findColumnIndex(headers, [
    "ct-visitor",
    "ct visitor",
    "ctvisitor",
  ]);
  const visitorIdx = findColumnIndex(headers, ["visitor"]);
  const newBelieverIdx = findColumnIndex(headers, [
    "new believer",
    "new beliver",
    "new b",
  ]);
  const baptismIdx = findColumnIndex(headers, ["baptism"]);
  const totalHallIdx = findColumnIndex(headers, ["รวม hall"]);
  const toddlerIdx = findColumnIndex(headers, ["toddler"]);
  const kindergartenIdx = findColumnIndex(headers, ["อนุบาล"]);
  const primaryIdx = findColumnIndex(headers, ["ป.ต้น"]);
  const juniorIdx = findColumnIndex(headers, ["ป.ปลาย"]);
  const nonSpecificIdx = findColumnIndex(headers, [
    "non specific",
    "nonspecific",
    "non speaker",
  ]);
  const teacherIdx = findColumnIndex(headers, ["teacher"]);
  const kidsTotalIdx = findColumnIndex(headers, ["รวม คจ.เด็ก"]);
  const hallPlusKidsIdx = findColumnIndex(headers, [
    "รวม hall + คจ.เด็ก",
    "รวม hall + คจเด็ก",
    "hall + คจ.เด็ก",
  ]);

  let currentMonth = "";
  const data = [];

  table.rows.forEach((row) => {
    const rawDate = row[dateIdx];
    const rawMonth = monthIdx >= 0 ? String(row[monthIdx] || "").trim() : "";

    if (rawMonth) currentMonth = rawMonth;
    const date = parseThaiDate(rawDate);

    const hasMeaningfulData = [
      hallIdx,
      ctVisitorIdx,
      visitorIdx,
      newBelieverIdx,
      baptismIdx,
      hallPlusKidsIdx,
    ]
      .filter((idx) => idx >= 0)
      .some((idx) => toNumber(row[idx]) > 0);

    if (!date || !hasMeaningfulData) return;

    const hall = toNumber(row[hallIdx]);
    const outside = toNumber(row[outsideIdx]);
    const totalHall =
      totalHallIdx >= 0 ? toNumber(row[totalHallIdx]) : hall + outside;
    const kidsTotal = kidsTotalIdx >= 0 ? toNumber(row[kidsTotalIdx]) : 0;

    data.push({
      month: currentMonth || MONTHS_TH[date.getMonth()],
      date,
      dateKey: toDateKey(date),
      hall,
      outside,
      ctVisitor: toNumber(row[ctVisitorIdx]),
      visitor: toNumber(row[visitorIdx]),
      newBeliever: toNumber(row[newBelieverIdx]),
      baptism: toNumber(row[baptismIdx]),
      totalHall,
      toddler: toNumber(row[toddlerIdx]),
      kindergarten: toNumber(row[kindergartenIdx]),
      primary: toNumber(row[primaryIdx]),
      junior: toNumber(row[juniorIdx]),
      nonSpecific: toNumber(row[nonSpecificIdx]),
      teacher: toNumber(row[teacherIdx]),
      kidsTotal,
      hallPlusKids:
        hallPlusKidsIdx >= 0
          ? toNumber(row[hallPlusKidsIdx])
          : totalHall + kidsTotal,
    });
  });

  return data.sort((a, b) => a.date - b.date);
}

function parseGroupCounts(newBelieverTable, selectedDateKey) {
  if (!newBelieverTable?.cols?.length) return [];

  const headers = newBelieverTable.cols;
  const groupIdx = findColumnIndex(headers, [
    "กลุ่ม",
    "group",
    "care",
    "cell group",
    "care group",
  ]);
  const dateIdx = findColumnIndex(headers, [
    "วันที่",
    "date",
    "decision date",
    "รับเชื่อ",
  ]);
  const nameIdx = findColumnIndex(headers, ["ชื่อ", "name", "nickname"]);
  const statusIdx = findColumnIndex(headers, ["status", "สถานะ"]);

  if (groupIdx < 0) return [];

  const counts = new Map();

  newBelieverTable.rows.forEach((row) => {
    const group = String(row[groupIdx] || "").trim();
    if (!group) return;

    const name = nameIdx >= 0 ? String(row[nameIdx] || "").trim() : "";
    const status = statusIdx >= 0 ? String(row[statusIdx] || "").trim() : "";
    if (!name && !status && !group) return;

    if (selectedDateKey !== "all" && dateIdx >= 0) {
      const date = parseThaiDate(row[dateIdx]);
      const key = toDateKey(date);
      if (key !== selectedDateKey) return;
    }

    counts.set(group, (counts.get(group) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([group, total]) => ({ group, total }))
    .sort((a, b) => b.total - a.total);
}

function runDataParsingSelfTests() {
  const sampleDate = parseThaiDate("4/1/2026");
  console.assert(
    toDateKey(sampleDate) === "2026-01-04",
    "Expected full date parsing to preserve Gregorian year"
  );
  console.assert(
    formatShortDate(new Date(2026, 0, 4)).includes("26"),
    "Expected short date to show 2-digit Gregorian year"
  );
  console.assert(
    toNumber("1,234") === 1234,
    "Expected comma-separated numbers to parse correctly"
  );
  console.assert(
    findColumnIndex(["New Beliver", "Visitor"], ["new believer"]) === 0,
    "Expected typo-tolerant column match"
  );
  console.assert(
    parseThaiDate("4/1")?.getFullYear() === 2026,
    "Expected short date to use fallback year"
  );
}

runDataParsingSelfTests();

function Panel({ children, className = "", style }) {
  return (
    <div
      className={`rounded-[28px] bg-white shadow-sm ${className}`}
      style={{ border: "1px solid #e5e7eb", ...style }}
    >
      {children}
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, background }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Panel style={{ background }}>
        <div style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#475569" }}>
                {title}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 32,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {formatNumber(value)}
              </div>
            </div>
            <div
              style={{
                borderRadius: 18,
                background: "rgba(255,255,255,0.72)",
                padding: 12,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              <Icon size={20} color="#334155" />
            </div>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}

function BadgePill({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 9999,
        padding: "6px 12px",
        background: "#f1f5f9",
        color: "#334155",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function AlertBox({ children }) {
  return (
    <div
      style={{
        borderRadius: 24,
        border: "1px solid #fecaca",
        background: "#fef2f2",
        color: "#991b1b",
        padding: isMobile ? 10 : 16,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <AlertCircle size={18} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ fontSize: 14 }}>{children}</div>
    </div>
  );
}

export default function App() {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const isMobile = windowWidth < 768;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState("all");
  const [headCountPage, setHeadCountPage] = useState(0);
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [groupTable, setGroupTable] = useState({ cols: [], rows: [] });

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [mainTable, believerTable] = await Promise.all([
          fetchGoogleSheet(CONFIG.mainSheetName),
          fetchGoogleSheet(CONFIG.newBelieverSheetName).catch(() => ({
            cols: [],
            rows: [],
          })),
        ]);

        setWeeklyStats(parseMainStats(mainTable));
        setGroupTable(believerTable);
      } catch (err) {
        setError(err?.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const dateOptions = useMemo(
    () =>
      weeklyStats.map((item) => ({
        value: item.dateKey,
        label: formatDate(item.date),
      })),
    [weeklyStats]
  );

  const filteredStats = useMemo(() => {
    if (selectedDateKey === "all") return weeklyStats;
    return weeklyStats.filter((item) => item.dateKey === selectedDateKey);
  }, [weeklyStats, selectedDateKey]);

  const summary = useMemo(
    () =>
      filteredStats.reduce(
        (acc, item) => {
          acc.ctVisitor += item.ctVisitor;
          acc.visitor += item.visitor;
          acc.newBeliever += item.newBeliever;
          acc.baptism += item.baptism;
          return acc;
        },
        { ctVisitor: 0, visitor: 0, newBeliever: 0, baptism: 0 }
      ),
    [filteredStats]
  );

  const headCountChartData = useMemo(
    () =>
      weeklyStats.map((item) => ({
        label: formatShortDate(item.date),
        month: item.month,
        total: item.hallPlusKids,
        dateKey: item.dateKey,
        date: item.date,
      })),
    [weeklyStats]
  );

  const HEAD_COUNT_PAGE_SIZE = isMobile ? 4 : 5;

  const maxHeadCountPage = Math.max(
    0,
    Math.ceil(headCountChartData.length / HEAD_COUNT_PAGE_SIZE) - 1
  );

  const visibleHeadCountChartData = useMemo(() => {
    const safePage = Math.min(headCountPage, maxHeadCountPage);
    const start = safePage * HEAD_COUNT_PAGE_SIZE;
    return headCountChartData.slice(start, start + HEAD_COUNT_PAGE_SIZE);
  }, [
    headCountChartData,
    headCountPage,
    maxHeadCountPage,
    HEAD_COUNT_PAGE_SIZE,
  ]);

  const currentHeadCountMonthLabel = useMemo(() => {
    if (!visibleHeadCountChartData.length) return "";
    const firstMonth = visibleHeadCountChartData[0]?.month || "";
    const allSameMonth = visibleHeadCountChartData.every(
      (item) => item.month === firstMonth
    );
    if (allSameMonth) return firstMonth;
    const lastMonth =
      visibleHeadCountChartData[visibleHeadCountChartData.length - 1]?.month ||
      "";
    return `${firstMonth} - ${lastMonth}`;
  }, [visibleHeadCountChartData]);

  useEffect(() => {
    setHeadCountPage(Math.min(headCountPage, maxHeadCountPage));
  }, [maxHeadCountPage]);

  const groupChartData = useMemo(
    () => parseGroupCounts(groupTable, selectedDateKey),
    [groupTable, selectedDateKey]
  );

  const adultRows = useMemo(
    () =>
      filteredStats.map((item) => ({
        date: formatDate(item.date),
        hall: item.hall,
        outside: item.outside,
        ctVisitor: item.ctVisitor,
        visitor: item.visitor,
        newBeliever: item.newBeliever,
        baptism: item.baptism,
      })),
    [filteredStats]
  );

  const kidsRows = useMemo(
    () =>
      filteredStats.map((item) => ({
        date: formatDate(item.date),
        toddler: item.toddler,
        kindergarten: item.kindergarten,
        primary: item.primary,
        junior: item.junior,
        nonSpecific: item.nonSpecific,
        teacher: item.teacher,
        total: item.kidsTotal,
      })),
    [filteredStats]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: isMobile ? 10 : 16,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <Panel>
          <div
            style={{
              padding: 24,
              display: "flex",
              gap: 16,
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: 16,
                  background: "#2563eb",
                  padding: isMobile ? "10px 16px" : "12px 20px",
                  fontSize: isMobile ? 20 : 30,
                  fontWeight: 700,
                  color: "white",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                Sunday Stat Dashboard
              </div>
              <p style={{ marginTop: 12, fontSize: 14, color: "#64748b" }}>
                ดึงข้อมูลแบบเรียลไทม์จาก Google Sheets
                และสามารถเลือกดูรายวันหรือรวมทั้งหมดได้
              </p>
            </div>

            <div
              style={{
                width: "100%",
                maxWidth: 280,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <label
                style={{ fontSize: 14, fontWeight: 500, color: "#475569" }}
              >
                เลือกวันที่
              </label>
              <select
                value={selectedDateKey}
                onChange={(e) => setSelectedDateKey(e.target.value)}
                style={{
                  height: 48,
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                  background: "#fcd34d",
                  padding: "0 14px",
                  fontWeight: 600,
                  color: "#0f172a",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  outline: "none",
                }}
              >
                <option value="all">ทั้งหมด</option>
                {dateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Panel>

        {error ? (
          <AlertBox>
            โหลดข้อมูลไม่สำเร็จ: {error} — ตรวจสอบว่า Google Sheet
            เปิดสิทธิ์ให้เข้าถึงได้ และชื่อชีท{" "}
            <strong>{CONFIG.mainSheetName}</strong> และ{" "}
            <strong>{CONFIG.newBelieverSheetName}</strong> ถูกต้อง
          </AlertBox>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          <KpiCard
            title="ยอดรวม CT Visitor"
            value={summary.ctVisitor}
            icon={Users}
            background="#ffedd5"
          />
          <KpiCard
            title="ยอดรวม Visitor"
            value={summary.visitor}
            icon={UserRound}
            background="#cffafe"
          />
          <KpiCard
            title="ยอดรวม New Believer"
            value={summary.newBeliever}
            icon={UserPlus}
            background="#fae8ff"
          />
          <KpiCard
            title="ยอดรวม Baptism"
            value={summary.baptism}
            icon={Droplets}
            background="#ccfbf1"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "1fr"
              : "minmax(0, 1.05fr) minmax(0, 0.95fr)",
            gap: 24,
          }}
        >
          <Panel>
            <div style={{ padding: isMobile ? 16 : 24, paddingBottom: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: isMobile ? "flex-start" : "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#1e293b",
                  }}
                >
                  <Building2 size={20} />
                  Head Count: รวม Hall + คจ.เด็ก ต่อสัปดาห์
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {currentHeadCountMonthLabel ? (
                    <BadgePill>{currentHeadCountMonthLabel}</BadgePill>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setHeadCountPage((prev) => Math.max(0, prev - 1))
                    }
                    disabled={headCountPage === 0}
                    style={{
                      border: "1px solid #cbd5e1",
                      background: headCountPage === 0 ? "#e2e8f0" : "white",
                      color: "#334155",
                      borderRadius: 10,
                      padding: "6px 10px",
                      cursor: headCountPage === 0 ? "not-allowed" : "pointer",
                      fontWeight: 600,
                    }}
                  >
                    ← ก่อนหน้า
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHeadCountPage((prev) =>
                        Math.min(maxHeadCountPage, prev + 1)
                      )
                    }
                    disabled={headCountPage >= maxHeadCountPage}
                    style={{
                      border: "1px solid #cbd5e1",
                      background:
                        headCountPage >= maxHeadCountPage ? "#e2e8f0" : "white",
                      color: "#334155",
                      borderRadius: 10,
                      padding: "6px 10px",
                      cursor:
                        headCountPage >= maxHeadCountPage
                          ? "not-allowed"
                          : "pointer",
                      fontWeight: 600,
                    }}
                  >
                    ถัดไป →
                  </button>
                </div>
              </div>
            </div>
            <div
              style={{
                height: isMobile ? 300 : 360,
                padding: isMobile ? "8px 12px 16px" : "8px 24px 24px",
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={visibleHeadCountChartData}
                  margin={
                    isMobile
                      ? { top: 16, right: 8, left: -18, bottom: 16 }
                      : { top: 24, right: 18, left: 4, bottom: 8 }
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: isMobile ? 11 : 12 }}
                    angle={0}
                    textAnchor="middle"
                    height={isMobile ? 36 : 30}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    width={isMobile ? 28 : 40}
                  />
                  <Tooltip
                    formatter={(value) => [formatNumber(value), "รวมคน"]}
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload?.month
                        ? `${label} • ${payload[0].payload.month}`
                        : label
                    }
                  />
                  <Bar
                    dataKey="total"
                    name="Hall + คจ.เด็ก"
                    fill={KPI_COLORS.visitor}
                    radius={[10, 10, 0, 0]}
                  >
                    <LabelList
                      dataKey="total"
                      position="top"
                      formatter={(value) => formatNumber(value)}
                      className="fill-sky-700"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel>
            <div
              style={{
                padding: isMobile ? 16 : 24,
                paddingBottom: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
                จำนวนผู้เชื่อใหม่ในแต่ละกลุ่ม
              </div>
              <BadgePill>
                {selectedDateKey === "all" ? "รวมทั้งหมด" : "ตามวันที่เลือก"}
              </BadgePill>
            </div>
            <div
              style={{
                height: isMobile ? 300 : 360,
                padding: isMobile ? "8px 12px 16px" : "8px 24px 24px",
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={groupChartData}
                  layout="vertical"
                  margin={
                    isMobile
                      ? { top: 8, right: 24, left: 0, bottom: 8 }
                      : { top: 8, right: 28, left: 28, bottom: 8 }
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="group"
                    type="category"
                    width={isMobile ? 88 : 150}
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                  />
                  <Tooltip formatter={(value) => [formatNumber(value), "คน"]} />
                  <Bar
                    dataKey="total"
                    name="New Believer"
                    radius={[0, 10, 10, 0]}
                  >
                    {groupChartData.map((entry, index) => (
                      <Cell
                        key={`${entry.group}-${index}`}
                        fill={GROUP_BAR_COLORS[index % GROUP_BAR_COLORS.length]}
                      />
                    ))}
                    <LabelList
                      dataKey="total"
                      position="right"
                      formatter={(value) => formatNumber(value)}
                      className="fill-amber-700"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "1fr"
              : "repeat(auto-fit, minmax(420px, 1fr))",
            gap: 24,
          }}
        >
          <Panel>
            <div style={{ padding: isMobile ? 16 : 24, paddingBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
                คจ.ผู้ใหญ่ รายสัปดาห์
              </div>
            </div>
            <div style={{ padding: isMobile ? "0 12px 16px" : "0 24px 24px" }}>
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                }}
              >
                <table
                  style={{
                    minWidth: "100%",
                    fontSize: 14,
                    borderCollapse: "collapse",
                  }}
                >
                  <thead style={{ background: "#fb923c", color: "#020617" }}>
                    <tr>
                      {[
                        "วันที่",
                        "Hall",
                        "Outside",
                        "CT-Visitor",
                        "Visitor",
                        "New Believer",
                        "Baptism",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adultRows.map((row) => (
                      <tr
                        key={`${row.date}-${row.hall}-${row.ctVisitor}`}
                        style={{
                          borderTop: "1px solid #f1f5f9",
                          background: "white",
                        }}
                      >
                        <td style={{ padding: "12px 16px" }}>{row.date}</td>
                        <td style={{ padding: "12px 16px" }}>{row.hall}</td>
                        <td style={{ padding: "12px 16px" }}>{row.outside}</td>
                        <td style={{ padding: "12px 16px" }}>
                          {row.ctVisitor}
                        </td>
                        <td style={{ padding: "12px 16px" }}>{row.visitor}</td>
                        <td style={{ padding: "12px 16px" }}>
                          {row.newBeliever}
                        </td>
                        <td style={{ padding: "12px 16px" }}>{row.baptism}</td>
                      </tr>
                    ))}
                    {!adultRows.length ? (
                      <tr>
                        <td
                          colSpan={7}
                          style={{
                            padding: "32px 16px",
                            textAlign: "center",
                            color: "#64748b",
                          }}
                        >
                          ไม่มีข้อมูล
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          <Panel>
            <div style={{ padding: isMobile ? 16 : 24, paddingBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
                คจ.เด็ก รายสัปดาห์
              </div>
            </div>
            <div style={{ padding: isMobile ? "0 12px 16px" : "0 24px 24px" }}>
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                }}
              >
                <table
                  style={{
                    minWidth: "100%",
                    fontSize: 14,
                    borderCollapse: "collapse",
                  }}
                >
                  <thead style={{ background: "#f472b6", color: "#020617" }}>
                    <tr>
                      {[
                        "วันที่",
                        "Toddler",
                        "อนุบาล",
                        "ป.ต้น",
                        "ป.ปลาย",
                        "Non Specific",
                        "Teacher",
                        "รวม คจ.เด็ก",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kidsRows.map((row) => (
                      <tr
                        key={`${row.date}-${row.total}-${row.teacher}`}
                        style={{
                          borderTop: "1px solid #f1f5f9",
                          background: "white",
                        }}
                      >
                        <td style={{ padding: "12px 16px" }}>{row.date}</td>
                        <td style={{ padding: "12px 16px" }}>{row.toddler}</td>
                        <td style={{ padding: "12px 16px" }}>
                          {row.kindergarten}
                        </td>
                        <td style={{ padding: "12px 16px" }}>{row.primary}</td>
                        <td style={{ padding: "12px 16px" }}>{row.junior}</td>
                        <td style={{ padding: "12px 16px" }}>
                          {row.nonSpecific}
                        </td>
                        <td style={{ padding: "12px 16px" }}>{row.teacher}</td>
                        <td style={{ padding: "12px 16px", fontWeight: 700 }}>
                          {row.total}
                        </td>
                      </tr>
                    ))}
                    {!kidsRows.length ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            padding: "32px 16px",
                            textAlign: "center",
                            color: "#64748b",
                          }}
                        >
                          ไม่มีข้อมูล
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>
        </div>

        <Panel>
          <div
            style={{
              padding: isMobile ? 16 : 20,
              fontSize: 14,
              color: "#64748b",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <CalendarDays size={16} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                ระบบนี้ตั้งค่าให้แสดงผลทั้งหมดเป็นค่าเริ่มต้น และจะกรองทั้ง KPI,
                ตาราง, และกราฟกลุ่มผู้เชื่อใหม่เมื่อเลือกวันที่ ส่วนกราฟ Head
                Count แสดงครั้งละ 4-5 สัปดาห์
                และใช้ปุ่มก่อนหน้า/ถัดไปเพื่อเลื่อนดูช่วงสัปดาห์อื่น ๆ ได้
              </div>
            </div>
            {loading ? (
              <div style={{ marginTop: 12, fontWeight: 600, color: "#334155" }}>
                กำลังโหลดข้อมูล...
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
fix: remove UserRound
