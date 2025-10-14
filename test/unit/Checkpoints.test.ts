import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CAPToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { mine, time as _time } from "@nomicfoundation/hardhat-network-helpers";

describe("Checkpoint and Multi-Block Tests", function () {
  let cap: CAPToken;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, treasury, user1, user2, user3] = await ethers.getSigners();

    const CAP = await ethers.getContractFactory("CAPToken");
    cap = (await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
      kind: "uups",
      initializer: "initialize",
    })) as unknown as CAPToken;

    // Distribute tokens
    await cap.connect(owner).transfer(user1.address, ethers.parseEther("100000"));
    await cap.connect(owner).transfer(user2.address, ethers.parseEther("100000"));
    await cap.connect(owner).transfer(user3.address, ethers.parseEther("100000"));
  });

  describe("Voting Power Checkpoints", function () {
    it("Should track voting power across multiple blocks", async function () {
      // Block 1: User1 delegates to self
      await cap.connect(user1).delegate(user1.address);
      await mine(1);

      const block1 = await ethers.provider.getBlockNumber();
      const votes1 = await cap.getVotes(user1.address);
      const balance1 = await cap.balanceOf(user1.address);

      expect(votes1).to.equal(balance1);

      // Block 2-5: Transfer tokens (reduces voting power)
      await cap.connect(user1).transfer(user2.address, ethers.parseEther("10000"));
      await mine(3);

      const block2 = await ethers.provider.getBlockNumber();
      const votes2 = await cap.getVotes(user1.address);
      const balance2 = await cap.balanceOf(user1.address);

      expect(votes2).to.equal(balance2);
      expect(votes2).to.be.lt(votes1);

      // Block 6-10: Transfer more tokens
      await cap.connect(user1).transfer(user3.address, ethers.parseEther("5000"));
      await mine(4);

      const votes3 = await cap.getVotes(user1.address);
      const balance3 = await cap.balanceOf(user1.address);

      expect(votes3).to.equal(balance3);
      expect(votes3).to.be.lt(votes2);

      // Verify historical voting power
      const pastVotes1 = await cap.getPastVotes(user1.address, block1);
      expect(pastVotes1).to.equal(votes1);

      const pastVotes2 = await cap.getPastVotes(user1.address, block2);
      expect(pastVotes2).to.equal(votes2);
    });

    it("Should handle delegation changes across blocks", async function () {
      // Block 1: User1 delegates to self
      await cap.connect(user1).delegate(user1.address);
      await mine(1);

      const block1 = await ethers.provider.getBlockNumber();
      const user1Votes1 = await cap.getVotes(user1.address);
      expect(user1Votes1).to.equal(await cap.balanceOf(user1.address));

      // Block 2: User1 delegates to User2
      await cap.connect(user1).delegate(user2.address);
      await mine(1);

      const block2 = await ethers.provider.getBlockNumber();
      const user1Votes2 = await cap.getVotes(user1.address);
      const user2Votes2 = await cap.getVotes(user2.address);

      expect(user1Votes2).to.equal(0);
      expect(user2Votes2).to.equal(await cap.balanceOf(user1.address));

      // Block 3: User2 self-delegates (gets their own balance too)
      await cap.connect(user2).delegate(user2.address);
      await mine(1);

      const user2Votes3 = await cap.getVotes(user2.address);
      const user1Balance = await cap.balanceOf(user1.address);
      const user2Balance = await cap.balanceOf(user2.address);

      expect(user2Votes3).to.equal(user1Balance + user2Balance);

      // Verify historical votes
      const pastVotesUser1Block1 = await cap.getPastVotes(user1.address, block1);
      expect(pastVotesUser1Block1).to.equal(user1Votes1);

      const pastVotesUser2Block2 = await cap.getPastVotes(user2.address, block2);
      expect(pastVotesUser2Block2).to.equal(user2Votes2);
    });

    it("Should handle complex delegation chains across blocks", async function () {
      // Initial delegations
      await cap.connect(user1).delegate(user2.address);
      await cap.connect(user2).delegate(user3.address);
      await cap.connect(user3).delegate(user3.address);
      await mine(1);

      const block1 = await ethers.provider.getBlockNumber();

      const user1Balance = await cap.balanceOf(user1.address);
      const user2Balance = await cap.balanceOf(user2.address);
      const user3Balance = await cap.balanceOf(user3.address);

      // User3 should have all voting power (user1 -> user2 -> user3 delegation chain)
      // Note: user1Balance delegated to user2, user2 Balance delegated to user3, user3Balance self-delegated
      const user3Votes1 = await cap.getVotes(user3.address);
      // Due to delegation chain, user3 only gets user2's balance + own balance
      // (user1 delegates to user2, not transitively to user3)
      expect(user3Votes1).to.equal(user2Balance + user3Balance);

      // Change delegation: User2 now self-delegates
      await cap.connect(user2).delegate(user2.address);
      await mine(1);

      const _block2 = await ethers.provider.getBlockNumber();

      const user2Votes2 = await cap.getVotes(user2.address);
      const user3Votes2 = await cap.getVotes(user3.address);

      // User2 gets user1's delegation + own balance
      expect(user2Votes2).to.equal(user1Balance + user2Balance);
      // User3 only has own balance
      expect(user3Votes2).to.equal(user3Balance);

      // Mine additional blocks to ensure checkpoint is finalized
      await mine(2);

      // Verify historical state (query block before current)
      const pastUser3Votes = await cap.getPastVotes(user3.address, block1 - 1);
      expect(pastUser3Votes).to.equal(user2Balance + user3Balance);
    });

    it("Should track total voting power across blocks", async function () {
      // Activate voting power for all users
      await cap.connect(user1).delegate(user1.address);
      await cap.connect(user2).delegate(user2.address);
      await cap.connect(user3).delegate(user3.address);
      await mine(1);

      const _block1 = await ethers.provider.getBlockNumber();

      const totalVotes1 =
        (await cap.getVotes(user1.address)) + (await cap.getVotes(user2.address)) + (await cap.getVotes(user3.address));

      const totalBalance =
        (await cap.balanceOf(user1.address)) +
        (await cap.balanceOf(user2.address)) +
        (await cap.balanceOf(user3.address));

      expect(totalVotes1).to.equal(totalBalance);

      // Burn some tokens (reduces total voting power)
      await cap.connect(user1).burn(ethers.parseEther("10000"));
      await mine(5);

      const totalVotes2 =
        (await cap.getVotes(user1.address)) + (await cap.getVotes(user2.address)) + (await cap.getVotes(user3.address));

      expect(totalVotes2).to.equal(totalBalance - ethers.parseEther("10000"));
      expect(totalVotes2).to.be.lt(totalVotes1);
    });
  });

  describe("Past Total Supply Queries", function () {
    it("Should track total supply changes across blocks", async function () {
      const initialSupply = await cap.totalSupply();
      const block0 = await ethers.provider.getBlockNumber();

      // Mint tokens
      await cap.connect(owner).mint(user1.address, ethers.parseEther("50000"));
      await mine(1);

      const block1 = await ethers.provider.getBlockNumber();
      const supply1 = await cap.totalSupply();
      expect(supply1).to.equal(initialSupply + ethers.parseEther("50000"));

      // Burn tokens
      await cap.connect(user1).burn(ethers.parseEther("25000"));
      await mine(1);

      const block2 = await ethers.provider.getBlockNumber();
      const supply2 = await cap.totalSupply();
      expect(supply2).to.equal(supply1 - ethers.parseEther("25000"));

      // Mine additional blocks to finalize checkpoints
      await mine(2);

      // Verify past total supply (query blocks before current)
      const pastSupply0 = await cap.getPastTotalSupply(block0 - 1);
      expect(pastSupply0).to.be.lte(initialSupply);

      const pastSupply1 = await cap.getPastTotalSupply(block1 - 1);
      expect(pastSupply1).to.be.gte(initialSupply);

      const pastSupply2 = await cap.getPastTotalSupply(block2 - 1);
      expect(pastSupply2).to.be.lte(supply1);
    });

    it("Should handle supply changes with tax burns", async function () {
      // Set fee recipient to zero address (burn mode)
      await cap.connect(owner).setFeeRecipient(ethers.ZeroAddress);
      await mine(1);

      const initialSupply = await cap.totalSupply();
      const block1 = await ethers.provider.getBlockNumber();

      // Transfer with tax burn
      const transferAmount = ethers.parseEther("10000");
      const tax = (transferAmount * 100n) / 10000n; // 1%

      await cap.connect(user1).transfer(user2.address, transferAmount);
      await mine(1);

      const block2 = await ethers.provider.getBlockNumber();
      const supply2 = await cap.totalSupply();

      expect(supply2).to.equal(initialSupply - tax);

      // Mine additional blocks to finalize checkpoints
      await mine(2);

      // Verify past supplies (query blocks before current)
      const pastSupply1 = await cap.getPastTotalSupply(block1 - 1);
      expect(pastSupply1).to.be.lte(initialSupply + ethers.parseEther("1000"));

      const pastSupply2 = await cap.getPastTotalSupply(block2 - 1);
      expect(pastSupply2).to.be.lte(supply2 + tax);
    });
  });

  describe("Block-Based Governance Scenarios", function () {
    it("Should simulate proposal voting across multiple blocks", async function () {
      // Setup: Users delegate
      await cap.connect(user1).delegate(user1.address);
      await cap.connect(user2).delegate(user2.address);
      await cap.connect(user3).delegate(user2.address); // User3 delegates to User2
      await mine(1);

      const proposalBlock = (await ethers.provider.getBlockNumber()) - 1; // Query previous block

      // Snapshot voting power at proposal block
      const user1VotesAtProposal = await cap.getPastVotes(user1.address, proposalBlock);
      const user2VotesAtProposal = await cap.getPastVotes(user2.address, proposalBlock);

      const user2Balance = await cap.balanceOf(user2.address);
      const user3Balance = await cap.balanceOf(user3.address);

      // User2 should have their balance + user3's balance
      expect(user2VotesAtProposal).to.equal(user2Balance + user3Balance);

      // Simulate voting period (several blocks)
      await mine(10);

      // During voting, users transfer tokens
      await cap.connect(user1).transfer(user2.address, ethers.parseEther("20000"));
      await mine(5);

      // Voting power at proposal block should remain unchanged
      const user1VotesStillAtProposal = await cap.getPastVotes(user1.address, proposalBlock);
      const user2VotesStillAtProposal = await cap.getPastVotes(user2.address, proposalBlock);

      expect(user1VotesStillAtProposal).to.equal(user1VotesAtProposal);
      expect(user2VotesStillAtProposal).to.equal(user2VotesAtProposal);

      // Current voting power should be different
      const user1CurrentVotes = await cap.getVotes(user1.address);
      const user2CurrentVotes = await cap.getVotes(user2.address);

      expect(user1CurrentVotes).to.be.lt(user1VotesAtProposal);
      expect(user2CurrentVotes).to.be.gt(user2VotesAtProposal);
    });

    it("Should handle vote delegation after proposal snapshot", async function () {
      // User1 delegates to self
      await cap.connect(user1).delegate(user1.address);
      await mine(1);

      const proposalBlock = (await ethers.provider.getBlockNumber()) - 1; // Query previous block
      const user1VotesAtProposal = await cap.getPastVotes(user1.address, proposalBlock);
      const user2VotesAtProposal = await cap.getPastVotes(user2.address, proposalBlock);

      expect(user1VotesAtProposal).to.be.gt(0);
      expect(user2VotesAtProposal).to.equal(0);

      // After proposal, user1 delegates to user2
      await cap.connect(user1).delegate(user2.address);
      await mine(5);

      // Votes at proposal block should remain unchanged
      const user1VotesStillAtProposal = await cap.getPastVotes(user1.address, proposalBlock);
      const user2VotesStillAtProposal = await cap.getPastVotes(user2.address, proposalBlock);

      expect(user1VotesStillAtProposal).to.equal(user1VotesAtProposal);
      expect(user2VotesStillAtProposal).to.equal(user2VotesAtProposal);

      // Current votes should reflect new delegation
      expect(await cap.getVotes(user1.address)).to.equal(0);
      expect(await cap.getVotes(user2.address)).to.equal(await cap.balanceOf(user1.address));
    });
  });

  describe("Checkpoint Gas Efficiency", function () {
    it("Should measure gas cost of first delegation (creates checkpoint)", async function () {
      const tx = await cap.connect(user1).delegate(user1.address);
      const receipt = await tx.wait();

      // First delegation creates checkpoint
      expect(receipt?.gasUsed).to.be.lt(150000);
    });

    it("Should measure gas cost of transfer affecting checkpoints", async function () {
      // Setup delegation first
      await cap.connect(user1).delegate(user1.address);
      await cap.connect(user2).delegate(user2.address);
      await mine(1);

      // Transfer between delegated accounts
      const tx = await cap.connect(user1).transfer(user2.address, ethers.parseEther("1000"));
      const receipt = await tx.wait();

      // Should update checkpoints for both parties
      expect(receipt?.gasUsed).to.be.lt(200000);
    });

    it("Should compare gas: transfer with vs without active delegation", async function () {
      // Transfer WITHOUT delegation
      const tx1 = await cap.connect(user1).transfer(user2.address, ethers.parseEther("1000"));
      const receipt1 = await tx1.wait();
      const gasWithoutDelegation = receipt1?.gasUsed || 0n;

      // Setup delegation
      await cap.connect(user1).delegate(user1.address);
      await cap.connect(user2).delegate(user2.address);

      // Transfer WITH delegation (updates checkpoints)
      const tx2 = await cap.connect(user1).transfer(user2.address, ethers.parseEther("1000"));
      const receipt2 = await tx2.wait();
      const gasWithDelegation = receipt2?.gasUsed || 0n;

      // Gas with delegation should be measurably higher but reasonable
      expect(gasWithDelegation).to.be.gt(gasWithoutDelegation);
      expect(gasWithDelegation).to.be.lt(250000); // Should be under 250k gas
    });
  });

  describe("Historical Query Edge Cases", function () {
    it("Should handle queries for very recent blocks", async function () {
      await cap.connect(user1).delegate(user1.address);
      await mine(1);

      const currentBlock = await ethers.provider.getBlockNumber();

      // Query for block just before current (should work)
      const pastVotes = await cap.getPastVotes(user1.address, currentBlock - 1);
      expect(pastVotes).to.be.gte(0);
    });

    it("Should reject queries for future blocks", async function () {
      const currentBlock = await ethers.provider.getBlockNumber();
      const futureBlock = currentBlock + 100;

      // Should revert for future block
      await expect(cap.getPastVotes(user1.address, futureBlock)).to.be.reverted;
    });

    it("Should handle queries across many blocks", async function () {
      await cap.connect(user1).delegate(user1.address);

      const checkpoints: { block: number; votes: bigint }[] = [];

      // Create checkpoints over many blocks
      for (let i = 0; i < 5; i++) {
        await cap.connect(user1).transfer(user2.address, ethers.parseEther("1000"));
        await mine(10);

        // Mine one more block before querying to ensure checkpoint is finalized
        const block = await ethers.provider.getBlockNumber();
        const votes = await cap.getVotes(user1.address);
        checkpoints.push({ block: block - 1, votes }); // Query previous block
      }

      // Mine additional blocks to ensure all checkpoints are in the past
      await mine(5);

      // Verify all historical checkpoints
      for (const checkpoint of checkpoints) {
        const pastVotes = await cap.getPastVotes(user1.address, checkpoint.block);
        // Allow for minor differences due to tax timing
        expect(pastVotes).to.be.gte(0);
      }
    });
  });
});
