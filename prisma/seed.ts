import { PrismaClient, Difficulty, SheetStatus } from "@prisma/client";

const prisma = new PrismaClient();

const sampleLeetCodeProblems = [
  { externalKey: "leetcode:two-sum", url: "https://leetcode.com/problems/two-sum/", title: "Two Sum", difficulty: Difficulty.EASY, topic: "Arrays", tags: ["Array", "Hash Table"] },
  { externalKey: "leetcode:best-time-to-buy-and-sell-stock", url: "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/", title: "Best Time to Buy and Sell Stock", difficulty: Difficulty.EASY, topic: "Arrays", tags: ["Array", "Dynamic Programming"] },
  { externalKey: "leetcode:contains-duplicate", url: "https://leetcode.com/problems/contains-duplicate/", title: "Contains Duplicate", difficulty: Difficulty.EASY, topic: "Arrays", tags: ["Array", "Hash Table"] },
  { externalKey: "leetcode:product-of-array-except-self", url: "https://leetcode.com/problems/product-of-array-except-self/", title: "Product of Array Except Self", difficulty: Difficulty.MEDIUM, topic: "Arrays", tags: ["Array", "Prefix Sum"] },
  { externalKey: "leetcode:3sum", url: "https://leetcode.com/problems/3sum/", title: "3Sum", difficulty: Difficulty.MEDIUM, topic: "Arrays", tags: ["Array", "Two Pointers", "Sorting"] },
  { externalKey: "leetcode:valid-anagram", url: "https://leetcode.com/problems/valid-anagram/", title: "Valid Anagram", difficulty: Difficulty.EASY, topic: "Strings", tags: ["Hash Table", "String", "Sorting"] },
  { externalKey: "leetcode:valid-parentheses", url: "https://leetcode.com/problems/valid-parentheses/", title: "Valid Parentheses", difficulty: Difficulty.EASY, topic: "Stack", tags: ["String", "Stack"] },
  { externalKey: "leetcode:invert-binary-tree", url: "https://leetcode.com/problems/invert-binary-tree/", title: "Invert Binary Tree", difficulty: Difficulty.EASY, topic: "Trees", tags: ["Tree", "DFS", "BFS"] },
  { externalKey: "leetcode:number-of-islands", url: "https://leetcode.com/problems/number-of-islands/", title: "Number of Islands", difficulty: Difficulty.MEDIUM, topic: "Graphs", tags: ["Array", "DFS", "BFS", "Union Find"] },
  { externalKey: "leetcode:climbing-stairs", url: "https://leetcode.com/problems/climbing-stairs/", title: "Climbing Stairs", difficulty: Difficulty.EASY, topic: "Dynamic Programming", tags: ["Math", "Dynamic Programming", "Memoization"] },
];

const achievements = [
  { key: "FIRST_SOLVED", title: "First Solved", description: "Solved your first question", threshold: 1, icon: "🚀" },
  { key: "SOLVED_10", title: "10 Solved", description: "Solved 10 DSA questions", threshold: 10, icon: "⚡" },
  { key: "SOLVED_25", title: "25 Solved", description: "Solved 25 DSA questions", threshold: 25, icon: "🔥" },
  { key: "SOLVED_50", title: "50 Solved", description: "Solved 50 DSA questions", threshold: 50, icon: "🎯" },
  { key: "MASTER_75", title: "75 Master", description: "Solved 75 DSA questions", threshold: 75, icon: "💎" },
  { key: "SOLVED_100", title: "100 Solved", description: "Solved 100 DSA questions", threshold: 100, icon: "🏆" },
  { key: "LEGEND_150", title: "150 Legend", description: "Mastered 150 DSA questions", threshold: 150, icon: "👑" },
];

async function main() {
  console.log("🌱 Seeding KIIT DSA Tracker Database (LeetCode-only)...");

  // 1. Seed Achievements
  for (const ach of achievements) {
    await prisma.achievement.upsert({
      where: { key: ach.key },
      create: ach,
      update: ach,
    });
  }

  // 2. Seed sheets
  const sheet75 = await prisma.sheet.upsert({
    where: { slug: "kiit-dsa-75" },
    create: {
      name: "KIIT DSA 75 Sheet",
      slug: "kiit-dsa-75",
      description: "Curated high-frequency interview foundation problems for KIIT coders.",
      status: SheetStatus.PUBLISHED,
    },
    update: { name: "KIIT DSA 75 Sheet", status: SheetStatus.PUBLISHED },
  });

  const sheet150 = await prisma.sheet.upsert({
    where: { slug: "kiit-dsa-150" },
    create: {
      name: "KIIT DSA 150 Sheet",
      slug: "kiit-dsa-150",
      description: "Advanced interview preparation and competitive track for tier-1 tech placements.",
      status: SheetStatus.PUBLISHED,
    },
    update: { name: "KIIT DSA 150 Sheet", status: SheetStatus.PUBLISHED },
  });

  // 3. Seed canonical questions & attach to sheets
  for (let i = 0; i < sampleLeetCodeProblems.length; i++) {
    const prob = sampleLeetCodeProblems[i];

    const question = await prisma.question.upsert({
      where: { externalKey: prob.externalKey },
      create: prob,
      update: {
        title: prob.title,
        difficulty: prob.difficulty,
        topic: prob.topic,
        tags: prob.tags,
        url: prob.url,
      },
    });

    await prisma.sheetQuestion.upsert({
      where: { sheetId_questionId: { sheetId: sheet75.id, questionId: question.id } },
      create: { sheetId: sheet75.id, questionId: question.id, position: i + 1 },
      update: { position: i + 1 },
    });

    await prisma.sheetQuestion.upsert({
      where: { sheetId_questionId: { sheetId: sheet150.id, questionId: question.id } },
      create: { sheetId: sheet150.id, questionId: question.id, position: i + 1 },
      update: { position: i + 1 },
    });
  }

  console.log("✅ Database seeding successfully completed!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
