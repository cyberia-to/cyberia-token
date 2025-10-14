import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CAPToken } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("DAO Integration Tests", function () {
  let cap: CAPToken;
  let owner: HardhatEthersSigner;
  let dao: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let pool1: HardhatEthersSigner;
  let pool2: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, dao, treasury, user1, user2, pool1, pool2] = await ethers.getSigners();

    // Deploy CAP Token
    const CAP = await ethers.getContractFactory("CAPToken");
    cap = (await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
      kind: "uups",
      initializer: "initialize",
    })) as unknown as CAPToken;
  });

  describe("DAO Ownership Transfer", function () {
    it("Should allow ownership transfer to DAO", async function () {
      // Transfer ownership to DAO
      await cap.connect(owner).transferOwnership(dao.address);

      expect(await cap.owner()).to.equal(dao.address);
    });

    it("Should prevent non-DAO from admin functions after transfer", async function () {
      // Transfer ownership to DAO
      await cap.connect(owner).transferOwnership(dao.address);

      // Original owner should no longer have admin access
      await expect(cap.connect(owner).setTaxesImmediate(200, 200, 0)).to.be.revertedWithCustomError(
        cap,
        "OwnableUnauthorizedAccount"
      );

      // DAO should have admin access
      await expect(cap.connect(dao).setTaxesImmediate(200, 200, 0)).to.not.be.reverted;
    });
  });

  describe("Treasury Management", function () {
    beforeEach(async function () {
      // Distribute tokens before transferring ownership
      await cap.connect(owner).transfer(user1.address, ethers.parseEther("100000"));
      await cap.connect(owner).transfer(user2.address, ethers.parseEther("100000"));

      // Transfer ownership to DAO
      await cap.connect(owner).transferOwnership(dao.address);
    });

    it("Should allow DAO to update treasury address", async function () {
      const oldRecipient = await cap.feeRecipient();
      const newTreasury = treasury.address; // Use treasury address, not user2

      await expect(cap.connect(dao).setFeeRecipient(newTreasury))
        .to.emit(cap, "FeeRecipientUpdated")
        .withArgs(oldRecipient, newTreasury);

      expect(await cap.feeRecipient()).to.equal(newTreasury);

      // Test that new treasury receives fees
      const transferAmount = ethers.parseEther("1000");
      const expectedTax = (transferAmount * 100n) / 10000n; // 1%

      const newTreasuryInitialBalance = await cap.balanceOf(newTreasury);

      await cap.connect(user1).transfer(user2.address, transferAmount);

      expect(await cap.balanceOf(newTreasury)).to.equal(newTreasuryInitialBalance + expectedTax);
    });

    it("Should allow DAO to enable burn mode", async function () {
      await cap.connect(dao).setFeeRecipient(ethers.ZeroAddress);

      const transferAmount = ethers.parseEther("1000");
      const expectedTax = (transferAmount * 100n) / 10000n; // 1%

      const initialSupply = await cap.totalSupply();

      await cap.connect(user1).transfer(user2.address, transferAmount);

      // Supply should decrease by tax amount
      expect(await cap.totalSupply()).to.equal(initialSupply - expectedTax);
    });
  });

  describe("Tax Policy Management", function () {
    beforeEach(async function () {
      await cap.connect(owner).transferOwnership(dao.address);
    });

    it("Should allow DAO to implement progressive tax policy", async function () {
      // Simulate DAO proposal to increase sell tax, decrease transfer tax
      await cap.connect(dao).setTaxesImmediate(50, 200, 0); // 0.5% transfer, 2% sell, 0% buy

      expect(await cap.transferTaxBp()).to.equal(50);
      expect(await cap.sellTaxBp()).to.equal(200);
      expect(await cap.buyTaxBp()).to.equal(0);
    });

    it("Should allow DAO to temporarily disable taxes", async function () {
      // DAO already owns the contract from beforeEach
      // Give tokens to DAO
      await cap.connect(owner).transfer(dao.address, ethers.parseEther("20000"));

      // Emergency scenario: disable all taxes
      await cap.connect(dao).setTaxesImmediate(0, 0, 0);

      // Distribute tokens
      await cap.connect(dao).transfer(user1.address, ethers.parseEther("10000"));

      const transferAmount = ethers.parseEther("1000");
      const user1InitialBalance = await cap.balanceOf(user1.address);
      const user2InitialBalance = await cap.balanceOf(user2.address);

      await cap.connect(user1).transfer(user2.address, transferAmount);

      // No taxes should be applied
      expect(await cap.balanceOf(user1.address)).to.equal(user1InitialBalance - transferAmount);
      expect(await cap.balanceOf(user2.address)).to.equal(user2InitialBalance + transferAmount);
    });

    it("Should respect tax caps even for DAO", async function () {
      // DAO cannot set taxes above 5%
      await expect(cap.connect(dao).setTaxesImmediate(501, 100, 100)).to.be.revertedWith("TRANSFER_TAX_TOO_HIGH");

      await expect(cap.connect(dao).setTaxesImmediate(100, 501, 100)).to.be.revertedWith("SELL_TAX_TOO_HIGH");

      await expect(cap.connect(dao).setTaxesImmediate(100, 100, 501)).to.be.revertedWith("BUY_TAX_TOO_HIGH");
    });
  });

  describe("AMM Pool Governance", function () {
    beforeEach(async function () {
      // Give tokens to DAO first
      await cap.connect(owner).transfer(dao.address, ethers.parseEther("50000"));
      await cap.connect(owner).transferOwnership(dao.address);
    });

    it("Should allow DAO to manage AMM pools", async function () {
      // Add multiple pools
      await cap.connect(dao).addPool(pool1.address);
      await cap.connect(dao).addPool(pool2.address);

      expect(await cap.isPool(pool1.address)).to.be.true;
      expect(await cap.isPool(pool2.address)).to.be.true;

      // Remove a pool
      await cap.connect(dao).removePool(pool1.address);

      expect(await cap.isPool(pool1.address)).to.be.false;
      expect(await cap.isPool(pool2.address)).to.be.true;
    });

    it("Should apply correct taxes based on pool status", async function () {
      await cap.connect(dao).addPool(pool1.address);

      // Give tokens to test accounts
      await cap.connect(dao).transfer(user1.address, ethers.parseEther("10000"));
      await cap.connect(dao).transfer(pool1.address, ethers.parseEther("10000"));

      const transferAmount = ethers.parseEther("1000");

      // Test sell to pool (should have transfer + sell tax)
      const user1InitialBalance = await cap.balanceOf(user1.address);
      const treasuryInitialBalance = await cap.balanceOf(treasury.address);

      await cap.connect(user1).transfer(pool1.address, transferAmount);

      const totalTax = (transferAmount * 200n) / 10000n; // 2% (1% transfer + 1% sell)
      const _expectedNet = transferAmount - totalTax;

      expect(await cap.balanceOf(user1.address)).to.equal(user1InitialBalance - transferAmount);
      expect(await cap.balanceOf(treasury.address)).to.equal(treasuryInitialBalance + totalTax);

      // Test buy from pool (should have no tax)
      const user2InitialBalance = await cap.balanceOf(user2.address);

      await cap.connect(pool1).transfer(user2.address, transferAmount);

      expect(await cap.balanceOf(user2.address)).to.equal(user2InitialBalance + transferAmount);
    });
  });

  describe("Governance Token Features", function () {
    beforeEach(async function () {
      // Give tokens to DAO first
      await cap.connect(owner).transfer(dao.address, ethers.parseEther("100000"));
      await cap.connect(owner).transferOwnership(dao.address);
      await cap.connect(dao).transfer(user1.address, ethers.parseEther("50000"));
      await cap.connect(dao).transfer(user2.address, ethers.parseEther("30000"));
    });

    it("Should support delegation for governance voting", async function () {
      // Users delegate to themselves to activate voting power
      await cap.connect(user1).delegate(user1.address);
      await cap.connect(user2).delegate(user2.address);

      // Check actual balances (after 1% transfer tax from DAO)
      const user1Balance = await cap.balanceOf(user1.address);
      const user2Balance = await cap.balanceOf(user2.address);

      expect(await cap.getVotes(user1.address)).to.equal(user1Balance);
      expect(await cap.getVotes(user2.address)).to.equal(user2Balance);

      // User1 delegates to user2
      await cap.connect(user1).delegate(user2.address);

      expect(await cap.getVotes(user1.address)).to.equal(0);
      expect(await cap.getVotes(user2.address)).to.equal(user1Balance + user2Balance);
    });

    it("Should track voting power correctly after transfers", async function () {
      await cap.connect(user1).delegate(user1.address);

      const initialBalance = await cap.balanceOf(user1.address);
      const initialVotingPower = await cap.getVotes(user1.address);
      expect(initialVotingPower).to.equal(initialBalance);

      // Transfer some tokens
      await cap.connect(user1).transfer(user2.address, ethers.parseEther("10000"));

      // Voting power should equal current balance after transfer
      const finalBalance = await cap.balanceOf(user1.address);
      const finalVotingPower = await cap.getVotes(user1.address);

      expect(finalVotingPower).to.equal(finalBalance);
    });

    it("Should maintain voting power through tax operations", async function () {
      // Self-delegate to activate voting power
      await cap.connect(user1).delegate(user1.address);

      const initialVotingPower = await cap.getVotes(user1.address);

      // Set fee recipient to burn address
      await cap.connect(dao).setFeeRecipient(ethers.ZeroAddress);

      // Make a transfer that burns taxes
      await cap.connect(user1).transfer(user2.address, ethers.parseEther("1000"));

      // Voting power should reflect the net balance
      const netTransferAmount = ethers.parseEther("1000");
      const expectedVotingPower = initialVotingPower - netTransferAmount;

      expect(await cap.getVotes(user1.address)).to.equal(expectedVotingPower);
    });
  });

  describe("Complete DAO Workflow", function () {
    it("Should simulate complete DAO governance cycle", async function () {
      // Step 1: Give tokens to DAO and transfer ownership
      await cap.connect(owner).transfer(dao.address, ethers.parseEther("100000"));
      await cap.connect(owner).transferOwnership(dao.address);

      // Step 2: DAO adds AMM pool
      await cap.connect(dao).addPool(pool1.address);

      // Step 3: DAO adjusts tax policy
      await cap.connect(dao).setTaxesImmediate(75, 150, 25); // 0.75%, 1.5%, 0.25%

      // Step 4: DAO updates treasury
      await cap.connect(dao).setFeeRecipient(treasury.address);

      // Step 5: Test that changes work correctly
      await cap.connect(dao).transfer(user1.address, ethers.parseEther("10000"));
      await cap.connect(dao).transfer(user2.address, ethers.parseEther("5000"));

      // Test transfer tax
      const transferAmount = ethers.parseEther("500"); // Reduced to ensure sufficient balance
      const transferTax = (transferAmount * 75n) / 10000n; // 0.75%

      const treasuryBefore = await cap.balanceOf(treasury.address);
      await cap.connect(user1).transfer(user2.address, transferAmount);
      const treasuryAfter = await cap.balanceOf(treasury.address);

      expect(treasuryAfter - treasuryBefore).to.equal(transferTax);

      // Test sell tax
      await cap.connect(dao).transfer(pool1.address, ethers.parseEther("5000"));

      const sellTax = (transferAmount * (75n + 150n)) / 10000n; // 0.75% + 1.5%

      const treasuryBefore2 = await cap.balanceOf(treasury.address);
      await cap.connect(user2).transfer(pool1.address, transferAmount);
      const treasuryAfter2 = await cap.balanceOf(treasury.address);

      expect(treasuryAfter2 - treasuryBefore2).to.equal(sellTax);

      // Test buy tax
      const buyTax = (transferAmount * 25n) / 10000n; // 0.25%

      const treasuryBefore3 = await cap.balanceOf(treasury.address);
      await cap.connect(pool1).transfer(user1.address, transferAmount);
      const treasuryAfter3 = await cap.balanceOf(treasury.address);

      expect(treasuryAfter3 - treasuryBefore3).to.equal(buyTax);
    });
  });
});
