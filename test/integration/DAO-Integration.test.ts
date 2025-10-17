import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CAPToken, MockDEXPair } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("DAO Integration Tests", function () {
  let cap: CAPToken;
  let mockPool1: MockDEXPair;
  let mockPool2: MockDEXPair;
  let pool1Address: string;
  let pool2Address: string;
  let owner: HardhatEthersSigner;
  let dao: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, dao, treasury, user1, user2] = await ethers.getSigners();

    // Deploy CAP Token with owner initially getting all tokens
    const CAP = await ethers.getContractFactory("CAPToken");
    cap = (await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
      kind: "uups",
      initializer: "initialize",
    })) as unknown as CAPToken;

    // Deploy Mock DEX Pairs for pool testing
    const MockDEXPair = await ethers.getContractFactory("MockDEXPair");
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    mockPool1 = await MockDEXPair.deploy(await cap.getAddress(), WETH);
    mockPool2 = await MockDEXPair.deploy(await cap.getAddress(), WETH);
    pool1Address = await mockPool1.getAddress();
    pool2Address = await mockPool2.getAddress();

    // Give DAO some tokens before transferring governance
    await cap.connect(owner).transfer(dao.address, ethers.parseEther("500000000"));

    // Transfer governance to DAO
    await cap.connect(owner).setGovernance(dao.address);
  });

  describe("DAO Governance Transfer", function () {
    it("Should have DAO as governance after initial setup", async function () {
      // DAO should be governance (set in beforeEach)
      expect(await cap.governance()).to.equal(dao.address);
    });

    it("Should prevent non-DAO from admin functions", async function () {
      // Users should not have admin access
      await expect(cap.connect(user1).proposeTaxChange(200, 200, 0)).to.be.revertedWith("ONLY_GOVERNANCE");

      // DAO should have admin access
      await expect(cap.connect(dao).proposeTaxChange(200, 200, 0)).to.not.be.reverted;
    });
  });

  describe("Treasury Management", function () {
    beforeEach(async function () {
      // Distribute tokens (DAO already has governance from main beforeEach)
      await cap.connect(dao).transfer(user1.address, ethers.parseEther("100000"));
      await cap.connect(dao).transfer(user2.address, ethers.parseEther("100000"));
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
    // DAO already has governance from main beforeEach

    it("Should allow DAO to propose and apply tax changes with timelock", async function () {
      await cap.connect(dao).proposeTaxChange(50, 200, 0);

      // Taxes should not change immediately
      expect(await cap.transferTaxBp()).to.equal(100);
      expect(await cap.sellTaxBp()).to.equal(100);

      // Fast forward 24 hours
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await cap.connect(dao).applyTaxChange();

      expect(await cap.transferTaxBp()).to.equal(50);
      expect(await cap.sellTaxBp()).to.equal(200);
      expect(await cap.buyTaxBp()).to.equal(0);
    });

    it("Should respect tax caps even for DAO", async function () {
      await expect(cap.connect(dao).proposeTaxChange(501, 100, 100)).to.be.revertedWith("TRANSFER_TAX_TOO_HIGH");
      await expect(cap.connect(dao).proposeTaxChange(100, 501, 100)).to.be.revertedWith("SELL_TAX_TOO_HIGH");
      await expect(cap.connect(dao).proposeTaxChange(100, 100, 501)).to.be.revertedWith("BUY_TAX_TOO_HIGH");
    });
  });

  describe("AMM Pool Governance", function () {
    // DAO already has governance from main beforeEach

    it("Should allow DAO to manage AMM pools", async function () {
      await cap.connect(dao).addPool(pool1Address);
      await cap.connect(dao).addPool(pool2Address);

      expect(await cap.isPool(pool1Address)).to.be.true;
      expect(await cap.isPool(pool2Address)).to.be.true;

      await cap.connect(dao).removePool(pool1Address);

      expect(await cap.isPool(pool1Address)).to.be.false;
      expect(await cap.isPool(pool2Address)).to.be.true;
    });

    it("Should apply correct taxes based on pool status", async function () {
      await cap.connect(dao).addPool(pool1Address);
      await cap.connect(dao).transfer(user1.address, ethers.parseEther("10000"));
      await cap.connect(dao).transfer(pool1Address, ethers.parseEther("10000"));

      const transferAmount = ethers.parseEther("1000");
      const treasuryBefore = await cap.balanceOf(treasury.address);

      // Sell to pool: transfer + sell tax = 2%
      await cap.connect(user1).transfer(pool1Address, transferAmount);
      const treasuryAfter1 = await cap.balanceOf(treasury.address);
      expect(treasuryAfter1 - treasuryBefore).to.equal((transferAmount * 200n) / 10000n);

      // Buy from pool: 0% tax (impersonate pool contract)
      await ethers.provider.send("hardhat_impersonateAccount", [pool1Address]);
      await ethers.provider.send("hardhat_setBalance", [pool1Address, "0x1000000000000000000"]); // Give pool ETH for gas
      const poolSigner = await ethers.getSigner(pool1Address);
      const user2Before = await cap.balanceOf(user2.address);
      await cap.connect(poolSigner).transfer(user2.address, transferAmount);
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [pool1Address]);
      expect(await cap.balanceOf(user2.address)).to.equal(user2Before + transferAmount);
    });
  });

  describe("Governance Token Features", function () {
    beforeEach(async function () {
      // DAO already has governance and tokens from main beforeEach
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
      // DAO already has governance from main beforeEach

      // Step 2: DAO adds AMM pool
      await cap.connect(dao).addPool(pool1Address);

      // Step 3: DAO adjusts tax policy (propose and apply with timelock)
      await cap.connect(dao).proposeTaxChange(75, 150, 25); // 0.75%, 1.5%, 0.25%
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await cap.connect(dao).applyTaxChange();

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
      await cap.connect(dao).transfer(pool1Address, ethers.parseEther("5000"));

      const sellTax = (transferAmount * (75n + 150n)) / 10000n; // 0.75% + 1.5%

      const treasuryBefore2 = await cap.balanceOf(treasury.address);
      await cap.connect(user2).transfer(pool1Address, transferAmount);
      const treasuryAfter2 = await cap.balanceOf(treasury.address);

      expect(treasuryAfter2 - treasuryBefore2).to.equal(sellTax);

      // Test buy tax (impersonate pool contract)
      const buyTax = (transferAmount * 25n) / 10000n; // 0.25%

      const treasuryBefore3 = await cap.balanceOf(treasury.address);
      await ethers.provider.send("hardhat_impersonateAccount", [pool1Address]);
      await ethers.provider.send("hardhat_setBalance", [pool1Address, "0x1000000000000000000"]); // Give pool ETH for gas
      const poolSigner = await ethers.getSigner(pool1Address);
      await cap.connect(poolSigner).transfer(user1.address, transferAmount);
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [pool1Address]);
      const treasuryAfter3 = await cap.balanceOf(treasury.address);

      expect(treasuryAfter3 - treasuryBefore3).to.equal(buyTax);
    });
  });
});
