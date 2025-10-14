import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CAPToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Timelock Boundary Tests", function () {
  let cap: CAPToken;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  const TIMELOCK_DELAY = 24 * 60 * 60; // 24 hours in seconds

  beforeEach(async function () {
    [owner, treasury, user1] = await ethers.getSigners();

    const CAP = await ethers.getContractFactory("CAPToken");
    cap = (await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
      kind: "uups",
      initializer: "initialize",
    })) as unknown as CAPToken;
  });

  describe("Timelock Delay Boundaries", function () {
    it("Should reject application exactly 1 second before timelock expiry", async function () {
      await cap.connect(owner).proposeTaxChange(200, 300, 50);

      const targetTime = await cap.taxChangeTimestamp();

      // Set time to exactly 1 second before the target time
      await time.setNextBlockTimestamp(targetTime - 1n);

      await expect(cap.connect(owner).applyTaxChange()).to.be.revertedWith("TIMELOCK_NOT_EXPIRED");
    });

    it("Should allow application exactly at timelock expiry", async function () {
      await cap.connect(owner).proposeTaxChange(200, 300, 50);

      // Move to exactly the timelock delay
      await time.increase(TIMELOCK_DELAY);

      await expect(cap.connect(owner).applyTaxChange()).to.not.be.reverted;

      expect(await cap.transferTaxBp()).to.equal(200);
    });

    it("Should allow application 1 second after timelock expiry", async function () {
      await cap.connect(owner).proposeTaxChange(200, 300, 50);

      // Move to 1 second after timelock delay
      await time.increase(TIMELOCK_DELAY + 1);

      await expect(cap.connect(owner).applyTaxChange()).to.not.be.reverted;

      expect(await cap.transferTaxBp()).to.equal(200);
    });

    it("Should handle application hours after timelock expiry", async function () {
      await cap.connect(owner).proposeTaxChange(200, 300, 50);

      // Move to 48 hours (well past timelock)
      await time.increase(TIMELOCK_DELAY * 2);

      await expect(cap.connect(owner).applyTaxChange()).to.not.be.reverted;

      expect(await cap.transferTaxBp()).to.equal(200);
    });

    it("Should handle application days after timelock expiry", async function () {
      await cap.connect(owner).proposeTaxChange(200, 300, 50);

      // Move to 7 days after proposal
      await time.increase(TIMELOCK_DELAY * 7);

      await expect(cap.connect(owner).applyTaxChange()).to.not.be.reverted;

      expect(await cap.transferTaxBp()).to.equal(200);
    });
  });

  describe("Multiple Proposal Scenarios", function () {
    it("Should handle rapid proposal replacements", async function () {
      // First proposal
      await cap.connect(owner).proposeTaxChange(100, 150, 25);
      const timestamp1 = await cap.taxChangeTimestamp();

      // Wait 1 hour
      await time.increase(3600);

      // Second proposal (overwrites first)
      await cap.connect(owner).proposeTaxChange(200, 250, 50);
      const timestamp2 = await cap.taxChangeTimestamp();

      expect(timestamp2).to.be.gt(timestamp1);

      // Wait 23 hours (total 24 hours from second proposal)
      await time.increase(23 * 3600);

      // Should NOT be able to apply yet (only 23 hours from second proposal)
      await expect(cap.connect(owner).applyTaxChange()).to.be.revertedWith("TIMELOCK_NOT_EXPIRED");

      // Wait 1 more hour
      await time.increase(3600);

      // Now should work with SECOND proposal values
      await cap.connect(owner).applyTaxChange();

      expect(await cap.transferTaxBp()).to.equal(200);
      expect(await cap.sellTaxBp()).to.equal(250);
      expect(await cap.buyTaxBp()).to.equal(50);
    });

    it("Should allow proposing same values multiple times", async function () {
      const values = { transfer: 200, sell: 300, buy: 50 };

      // First proposal
      await cap.connect(owner).proposeTaxChange(values.transfer, values.sell, values.buy);
      const timestamp1 = await cap.taxChangeTimestamp();

      // Wait a bit
      await time.increase(3600);

      // Propose same values again
      await cap.connect(owner).proposeTaxChange(values.transfer, values.sell, values.buy);
      const timestamp2 = await cap.taxChangeTimestamp();

      expect(timestamp2).to.be.gt(timestamp1);
      expect(await cap.pendingTransferTaxBp()).to.equal(values.transfer);
    });

    it("Should handle proposal at timestamp boundaries", async function () {
      // Get current block timestamp before proposal
      const tx = await cap.connect(owner).proposeTaxChange(200, 300, 50);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      const blockTime = block!.timestamp;

      const proposalTime = await cap.taxChangeTimestamp();

      // Proposal timestamp should be block timestamp + delay
      expect(proposalTime).to.equal(blockTime + TIMELOCK_DELAY);
    });
  });

  describe("Timestamp Edge Cases", function () {
    it("Should handle timelock at maximum safe timestamp", async function () {
      await cap.connect(owner).proposeTaxChange(200, 300, 50);

      // Move to far future (but within safe bounds)
      const farFuture = TIMELOCK_DELAY + 365 * 24 * 60 * 60; // 1 year from now
      await time.increase(farFuture);

      await expect(cap.connect(owner).applyTaxChange()).to.not.be.reverted;
    });

    it("Should prevent double application of same proposal", async function () {
      await cap.connect(owner).proposeTaxChange(200, 300, 50);

      await time.increase(TIMELOCK_DELAY + 1);

      // First application
      await cap.connect(owner).applyTaxChange();

      // Second application should fail (no pending change)
      await expect(cap.connect(owner).applyTaxChange()).to.be.revertedWith("NO_PENDING_CHANGE");
    });

    it("Should handle proposal-apply-proposal cycle", async function () {
      // First cycle
      await cap.connect(owner).proposeTaxChange(200, 300, 50);
      await time.increase(TIMELOCK_DELAY + 1);
      await cap.connect(owner).applyTaxChange();

      expect(await cap.transferTaxBp()).to.equal(200);

      // Second cycle immediately after first
      await cap.connect(owner).proposeTaxChange(150, 200, 25);
      await time.increase(TIMELOCK_DELAY + 1);
      await cap.connect(owner).applyTaxChange();

      expect(await cap.transferTaxBp()).to.equal(150);
    });
  });

  describe("Timelock Interaction with Other Operations", function () {
    it("Should allow immediate tax changes during pending timelock", async function () {
      // Propose timelock change
      await cap.connect(owner).proposeTaxChange(200, 300, 50);

      // Owner can still use setTaxesImmediate
      await cap.connect(owner).setTaxesImmediate(150, 250, 25);

      expect(await cap.transferTaxBp()).to.equal(150);

      // Pending proposal is still there
      expect(await cap.pendingTransferTaxBp()).to.equal(200);

      // Can still apply pending proposal after timelock
      await time.increase(TIMELOCK_DELAY + 1);
      await cap.connect(owner).applyTaxChange();

      expect(await cap.transferTaxBp()).to.equal(200);
    });

    it("Should handle transfers during pending timelock", async function () {
      await cap.connect(owner).transfer(user1.address, ethers.parseEther("10000"));

      // Propose tax change
      await cap.connect(owner).proposeTaxChange(400, 400, 200);

      // Transfers should use current tax rates
      const transferAmount = ethers.parseEther("1000");
      const currentTax = (transferAmount * 100n) / 10000n; // 1%

      const treasuryBefore = await cap.balanceOf(treasury.address);
      await cap.connect(user1).transfer(owner.address, transferAmount);
      const treasuryAfter = await cap.balanceOf(treasury.address);

      expect(treasuryAfter - treasuryBefore).to.equal(currentTax);

      // Apply new taxes
      await time.increase(TIMELOCK_DELAY + 1);
      await cap.connect(owner).applyTaxChange();

      // New transfers should use new tax rates
      const newTax = (transferAmount * 400n) / 10000n; // 4%

      const treasuryBefore2 = await cap.balanceOf(treasury.address);
      await cap.connect(user1).transfer(owner.address, transferAmount);
      const treasuryAfter2 = await cap.balanceOf(treasury.address);

      expect(treasuryAfter2 - treasuryBefore2).to.equal(newTax);
    });

    it("Should preserve pending proposal through ownership transfer", async function () {
      await cap.connect(owner).proposeTaxChange(200, 300, 50);

      const timestampBefore = await cap.taxChangeTimestamp();

      // Transfer ownership
      await cap.connect(owner).transferOwnership(user1.address);

      // Pending proposal should still exist
      expect(await cap.taxChangeTimestamp()).to.equal(timestampBefore);
      expect(await cap.pendingTransferTaxBp()).to.equal(200);

      // New owner can apply it
      await time.increase(TIMELOCK_DELAY + 1);
      await cap.connect(user1).applyTaxChange();

      expect(await cap.transferTaxBp()).to.equal(200);
    });
  });

  describe("Gas Efficiency During Timelock", function () {
    it("Should measure gas cost of proposing tax change", async function () {
      const tx = await cap.connect(owner).proposeTaxChange(200, 300, 50);
      const receipt = await tx.wait();

      // Should be relatively cheap (mostly storage writes)
      expect(receipt?.gasUsed).to.be.lt(150000);
    });

    it("Should measure gas cost of applying tax change", async function () {
      await cap.connect(owner).proposeTaxChange(200, 300, 50);
      await time.increase(TIMELOCK_DELAY + 1);

      const tx = await cap.connect(owner).applyTaxChange();
      const receipt = await tx.wait();

      // Should be relatively cheap
      expect(receipt?.gasUsed).to.be.lt(100000);
    });

    it("Should compare gas cost: immediate vs timelock", async function () {
      // Immediate change
      const tx1 = await cap.connect(owner).setTaxesImmediate(200, 300, 50);
      const receipt1 = await tx1.wait();
      const immediateGas = receipt1?.gasUsed || 0n;

      // Timelock change (propose + apply)
      const tx2 = await cap.connect(owner).proposeTaxChange(150, 250, 25);
      const receipt2 = await tx2.wait();
      await time.increase(TIMELOCK_DELAY + 1);
      const tx3 = await cap.connect(owner).applyTaxChange();
      const receipt3 = await tx3.wait();

      const timelockGas = (receipt2?.gasUsed || 0n) + (receipt3?.gasUsed || 0n);

      // Timelock should cost more (two transactions)
      expect(timelockGas).to.be.gt(immediateGas);

      // But not excessively more
      expect(timelockGas).to.be.lt(immediateGas * 3n);
    });
  });
});
