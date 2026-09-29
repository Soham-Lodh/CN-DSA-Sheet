import { LeetCodeProvider } from "./leetcode";

let provider: LeetCodeProvider | null = null;

/** The app's only platform provider (LeetCode-only product). */
export function getProvider(): LeetCodeProvider {
  if (!provider) provider = new LeetCodeProvider();
  return provider;
}
