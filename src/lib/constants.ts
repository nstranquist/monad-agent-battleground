// Agents owned by these addresses are hidden from the opponent picker
// and the leaderboard — they are simulation / deployer test wallets
// that were used to seed the system and would pollute the live UI.
export const TEST_ADDRESSES = new Set([
  "0x87c1a9281abcb1b894792b49b4ff7b95de667201", // deployer / Rabby 1
  "0xff6e8bb3190e1a76445db702aa522b3eedf5022e", // Rabby 2
  "0x2fb62cfa3c06074c145f6c40bab3dfda1d9b20cf", // backup
  "0xe1d58146bb59aba159588cdc4026ebb52bf516b6", // test1
  "0xae960fa5229db90daf10d5e0fb7ae69292d40fc5", // test2
  "0x0418dc095eed888d2370fe2b0018bcf54615697e", // test3
  "0xd2097f2bd5031c8275ce33b7f5f0a6d9a44562a6", // test4
  "0x5b85e9debfa4e3b568ff4cbd55f0d9bb8a4fc61f", // test5
]);
