import React, { useEffect, useMemo, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import { doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCoUk7w8bCpljFF7-D_iiLgX8coVyfAV9c",
  authDomain: "saengganghero.firebaseapp.com",
  projectId: "saengganghero",
  storageBucket: "saengganghero.firebasestorage.app",
  messagingSenderId: "958895836471",
  appId: "1:958895836471:web:b74c68b97e022197b55eb2",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const trackerDocRef = doc(db, "bibleTracker", "youth-main-v2");

const OLD_TESTAMENT = [
  ["창세기", 50], ["출애굽기", 40], ["레위기", 27], ["민수기", 36], ["신명기", 34],
  ["여호수아", 24], ["사사기", 21], ["룻기", 4], ["사무엘상", 31], ["사무엘하", 24],
  ["열왕기상", 22], ["열왕기하", 25], ["역대상", 29], ["역대하", 36], ["에스라", 10],
  ["느헤미야", 13], ["에스더", 10], ["욥기", 42], ["시편", 150], ["잠언", 31],
  ["전도서", 12], ["아가", 8], ["이사야", 66], ["예레미야", 52], ["예레미야애가", 5],
  ["에스겔", 48], ["다니엘", 12], ["호세아", 14], ["요엘", 3], ["아모스", 9],
  ["오바댜", 1], ["요나", 4], ["미가", 7], ["나훔", 3], ["하박국", 3],
  ["스바냐", 3], ["학개", 2], ["스가랴", 14], ["말라기", 4],
];

const NEW_TESTAMENT = [
  ["마태복음", 28], ["마가복음", 16], ["누가복음", 24], ["요한복음", 21], ["사도행전", 28],
  ["로마서", 16], ["고린도전서", 16], ["고린도후서", 13], ["갈라디아서", 6], ["에베소서", 6],
  ["빌립보서", 4], ["골로새서", 4], ["데살로니가전서", 5], ["데살로니가후서", 3], ["디모데전서", 6],
  ["디모데후서", 4], ["디도서", 3], ["빌레몬서", 1], ["히브리서", 13], ["야고보서", 5],
  ["베드로전서", 5], ["베드로후서", 3], ["요한일서", 5], ["요한이서", 1], ["요한삼서", 1],
  ["유다서", 1], ["요한계시록", 22],
];

const BOOKS = [
  ...OLD_TESTAMENT.map(([name, chapters]) => ({ name, chapters, testament: "구약" })),
  ...NEW_TESTAMENT.map(([name, chapters]) => ({ name, chapters, testament: "신약" })),
];

const TOTAL_CHAPTERS = BOOKS.reduce((sum, book) => sum + book.chapters, 0);
const INITIAL_NAMES = ["조수아", "조민주", "이태현", "조민서", "김인애", "홍세라"];

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeCompletion(personId, date, index) {
  return {
    id: makeId(`completion-${personId}-${date}`),
    round: index + 1,
    date,
  };
}

function createInitialPeople() {
  return INITIAL_NAMES.map((name, index) => ({
    id: `person-${index + 1}`,
    name,
    checked: {},
    completions: [],
    readingDates: [],
    chapterLog: {},
  }));
}

function normalizePeople(value) {
  if (!Array.isArray(value)) return createInitialPeople();

  return value.map((person, personIndex) => {
    const id = String(person?.id || `person-${personIndex + 1}`);
    const completions = Array.isArray(person?.completions) ? person.completions : [];

    return {
      id,
      name: String(person?.name || `참여자${personIndex + 1}`),
      checked: person?.checked && typeof person.checked === "object" ? person.checked : {},
      readingDates: Array.isArray(person?.readingDates) ? person.readingDates.filter(Boolean) : [],
      chapterLog: person?.chapterLog && typeof person.chapterLog === "object" ? person.chapterLog : {},
      completions: completions
        .filter((item) => item && item.date)
        .map((item, index) => ({
          id: String(item.id || `completion-${id}-${item.date}-${index}`),
          round: index + 1,
          date: String(item.date),
        })),
    };
  });
}

function checkedCount(checked) {
  return Object.values(checked || {}).filter(Boolean).length;
}

function bookDoneCount(book, checked) {
  return Array.from({ length: book.chapters }, (_, index) => index + 1).filter(
    (chapter) => Boolean(checked?.[`${book.name}-${chapter}`])
  ).length;
}

function addChapterLog(person, date, amount) {
  const current = Number(person.chapterLog?.[date] || 0);
  const nextAmount = Math.max(0, current + amount);
  return {
    ...person,
    chapterLog: {
      ...(person.chapterLog || {}),
      [date]: nextAmount,
    },
  };
}

function runTests() {
  const checks = [
    [BOOKS.length === 66, "성경은 66권이어야 합니다."],
    [TOTAL_CHAPTERS === 1189, "전체 장 수는 1189장이어야 합니다."],
    [OLD_TESTAMENT.length === 39, "구약은 39권이어야 합니다."],
    [NEW_TESTAMENT.length === 27, "신약은 27권이어야 합니다."],
    [checkedCount({ a: true, b: false, c: true }) === 2, "체크 계산 오류"],
    [bookDoneCount({ name: "테스트", chapters: 3 }, { "테스트-1": true, "테스트-3": true }) === 2, "책별 장 수 계산 오류"],
    [addChapterLog({ chapterLog: { "2026-01-01": 3 } }, "2026-01-01", 4).chapterLog["2026-01-01"] === 7, "장수 기록 추가 오류"],
    [addChapterLog({ chapterLog: { "2026-01-01": 3 } }, "2026-01-01", -10).chapterLog["2026-01-01"] === 0, "장수 기록 차감 오류"],
  ];

  checks.forEach(([passed, message]) => {
    if (!passed) console.warn(message);
  });
}
runTests();

export default function App() {
  const [people, setPeople] = useState(createInitialPeople);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("구약");
  const [openedBook, setOpenedBook] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [adminError, setAdminError] = useState("");
  const [manualPersonId, setManualPersonId] = useState("");
  const [manualDate, setManualDate] = useState(getToday());
  const [newName, setNewName] = useState("");
  const [syncStatus, setSyncStatus] = useState("연결 중");
  const [rangeInputs, setRangeInputs] = useState({});
  const hasLoadedRemote = useRef(false);
  const lastRemoteJson = useRef("");

  const todayText = getToday();
  const selectedPerson = people.find((person) => person.id === selectedId) || null;
  const selectedBooks = useMemo(() => BOOKS.filter((book) => book.testament === view), [view]);
  const currentCheckedCount = selectedPerson ? checkedCount(selectedPerson.checked) : 0;
  const progressPercent = selectedPerson ? Math.round((currentCheckedCount / TOTAL_CHAPTERS) * 100) : 0;
  const totalCompletions = people.reduce((sum, person) => sum + person.completions.length, 0);
  const todayReaders = people.filter((person) => person.completions.some((item) => item.date === todayText));

  useEffect(() => {
    const unsubscribe = onSnapshot(
      trackerDocRef,
      async (snapshot) => {
        try {
          if (!snapshot.exists()) {
            const initialPeople = createInitialPeople();
            await setDoc(trackerDocRef, {
              people: initialPeople,
              updatedAt: new Date().toISOString(),
            });
            lastRemoteJson.current = JSON.stringify(initialPeople);
            hasLoadedRemote.current = true;
            setPeople(initialPeople);
            setSyncStatus("동기화됨");
            return;
          }

          const remotePeople = normalizePeople(snapshot.data()?.people || []);
          const remoteJson = JSON.stringify(remotePeople);
          lastRemoteJson.current = remoteJson;
          hasLoadedRemote.current = true;
          setPeople(remotePeople);
          setSyncStatus("동기화됨");
        } catch (error) {
          console.error(error);
          setSyncStatus("동기화 오류");
        }
      },
      (error) => {
        console.error(error);
        setSyncStatus("동기화 오류");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!hasLoadedRemote.current) return;

    const currentJson = JSON.stringify(people);
    if (currentJson === lastRemoteJson.current) return;

    lastRemoteJson.current = currentJson;
    setSyncStatus("저장 중");
    setDoc(trackerDocRef, {
      people,
      updatedAt: new Date().toISOString(),
    })
      .then(() => setSyncStatus("동기화됨"))
      .catch((error) => {
        console.error(error);
        setSyncStatus("동기화 오류");
      });
  }, [people]);

  useEffect(() => {
    if (!selectedPerson || currentCheckedCount !== TOTAL_CHAPTERS) return;

    setPeople((prev) =>
      prev.map((person) => {
        if (person.id !== selectedPerson.id) return person;
        return {
          ...person,
          checked: {},
          completions: [...person.completions, makeCompletion(person.id, todayText, person.completions.length)],
          readingDates: Array.from(new Set([...(person.readingDates || []), todayText])),
          chapterLog: {},
        };
      })
    );
    setOpenedBook(null);
  }, [currentCheckedCount, selectedPerson?.id, todayText]);

  function updatePerson(personId, updater) {
    setPeople((prev) => prev.map((person) => (person.id === personId ? updater(person) : person)));
  }

  function markReadingDate(person) {
    const dates = Array.isArray(person.readingDates) ? person.readingDates : [];
    if (dates.includes(todayText)) return person;
    return { ...person, readingDates: [...dates, todayText] };
  }

  function toggleChapter(book, chapter) {
    if (!selectedPerson) return;
    const key = `${book.name}-${chapter}`;
    updatePerson(selectedPerson.id, (person) => {
      const nextPerson = markReadingDate(person);
      const wasDone = Boolean(nextPerson.checked[key]);
      const updatedPerson = {
        ...nextPerson,
        checked: { ...nextPerson.checked, [key]: !wasDone },
      };
      return addChapterLog(updatedPerson, todayText, wasDone ? -1 : 1);
    });
  }

  function toggleWholeBook(book) {
    if (!selectedPerson) return;
    updatePerson(selectedPerson.id, (person) => {
      const nextPerson = markReadingDate(person);
      const isAllDone = bookDoneCount(book, nextPerson.checked) === book.chapters;
      const nextChecked = { ...nextPerson.checked };
      let changedCount = 0;

      Array.from({ length: book.chapters }, (_, index) => index + 1).forEach((chapter) => {
        const key = `${book.name}-${chapter}`;
        const wasDone = Boolean(nextChecked[key]);
        nextChecked[key] = !isAllDone;
        if (wasDone !== nextChecked[key]) changedCount += nextChecked[key] ? 1 : -1;
      });

      return addChapterLog({ ...nextPerson, checked: nextChecked }, todayText, changedCount);
    });
  }

  function toggleRange(book, start, end) {
    if (!selectedPerson) return;

    updatePerson(selectedPerson.id, (person) => {
      const nextPerson = markReadingDate(person);
      const nextChecked = { ...nextPerson.checked };

      const chapters = Array.from(
        { length: end - start + 1 },
        (_, index) => start + index
      ).filter((chapter) => chapter >= 1 && chapter <= book.chapters);

      let addedCount = 0;
      chapters.forEach((chapter) => {
        const key = `${book.name}-${chapter}`;
        if (!nextChecked[key]) {
          nextChecked[key] = true;
          addedCount += 1;
        }
      });

      return addChapterLog({
        ...nextPerson,
        checked: nextChecked,
      }, todayText, addedCount);
    });
  }

  function applyCustomRange(book) {
    const range = rangeInputs[book.name] || {};
    const start = Number(range.start);
    const end = Number(range.end || range.start);

    if (!start || !end) {
      alert("시작 장과 마지막 장을 입력해 주세요.");
      return;
    }

    const safeStart = Math.max(1, Math.min(start, end));
    const safeEnd = Math.min(book.chapters, Math.max(start, end));

    toggleRange(book, safeStart, safeEnd);
    setRangeInputs((prev) => ({
      ...prev,
      [book.name]: { start: "", end: "" },
    }));
  }

  function updateRangeInput(bookName, field, value) {
    setRangeInputs((prev) => ({
      ...prev,
      [bookName]: {
        ...(prev[bookName] || {}),
        [field]: value.replace(/[^0-9]/g, ""),
      },
    }));
  }

  function resetCurrentCheck() {
    if (!selectedPerson) return;
    updatePerson(selectedPerson.id, (person) => ({ ...person, checked: {}, chapterLog: {} }));
  }

  function bookProgress(book) {
    if (!selectedPerson) return { done: 0, percent: 0, allDone: false };
    const done = bookDoneCount(book, selectedPerson.checked);
    return {
      done,
      percent: Math.round((done / book.chapters) * 100),
      allDone: done === book.chapters,
    };
  }

  function startOfWeek(dateString) {
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - date.getDay());
    return date;
  }

  function isThisWeek(dateString) {
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    return date >= startOfWeek(todayText);
  }

  function isThisMonth(dateString) {
    const today = new Date(todayText);
    const date = new Date(dateString);
    return today.getFullYear() === date.getFullYear() && today.getMonth() === date.getMonth();
  }

  function weeklyChapterCount(person) {
    return Object.entries(person.chapterLog || {}).reduce((sum, [date, amount]) => {
      return isThisWeek(date) ? sum + Number(amount || 0) : sum;
    }, 0);
  }

  function personStats(person) {
    return {
      totalReads: person.completions.length,
      weeklyReads: new Set((person.readingDates || []).filter(isThisWeek)).size,
      monthlyReads: new Set((person.readingDates || []).filter(isThisMonth)).size,
      weeklyChapters: weeklyChapterCount(person),
    };
  }

  const adminChartData = people.map((person) => {
    const stats = personStats(person);
    return {
      id: person.id,
      name: person.name,
      weeklyReads: stats.weeklyReads,
      monthlyReads: stats.monthlyReads,
      weeklyChapters: stats.weeklyChapters,
      percent: Math.min(100, Math.round((stats.weeklyChapters / TOTAL_CHAPTERS) * 100)),
    };
  });

  const maxWeeklyReads = Math.max(1, ...adminChartData.map((item) => item.weeklyReads));
  const maxMonthlyReads = Math.max(1, ...adminChartData.map((item) => item.monthlyReads));

  function loginAdmin(event) {
    event.preventDefault();
    if (adminId === "1009" && adminPw === "1004") {
      setAdminLoggedIn(true);
      setAdminError("");
    } else {
      setAdminError("아이디 또는 비밀번호가 맞지 않아요.");
    }
  }

  function addManualCompletion() {
    if (!manualPersonId || !manualDate) return;
    setPeople((prev) =>
      prev.map((person) =>
        person.id === manualPersonId
          ? {
              ...person,
              completions: [...person.completions, makeCompletion(person.id, manualDate, person.completions.length)],
              readingDates: Array.from(new Set([...(person.readingDates || []), manualDate])),
            }
          : person
      )
    );
  }

  function deleteCompletion(personId, completionId) {
    setPeople((prev) =>
      prev.map((person) => {
        if (person.id !== personId) return person;
        const nextCompletions = person.completions
          .filter((completion) => completion.id !== completionId)
          .map((completion, index) => ({ ...completion, round: index + 1 }));
        return { ...person, completions: nextCompletions };
      })
    );
  }

  function addParticipant() {
    const name = newName.trim();
    if (!name) return;
    if (people.some((person) => person.name === name)) {
      alert("이미 등록된 이름이에요.");
      return;
    }
    setPeople((prev) => [
      ...prev,
      { id: makeId("person"), name, checked: {}, completions: [], readingDates: [], chapterLog: {} },
    ]);
    setNewName("");
  }

  function deleteParticipant(personId) {
    setPeople((prev) => prev.filter((person) => person.id !== personId));
    if (selectedId === personId) {
      setSelectedId(null);
      setOpenedBook(null);
    }
    if (manualPersonId === personId) setManualPersonId("");
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #dff4ff; color: #17324d; }
        button, input, select { font: inherit; }
        .page { min-height: 100vh; padding: 18px; background: linear-gradient(180deg, #dff4ff 0%, #bfeaff 100%); }
        .container { width: min(1120px, 100%); margin: 0 auto; }
        .hero, .card, .empty-card, .book-card { background: rgba(255,255,255,.92); border: 1px solid rgba(82,183,255,.35); border-radius: 30px; box-shadow: 0 16px 40px rgba(38,106,160,.08); }
        .hero { padding: 28px; margin-bottom: 18px; text-align: center; }
        .church-badge { display: inline-flex; margin: 0 auto 12px; padding: 9px 16px; border-radius: 999px; background: #eaf8ff; color: #0d6aa5; font-weight: 800; }
        .hero h1 { margin: 0 0 24px; font-size: clamp(2.1rem, 7vw, 4.2rem); letter-spacing: -0.05em; color: #0b3e63; }
        .dashboard { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 14px; text-align: left; align-items: stretch; }
        .panel { border-radius: 24px; background: #eefaff; border: 1px solid #ccefff; padding: 18px; }
        .name-panel h2, .today-title, .total-title-line { margin: 0; font-size: 1rem; font-weight: 950; color: #17324d; line-height: 1.25; }
        .name-panel h2 { margin-bottom: 12px; font-size: 1.15rem; text-align: center; width: 100%; }
        .name-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .name, .tab, .done-button, .outline-button, .chapter { border: 1px solid #bde8ff; background: white; color: #17415f; cursor: pointer; transition: .15s; }
        .name:hover, .tab:hover, .done-button:hover, .outline-button:hover, .chapter:hover { transform: translateY(-1px); background: #effaff; }
        .name { border-radius: 18px; padding: 12px 10px; font-weight: 800; }
        .name.active, .tab.active, .done-button.active, .chapter.active { background: #1595d3; border-color: #1595d3; color: white; }
        .total-panel { display: flex; flex-direction: column; align-items: center; text-align: center; }
        .total-title-wrap { margin: 4px 0 12px; }
        .total-title-line { white-space: nowrap; }
        .stat-number { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 150px; font-size: 50px; font-weight: 1000; color: #0b70aa; line-height: 1; letter-spacing: -0.04em; white-space: nowrap; text-align: center; }
        .today-reader { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 90px; font-size: clamp(1.25rem, 3vw, 1.7rem); font-weight: 950; color: #0b70aa; text-align: center; }
        .today-empty { font-size: 1.05rem; }
        .sync-pill { position: fixed; left: 18px; bottom: 18px; z-index: 20; border-radius: 999px; background: white; color: #0b70aa; border: 1px solid #bde8ff; padding: 8px 12px; font-size: .85rem; font-weight: 900; box-shadow: 0 10px 24px rgba(38,106,160,.12); }
        .empty-card { padding: 34px; text-align: center; font-size: 1.08rem; font-weight: 800; }
        .tracker { display: grid; gap: 16px; }
        .card { padding: 20px; }
        .record-title-row h2 { margin: 0; color: #0b3e63; font-size: clamp(1.4rem, 4vw, 1.8rem); }
        .completion-list { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 8px; }
        .completion-chip, .muted-chip { display: inline-flex; border-radius: 999px; padding: 9px 14px; font-size: .95rem; font-weight: 800; }
        .completion-chip { background: #e4f7ff; color: #0a6fa9; }
        .muted-chip { background: #eef2f5; color: #6a7d8b; }
        .progress-top { display: flex; justify-content: space-between; gap: 10px; font-weight: 900; margin-bottom: 8px; }
        .progress-bar, .small-progress { overflow: hidden; border-radius: 999px; background: #e8f7ff; }
        .progress-bar { height: 16px; margin-bottom: 14px; }
        .progress-fill, .small-progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #43b9ed, #0b83c6); }
        .outline-button { border-radius: 18px; padding: 11px 15px; font-weight: 900; }
        .testament-tabs { display: flex; justify-content: center; gap: 10px; }
        .tab { min-width: 110px; border-radius: 18px; padding: 15px 24px; font-size: 1.15rem; font-weight: 950; }
        .book-list { display: grid; gap: 12px; }
        .book-card { padding: 18px; }
        .book-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .book-title { border: 0; background: transparent; cursor: pointer; padding: 0; color: #0b3e63; font-size: clamp(1.35rem, 4vw, 1.7rem); font-weight: 950; }
        .book-actions { display: flex; align-items: center; gap: 8px; }
        .book-percent { border-radius: 999px; background: #e4f7ff; color: #0b70aa; padding: 7px 10px; font-weight: 900; }
        .done-button { border-radius: 18px; padding: 10px 12px; font-weight: 900; white-space: nowrap; }
        .book-sub { margin: 6px 0 12px; color: #5f7587; font-weight: 700; }
        .small-progress { height: 9px; }
        .quick-range-form { display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 8px; align-items: center; margin-top: 16px; padding: 12px; border-radius: 18px; background: #f4fcff; border: 1px solid #cdefff; }
        .quick-range-form input { width: 100%; border: 1px solid #bde8ff; border-radius: 14px; padding: 11px 10px; font-weight: 900; text-align: center; color: #17415f; }
        .quick-range-form span { font-weight: 950; color: #0b70aa; }
        .quick-range-apply { border: 1px solid #1595d3; background: #1595d3; color: white; border-radius: 14px; padding: 11px 14px; font-weight: 950; cursor: pointer; white-space: nowrap; }
        .quick-range-help { margin: 8px 0 0; color: #5f7587; font-size: .9rem; font-weight: 800; }
        .chapter-grid { margin-top: 14px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
        .chapter { border-radius: 14px; padding: 9px 6px; font-weight: 900; font-size: .9rem; }
        .admin-top-button { position: fixed; top: 18px; right: 18px; z-index: 20; border: 1px solid #ffb0b0; background: linear-gradient(135deg,#ff6b6b,#d62828); color: white; border-radius: 999px; padding: 10px 16px; font-weight: 950; cursor: pointer; box-shadow: 0 10px 28px rgba(180,40,40,.25); }
        .admin-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-start; justify-content: center; padding: 70px 14px 24px; background: rgba(80,10,10,.45); overflow-y: auto; }
        .admin-modal { width: min(920px, 100%); border-radius: 28px; border: 1px solid #ffb7b7; background: linear-gradient(180deg,#fff7f7 0%,#ffeaea 100%); box-shadow: 0 24px 70px rgba(13,70,110,.25); padding: 22px; }
        .admin-modal-header, .admin-actions-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .admin-modal h2, .admin-section h3 { margin: 0; color: #8b1e1e; }
        .admin-close-button, .admin-small-button, .admin-primary-button, .admin-delete-button { border: 1px solid #ffb7b7; border-radius: 16px; padding: 10px 14px; font-weight: 900; cursor: pointer; }
        .admin-close-button, .admin-small-button { background: #fff1f1; color: #b42323; }
        .admin-primary-button { background: linear-gradient(135deg,#ff5f5f,#c1121f); border-color: #c1121f; color: white; }
        .admin-delete-button { background: #fff1f1; border-color: #ffc9c9; color: #a83232; }
        .admin-login-form, .admin-content { margin-top: 20px; display: grid; gap: 12px; }
        .admin-login-form label { display: grid; gap: 6px; font-weight: 900; color: #8b1e1e; }
        .admin-login-form input, .admin-form-grid input, .admin-form-grid select { width: 100%; border: 1px solid #ffb7b7; border-radius: 16px; padding: 12px 13px; font-weight: 800; color: #17324d; }
        .admin-error { margin: 0; color: #b32626; font-weight: 900; }
        .admin-section { border-radius: 22px; background: #fff5f5; border: 1px solid #ffd6d6; padding: 16px; }
        .admin-section h3 { margin-bottom: 12px; }
        .admin-table-wrap { overflow-x: auto; }
        .admin-table { width: 100%; border-collapse: collapse; border-radius: 16px; background: white; }
        .admin-table th, .admin-table td { border-bottom: 1px solid #ffe1e1; padding: 12px; text-align: left; white-space: nowrap; }
        .admin-table th { background: #ffe1e1; color: #9b1c1c; font-weight: 950; }
        .admin-table td { font-weight: 800; }
        .admin-form-grid { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; }
        .admin-list { display: grid; gap: 10px; }
        .admin-list-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; background: white; border: 1px solid #ffe1e1; border-radius: 16px; padding: 10px 12px; }
        .admin-list-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
        .admin-chart { display: grid; gap: 14px; }
        .admin-chart-row { display: grid; grid-template-columns: 86px 1fr; gap: 12px; align-items: center; background: white; border: 1px solid #ffe1e1; border-radius: 18px; padding: 12px; }
        .admin-chart-name { color: #8b1e1e; font-weight: 950; }
        .admin-bars { display: grid; gap: 8px; }
        .admin-bar-line { display: grid; grid-template-columns: 86px 1fr 72px; gap: 8px; align-items: center; font-size: .9rem; font-weight: 900; color: #8b1e1e; }
        .admin-bar-track { height: 14px; overflow: hidden; border-radius: 999px; background: #ffe1e1; }
        .admin-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #ff8a8a, #c1121f); }
        .admin-bar-fill.month { background: linear-gradient(90deg, #ffd166, #f77f00); }
        .admin-bar-fill.percent { background: linear-gradient(90deg, #74c0fc, #1971c2); }
        @media (max-width: 820px) { .dashboard { grid-template-columns: 1fr; } .book-header { align-items: flex-start; flex-direction: column; } .book-actions { width: 100%; justify-content: space-between; } .chapter-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 720px) { .admin-form-grid { grid-template-columns: 1fr; } .admin-list-row { align-items: flex-start; flex-direction: column; } .admin-modal { padding: 16px; } }
        @media (max-width: 420px) { .name-grid { grid-template-columns: 1fr; } .quick-range-form { grid-template-columns: 1fr; } .quick-range-form span { text-align: center; } .chapter-grid { grid-template-columns: repeat(3, 1fr); } .tab { min-width: 0; flex: 1; } .stat-number { font-size: 50px; min-height: 100px; } }
      `}</style>

      <div className="page">
        <div className="container">
          <button type="button" className="admin-top-button" onClick={() => setAdminOpen(true)}>관리자</button>
          <div className="sync-pill">{syncStatus}</div>

          <header className="hero">
            <div className="church-badge">📖 생수의강교회</div>
            <h1>🩵생강 청년부🩵</h1>

            <div className="dashboard">
              <section className="panel name-panel">
                <h2>이름 선택</h2>
                <div className="name-grid">
                  {people.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => setSelectedId((current) => (current === person.id ? null : person.id))}
                      className={selectedId === person.id ? "name active" : "name"}
                    >
                      {person.name}
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel total-panel main-total-panel">
                <div className="total-title-wrap">
                  <p className="total-title-line">지금까지 생강 청년부 통독 횟수</p>
                </div>
                <strong className="stat-number">{totalCompletions}독</strong>
              </section>

              <section className="panel total-panel today-panel">
                <p className="today-title">오늘 통독한 사람</p>
                <strong className="today-reader">
                  {todayReaders.length ? todayReaders.map((person) => person.name).join(", ") : <span className="today-empty">아직 없어요 🥹</span>}
                </strong>
              </section>
            </div>
          </header>

          {!selectedPerson && <section className="empty-card">이름을 누르면 아래에 통독 체크 화면이 열려요.</section>}

          {selectedPerson && (
            <main className="tracker">
              <section className="card">
                <div className="record-title-row"><h2>🏆 {selectedPerson.name} 통독 기록</h2></div>
                <div className="completion-list">
                  {selectedPerson.completions.length ? selectedPerson.completions.map((item) => (
                    <span key={item.id} className="completion-chip">{item.round}독 · {item.date}</span>
                  )) : <span className="muted-chip">아직 통독 기록이 없어요.</span>}
                </div>
              </section>

              <section className="card">
                <div className="progress-top"><span>{selectedPerson.name} · {currentCheckedCount} / {TOTAL_CHAPTERS}장 완료</span><span>{progressPercent}%</span></div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${progressPercent}%` }} /></div>
                <button type="button" className="outline-button" onClick={resetCurrentCheck}>↻ 현재 체크 초기화</button>
              </section>

              <div className="testament-tabs">
                {["구약", "신약"].map((item) => (
                  <button key={item} type="button" onClick={() => { setView(item); setOpenedBook(null); }} className={view === item ? "tab active" : "tab"}>{item}</button>
                ))}
              </div>

              <section className="book-list">
                {selectedBooks.map((book) => {
                  const progress = bookProgress(book);
                  const isOpen = openedBook === book.name;
                  return (
                    <article key={book.name} className="book-card">
                      <div className="book-header">
                        <button type="button" className="book-title" onClick={() => setOpenedBook((current) => (current === book.name ? null : book.name))}>{book.name} {isOpen ? "▴" : "▾"}</button>
                        <div className="book-actions">
                          <span className="book-percent">{progress.percent}%</span>
                          <button type="button" className={progress.allDone ? "done-button active" : "done-button"} onClick={() => toggleWholeBook(book)}>{progress.allDone ? "✓ 다 읽었어요" : "○ 다 읽었어요"}</button>
                        </div>
                      </div>
                      <p className="book-sub">{book.chapters}장 · {progress.done}/{book.chapters}장 체크</p>
                      <div className="small-progress"><div className="small-progress-fill" style={{ width: `${progress.percent}%` }} /></div>

                      {isOpen && (
                        <>
                          <div className="quick-range-form">
                            <input
                              inputMode="numeric"
                              value={rangeInputs[book.name]?.start || ""}
                              onChange={(event) => updateRangeInput(book.name, "start", event.target.value)}
                              placeholder="시작 장"
                            />
                            <span>부터</span>
                            <input
                              inputMode="numeric"
                              value={rangeInputs[book.name]?.end || ""}
                              onChange={(event) => updateRangeInput(book.name, "end", event.target.value)}
                              placeholder="마지막 장"
                            />
                            <button type="button" className="quick-range-apply" onClick={() => applyCustomRange(book)}>
                              체크
                            </button>
                          </div>

                          <div className="chapter-grid">
                            {Array.from({ length: book.chapters }, (_, index) => index + 1).map((chapter) => {
                              const key = `${book.name}-${chapter}`;
                              const isDone = Boolean(selectedPerson.checked[key]);
                              return <button key={chapter} type="button" className={isDone ? "chapter active" : "chapter"} onClick={() => toggleChapter(book, chapter)}>{isDone ? "✓" : "○"} {chapter}장</button>;
                            })}
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </section>
            </main>
          )}

          {adminOpen && (
            <div className="admin-overlay">
              <section className="admin-modal">
                <div className="admin-modal-header">
                  <h2>관리자 페이지</h2>
                  <button type="button" className="admin-close-button" onClick={() => setAdminOpen(false)}>닫기</button>
                </div>

                {!adminLoggedIn ? (
                  <form className="admin-login-form" onSubmit={loginAdmin}>
                    <label>아이디<input value={adminId} onChange={(event) => setAdminId(event.target.value)} /></label>
                    <label>비밀번호<input type="password" value={adminPw} onChange={(event) => setAdminPw(event.target.value)} /></label>
                    {adminError && <p className="admin-error">{adminError}</p>}
                    <button type="submit" className="admin-primary-button">로그인</button>
                  </form>
                ) : (
                  <div className="admin-content">
                    <div className="admin-actions-row">
                      <strong>로그인 완료</strong>
                      <button type="button" className="admin-small-button" onClick={() => setAdminLoggedIn(false)}>로그아웃</button>
                    </div>

                    <section className="admin-section">
                      <h3>통독 현황</h3>
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead><tr><th>이름</th><th>통독 횟수</th><th>이번주 읽은 횟수</th><th>이번주 읽은 장수</th></tr></thead>
                          <tbody>
                            {people.map((person) => {
                              const stats = personStats(person);
                              return <tr key={person.id}><td>{person.name}</td><td>{stats.totalReads}독</td><td>{stats.weeklyReads}회</td><td>{stats.weeklyChapters}장</td></tr>;
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section className="admin-section">
                      <h3>한눈에 보기</h3>
                      <div className="admin-chart">
                        {adminChartData.map((item) => (
                          <div key={item.id} className="admin-chart-row">
                            <strong className="admin-chart-name">{item.name}</strong>
                            <div className="admin-bars">
                              <div className="admin-bar-line">
                                <span>이번주 횟수</span>
                                <div className="admin-bar-track"><div className="admin-bar-fill" style={{ width: `${(item.weeklyReads / maxWeeklyReads) * 100}%` }} /></div>
                                <span>{item.weeklyReads}회</span>
                              </div>
                              <div className="admin-bar-line">
                                <span>이번달 횟수</span>
                                <div className="admin-bar-track"><div className="admin-bar-fill month" style={{ width: `${(item.monthlyReads / maxMonthlyReads) * 100}%` }} /></div>
                                <span>{item.monthlyReads}회</span>
                              </div>
                              <div className="admin-bar-line">
                                <span>1독까지~</span>
                                <div className="admin-bar-track"><div className="admin-bar-fill percent" style={{ width: `${item.percent}%` }} /></div>
                                <span>{item.percent}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="admin-section">
                      <h3>통독 기록 추가 입력</h3>
                      <div className="admin-form-grid">
                        <select value={manualPersonId} onChange={(event) => setManualPersonId(event.target.value)}>
                          <option value="">이름 선택</option>
                          {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                        </select>
                        <input type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} />
                        <button type="button" className="admin-primary-button" onClick={addManualCompletion}>통독 기록 추가</button>
                      </div>
                    </section>

                    <section className="admin-section">
                      <h3>통독 기록 삭제</h3>
                      <div className="admin-list">
                        {people.map((person) => (
                          <div key={person.id} className="admin-list-row">
                            <strong>{person.name}</strong>
                            <div className="admin-list-buttons">
                              {person.completions.length ? person.completions.map((completion) => (
                                <button key={completion.id} type="button" className="admin-delete-button" onClick={() => deleteCompletion(person.id, completion.id)}>
                                  삭제: {completion.round}독 · {completion.date}
                                </button>
                              )) : <span>삭제할 기록 없음</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="admin-section">
                      <h3>참여자 추가</h3>
                      <div className="admin-form-grid">
                        <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="새 참여자 이름" />
                        <button type="button" className="admin-primary-button" onClick={addParticipant}>참여자 추가</button>
                      </div>
                    </section>

                    <section className="admin-section">
                      <h3>참여자 삭제</h3>
                      <div className="admin-list-buttons">
                        {people.map((person) => (
                          <button key={person.id} type="button" className="admin-delete-button" onClick={() => deleteParticipant(person.id)}>
                            삭제: {person.name}
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
